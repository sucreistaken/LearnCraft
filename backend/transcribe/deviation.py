import argparse, json, re, math
from typing import List, Dict, Any, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer


# ----------------- helpers -----------------
STOPWORDS = set("""
a an the and or but if then so because to of in on at for with without as is are was were be been being
i you he she it we they me my your our their this that these those here there
""".split())

FILLERS = set("""
um uh erm hmm like okay ok right yeah yep yup kinda sort of basically actually literally
""".split())

BANTER_HINTS = [
  "how are you", "guys", "everyone", "good morning", "good afternoon", "weekend", "coffee",
  "let's take a break", "break", "pause", "attendance", "zoom", "microphone", "can you hear",
  "exam", "midterm", "final", "project deadline", "homework", "assignment"
]

def tokenize(text: str) -> List[str]:
    return re.findall(r"[A-Za-z0-9']+", (text or "").lower())

def clean_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def format_seconds(s: str) -> str:
    if ":" in s:
        return s
    try:
        val = float(s)
        hours = int(val // 3600)
        minutes = int((val % 3600) // 60)
        seconds = int(val % 60)
        return f"{hours:02}:{minutes:02}:{seconds:02}"
    except ValueError:
        return s

def parse_timestamped_transcript(t: str) -> List[Dict[str, Any]]:
    """
    expects lines like:
    [00:03:12 – 00:03:24] text...
    or [03:12 – 03:24] text...
    """
    out = []
    if not t:
        return out

    # accept both – and -
    rx = re.compile(r"^\[(?P<a>[^]\-–]+)\s*[-–]\s*(?P<b>[^]]+)\]\s*(?P<txt>.*)$")
    lines = t.splitlines()
    idx = 0
    for line in lines:
        m = rx.match(line.strip())
        if not m:
            continue
        a = m.group("a").strip()
        b = m.group("b").strip()
        txt = clean_ws(m.group("txt"))
        out.append({
            "index": idx,
            "start": format_seconds(a),
            "end": format_seconds(b),
            "text": txt
        })
        idx += 1
    return out

def split_into_chunks(text: str, approx_words: int = 220) -> List[str]:
    words = clean_ws(text).split()
    if not words:
        return []
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i+approx_words]).strip()
        if chunk:
            chunks.append(chunk)
        i += approx_words
    return chunks

def cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom <= 1e-9:
        return 0.0
    return float(np.dot(a, b) / denom)

def banter_score(text: str) -> float:
    t = (text or "").lower()
    toks = tokenize(t)
    if not toks:
        return 1.0

    # short / low info
    short = 1.0 if len(toks) < 6 else 0.0

    # filler ratio
    filler_cnt = sum(1 for w in toks if w in FILLERS)
    filler_ratio = filler_cnt / max(1, len(toks))

    # content words ratio
    content_cnt = sum(1 for w in toks if w not in STOPWORDS and w not in FILLERS)
    content_ratio = content_cnt / max(1, len(toks))
    low_content = 1.0 if content_ratio < 0.35 else 0.0

    # banter hints
    hints = sum(1 for h in BANTER_HINTS if h in t)
    hint_score = min(1.0, hints / 2.0)

    score = (
        0.35 * short +
        0.30 * min(1.0, filler_ratio * 3.0) +
        0.25 * low_content +
        0.10 * hint_score
    )
    return float(max(0.0, min(1.0, score)))

def classify(sim: float, banter: float, topic_sim: float = 0.0) -> Tuple[str, float, str]:
    """
    returns (status, confidence, reason)
    status: on_slide | expanded | off_slide | banter
    
    Now includes topic_sim: similarity to the lesson topic/title.
    If topic_sim is high but slide sim is low, it's likely 'expanded' not 'off_slide'.
    """
    # banter wins if strong and sim very low
    if banter >= 0.65 and sim < 0.25 and topic_sim < 0.30:
        return ("banter", 0.85, f"Low slide match (sim={sim:.2f}) + banter cues (score={banter:.2f})")

    if sim >= 0.60:
        return ("on_slide", min(0.95, 0.60 + sim/2), f"High slide match (sim={sim:.2f})")

    if 0.35 <= sim < 0.60:
        return ("expanded", 0.75, f"Medium slide match (sim={sim:.2f}) → likely elaboration")

    # LOW SLIDE SIM - but check topic relevance
    # If topic_sim is decent, it's still on-topic (expanded), not off_slide
    if sim < 0.35 and topic_sim >= 0.30:
        return ("expanded", 0.70, f"Low slide match (sim={sim:.2f}) but on-topic (topic={topic_sim:.2f}) → elaboration")

    # very low sim - check banter
    if sim < 0.20 and banter >= 0.45:
        return ("banter", 0.75, f"Very low slide match (sim={sim:.2f}) and social/filler patterns")

    # Truly off-topic: low slide match AND low topic match
    if topic_sim < 0.25:
        return ("off_slide", 0.70, f"Low slide match (sim={sim:.2f}) and low topic match (topic={topic_sim:.2f}) → topic drift")
    
    # Borderline - treat as expanded
    return ("expanded", 0.60, f"Borderline slide match (sim={sim:.2f}), topic relevant (topic={topic_sim:.2f})")


def extract_key_phrases(text: str, top_n: int = 10) -> List[str]:
    """Extract meaningful key phrases from text."""
    words = tokenize(text)
    # Simple approach: bigrams and trigrams of content words
    content_words = [w for w in words if w not in STOPWORDS and w not in FILLERS and len(w) > 2]
    
    # Get word frequencies
    from collections import Counter
    freq = Counter(content_words)
    
    # Return most common
    return [w for w, _ in freq.most_common(top_n)]


def find_missed_and_extra_topics(segments: List[Dict], slides_text: str, slide_chunks: List[str]) -> Dict:
    """
    Find:
    - Topics in slides but not well covered in lecture
    - Topics in lecture but absent from slides
    """
    # Aggregate segments by status
    on_slide_texts = []
    off_slide_texts = []
    
    for seg in segments:
        if seg["status"] in ("on_slide", "expanded"):
            on_slide_texts.append(seg["text"])
        elif seg["status"] == "off_slide":
            off_slide_texts.append(seg["text"])
    
    on_combined = " ".join(on_slide_texts)
    off_combined = " ".join(off_slide_texts)
    
    # Key phrases from slides
    slide_phrases = set(extract_key_phrases(slides_text, 20))
    
    # Key phrases from on-slide lecture parts
    covered_phrases = set(extract_key_phrases(on_combined, 30))
    
    # Key phrases from off-slide parts
    extra_phrases = set(extract_key_phrases(off_combined, 15))
    
    # Missed = in slides but not covered well
    missed = list(slide_phrases - covered_phrases)[:8]
    
    # Extra = talked about but not in slides
    extra = list(extra_phrases - slide_phrases)[:8]
    
    return {
        "missed": missed,
        "extra": extra
    }


def calculate_overall_score(summary: Dict, segments: List[Dict]) -> int:
    """
    Calculate a 0-100 score representing lecture-slide alignment.
    Higher = better alignment.
    """
    if not segments:
        return 50
    
    total = len(segments)
    counts = summary["counts"]
    
    # Weight each status
    # on_slide: best (100 pts)
    # expanded: good (80 pts) - teacher elaborates
    # off_slide: medium (40 pts) - might be valuable tangent
    # banter: low (10 pts) - waste of time
    
    weighted_sum = (
        counts.get("on_slide", 0) * 100 +
        counts.get("expanded", 0) * 80 +
        counts.get("off_slide", 0) * 40 +
        counts.get("banter", 0) * 10
    )
    
    max_possible = total * 100
    score = int(round((weighted_sum / max_possible) * 100)) if max_possible > 0 else 50
    
    return max(0, min(100, score))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcript", required=True, help="path to transcript txt")
    ap.add_argument("--slides", required=True, help="path to slides txt")
    ap.add_argument("--title", default="", help="lesson title for topic relevance check")
    ap.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2")
    args = ap.parse_args()

    with open(args.transcript, "r", encoding="utf-8") as f:
        transcript = f.read()

    with open(args.slides, "r", encoding="utf-8") as f:
        slides = f.read()

    segments = parse_timestamped_transcript(transcript)
    if not segments:
        # fallback: treat full transcript as one segment
        segments = [{"index": 0, "start": "00:00", "end": "??:??", "text": clean_ws(transcript)}]

    slide_chunks = split_into_chunks(slides, approx_words=220)
    if not slide_chunks:
        slide_chunks = [""]

    st = SentenceTransformer(args.model)

    # embed slide chunks once
    slide_vecs = st.encode(slide_chunks, normalize_embeddings=True)
    
    # Create topic embedding from title + first slide content
    # This represents the "core topic" of the lesson
    topic_text = args.title or ""
    if slides:
        # Add first 500 chars of slides for better topic representation
        first_slide_content = slides[:500]
        topic_text = f"{topic_text} {first_slide_content}".strip()
    
    if not topic_text:
        topic_text = "general lecture content"
    
    topic_vec = st.encode([topic_text], normalize_embeddings=True)[0]

    results = []
    counts = {"on_slide": 0, "expanded": 0, "off_slide": 0, "banter": 0}

    for seg in segments:
        txt = seg["text"]
        seg_vec = st.encode([txt], normalize_embeddings=True)[0]

        # best similarity over slide chunks
        sims = np.dot(slide_vecs, seg_vec)  # because normalized
        best_i = int(np.argmax(sims))
        best_sim = float(sims[best_i])
        
        # topic similarity - is this segment related to the lesson topic?
        topic_sim = float(np.dot(topic_vec, seg_vec))

        b = banter_score(txt)
        status, conf, reason = classify(best_sim, b, topic_sim)

        counts[status] += 1

        results.append({
            "index": seg["index"],
            "start": seg["start"],
            "end": seg["end"],
            "text": txt,
            "slideCoverage": round(best_sim, 4),
            "topicRelevance": round(topic_sim, 4),
            "banterScore": round(b, 4),
            "status": status,
            "confidence": round(conf, 3),
            "reason": reason,
            "closestSlideChunkIndex": best_i
        })

    total = max(1, len(results))
    summary = {
        "totalSegments": total,
        "percent": {k: round((v/total)*100, 1) for k, v in counts.items()},
        "counts": counts
    }
    
    # Calculate overall score (0-100)
    overall_score = calculate_overall_score(summary, results)
    summary["overallScore"] = overall_score
    
    # Find missed and extra topics
    topics = find_missed_and_extra_topics(results, slides, slide_chunks)
    summary["missedTopics"] = topics["missed"]
    summary["extraTopics"] = topics["extra"]
    
    # Add score interpretation
    if overall_score >= 80:
        summary["interpretation"] = "Mükemmel uyum - Hoca slaytlara çok sadık kalmış"
    elif overall_score >= 60:
        summary["interpretation"] = "İyi uyum - Hoca genel olarak konuya bağlı, bazı genişlemeler var"
    elif overall_score >= 40:
        summary["interpretation"] = "Orta uyum - Belirgin konu sapmaları mevcut"
    else:
        summary["interpretation"] = "Düşük uyum - Hoca slaytlardan çok sapmış"

    # Use ensure_ascii=True to avoid cp1254 encoding errors on Windows console
    print(json.dumps({"ok": True, "summary": summary, "segments": results}, ensure_ascii=True))


if __name__ == "__main__":
    main()

