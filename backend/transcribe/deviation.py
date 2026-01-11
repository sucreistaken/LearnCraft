#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import re
import math
from typing import List, Dict, Any, Tuple, Set
from collections import Counter
import numpy as np
from sentence_transformers import SentenceTransformer

# --- Constants & Config ---
STOPWORDS = set("""
a about above after again against all am an and any are aren't as at be because been before being below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves
acaba ama ancak asla aynen az bana bazen baza bazan bazı belki ben bence beni benim beş bile bin bir biri birkaç birkez birçok birşey birşeyi biz bize bizi bizim böyle böylece bu buna bunda bundan bunlar bunları bunların bunu bunun burada burada buraya büyük çok çünkü da daha dahi de defa değil diğer diye doksan dokuz dolayı dolayısıyla dört edecek eden ederek edilecek ediliyor edilmesi ediyor eğer elli en etmesi etti ettiği ettiğini gibi göre halen hangi hatta hem henüz hep hepsi her herkes herkese hiç hiçbir için iki ile ilgili ise işte itibaren itibariyle kadar karşın katrilyon kendi kendilerine kendine kendini kendisi kendisini kez ki kim kimden kime kimi kimse kırk milyar milyon mu mü mı mıydı nasıl ne neden neden neler neticede neye niçin niye o olan olarak oldu olduklarını olduğu olduğunu olmadığı olması olmayan olmuş olsa olsun olup olur olursa oluyor on ona ondan onlar onlara onlardan onların onları onu onun otuz oysa öyle pek rağmen sadece sanki sekiz seksen sen senden senin siz sizden size sizi sizin sonra sonuçta şu şuna şunda şundan şunlar şunları şunların şunu şunun tabi tamam tüm tümü üç üzere var vardı ve veya veyahut ya ya yani yapacak yapılan yapılması yapıyor yaptığı yaptı yedi yerine yetmiş yine yirmi yoksa yüz zaten zira
""".split())

FILLERS = set("""
umm uhh like you know i mean sort of kind of basically actually literally right okay so well
yani evet hayır tamam şimdi mesela örneğin aslında falan filan ııı ee şey işte hani
""".split())

BANTER_HINTS = [
    "how are you", "guys", "everyone", "good morning", "good afternoon", "weekend", "coffee",
    "let's take a break", "break", "pause", "attendance", "zoom", "microphone", "can you hear",
    "exam", "midterm", "final", "project deadline", "homework", "assignment", "nasılsınız",
    "arkadaşlar", "günaydın", "iyi akşamlar", "hafta sonu", "ara verelim", "mola", "yoklama",
    "sesim geliyor mu", "sınav", "vize", "final", "ödev", "proje"
]


# --- Helpers ---

def clean_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def tokenize(text: str) -> List[str]:
    # Basic tokenization: preserve alphanumeric and apostrophes
    return re.findall(r"[A-Za-z0-9İıŞşÇçĞğÜüÖö']+", (text or "").lower())


def get_ngrams(tokens: List[str], n: int) -> List[str]:
    return [" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)]


def format_seconds(seconds: float) -> str:
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d}"

def parse_seconds(ts_str: str) -> float:
    # HH:MM:SS or MM:SS to seconds
    parts = ts_str.split(":")
    try:
        parts = [float(p) for p in parts]
        if len(parts) == 3:
            return parts[0]*3600 + parts[1]*60 + parts[2]
        if len(parts) == 2:
            return parts[0]*60 + parts[1]
    except:
        pass
    return 0.0


# --- Data Structures ---

class TranscriptBlock:
    def __init__(self, index: int, start_sec: float, end_sec: float, text: str):
        self.index = index
        self.start_sec = start_sec
        self.end_sec = end_sec
        self.text = text
        self.tokens = [w for w in tokenize(text) if w not in STOPWORDS and w not in FILLERS]

    @property
    def duration(self):
        return self.end_sec - self.start_sec

    @property
    def word_count(self):
        return len(self.text.split())


# --- Processing Logic ---

def semantic_segmentation(segments: List[Dict], model, similarity_threshold=0.60, min_dur=60, max_dur=600) -> List[TranscriptBlock]:
    """
    Semantic-aware segmentation: Merge segments until topic similarity drops.
    Uses embeddings to detect when the speaker changes topics.
    
    Args:
        segments: Raw transcript segments with start/end/text
        model: SentenceTransformer model for encoding
        similarity_threshold: Min similarity to stay in same block (default 0.60)
        min_dur: Minimum block duration in seconds (to avoid micro-blocks)
        max_dur: Maximum block duration (hard limit to prevent mega-blocks)
    """
    if not segments:
        return []
    
    blocks = []
    current_segments = []
    current_start = None
    idx = 0
    
    # Encode all segments upfront
    segment_texts = [seg["text"].strip() for seg in segments]
    segment_embeddings = model.encode(segment_texts, normalize_embeddings=True)
    
    for i, seg in enumerate(segments):
        s_sec = parse_seconds(seg["start"])
        e_sec = parse_seconds(seg["end"])
        
        if current_start is None:
            current_start = s_sec
        
        current_segments.append(i)
        
        # Determine if we should close the block
        should_close = False
        
        # Check duration limits
        curr_dur = e_sec - current_start
        if curr_dur >= max_dur:
            should_close = True
        elif curr_dur >= min_dur and i + 1 < len(segments):
            # Only check semantic similarity if we're past minimum duration
            # Compare current block's average embedding with next segment
            current_indices = current_segments
            current_embs = segment_embeddings[current_indices]
            avg_current = current_embs.mean(axis=0)
            next_emb = segment_embeddings[i + 1]
            
            similarity = float(np.dot(avg_current, next_emb))
            
            if similarity < similarity_threshold:
                should_close = True  # Topic changed!
        
        if should_close:
            # Create block from accumulated segments
            block_text = " ".join([segments[j]["text"].strip() for j in current_segments])
            blocks.append(TranscriptBlock(idx, current_start, e_sec, block_text))
            idx += 1
            
            # Reset
            current_segments = []
            current_start = None
    
    # Add remainder
    if current_segments:
        last_end = parse_seconds(segments[-1]["end"])
        if current_start is None:
            current_start = parse_seconds(segments[current_segments[0]]["start"])
        
        block_text = " ".join([segments[j]["text"].strip() for j in current_segments])
        blocks.append(TranscriptBlock(idx, current_start, last_end, block_text))
    
    return blocks


def hybrid_similarity(text_vec, slide_vec, text_tokens, slide_tokens_set):
    """
    Combine Embedding Cosine Sim + Jaccard Sim
    """
    # 1. Cosine Similarity
    # np.dot assumes normalized vectors
    cos_sim = float(np.dot(text_vec, slide_vec))
    # Clamp negative cosine to 0
    cos_sim = max(0.0, cos_sim)
    
    # 2. Jaccard Similarity (Token overlap)
    # Use pre-computed set for slide tokens for speed
    if not text_tokens or not slide_tokens_set:
        jaccard = 0.0
    else:
        intersection = sum(1 for t in text_tokens if t in slide_tokens_set)
        union = len(text_tokens) + len(slide_tokens_set) - intersection
        jaccard = intersection / union if union > 0 else 0.0
        
    # Boost Jaccard because it's usually very low compared to cosine
    # Reduced boost from 4.0 to 2.5 to avoid false positives on generic domain words
    jaccard_boosted = min(1.0, jaccard * 2.5) 
    
    # Weighted Score: 75% Embedding, 25% Word Overlap
    score = (0.75 * cos_sim) + (0.25 * jaccard_boosted)
    return score, cos_sim


def classify_block(sim_score: float, banter_ratio: float, topic_sim: float, deck_mismatch: bool) -> Tuple[str, float, str]:
    """
    Decide status based on hybrid score.
    """
    # 1. Banter override
    if banter_ratio > 0.40 and sim_score < 0.25:
        return "banter", 0.85, f"High banter ({banter_ratio:.2f})"
        
    # 2. Deck Mismatch Penalty
    # If the global deck is wrong, we are very skeptical of "matches"
    if deck_mismatch:
        if sim_score > 0.70: # Increased from 0.65
            return "on_slide", 0.60, "Strong match despite deck mismatch warnings"
        else:
            return "off_slide", 0.90, "Deck mismatch (wrong slides)"

    # 3. Standard thresholds (Tightened)
    if sim_score >= 0.65: # Raised from 0.60 to 0.65 to ensure only "exact" matches get this
        return "on_slide", min(0.99, 0.60 + sim_score), f"Strong match ({sim_score:.2f})"
        
    if 0.42 <= sim_score < 0.65: # Adjusted range top
        return "expanded", 0.75, f"Deep dive / elaboration ({sim_score:.2f})"
        
    if 0.25 <= sim_score < 0.42: # Adjusted range
        # FIX #6: Side topic threshold - More strict to avoid cross-chapter confusion
        # Side topic means: related to THIS specific lecture topic, not just same course
        # Raised threshold to 0.40 to ensure tight coupling
        if topic_sim > 0.40: # Increased from 0.35
            return "side_topic", 0.65, f"Related concept (topic={topic_sim:.2f}, slide={sim_score:.2f})"
        else:
            return "off_slide", 0.70, f"Low relevance (topic={topic_sim:.2f}, slide={sim_score:.2f})"
            
    return "off_slide", 0.60, f"No match found ({sim_score:.2f})"


def extract_topic_ngrams(text: str, n=2, top_k=20) -> List[str]:
    # Extract bi-grams and tri-grams
    tokens = [w for w in tokenize(text) if w not in STOPWORDS and w not in FILLERS and len(w)>2]
    
    grams = get_ngrams(tokens, n)
    counts = Counter(grams)
    
    # Filter out rare ones - require at least 4 occurrences for quality
    min_count = 4 if len(tokens) > 100 else 3
    valid = {g: c for g, c in counts.items() if c >= min_count}
    
    # Quality filter: Remove low-quality n-grams
    def is_quality_ngram(gram: str) -> bool:
        words = gram.split()
        # At least one word should be "substantial" (>4 chars)
        if not any(len(w) > 4 for w in words):
            return False
        # Reject if contains too many common verbs/auxiliaries/noise
        common_junk = {
            'will', 'just', 'like', 'much', 'make', 'take', 'thing', 'time',
            'first', 'second', 'third', 'two', 'three', 'hours', 'minutes',
            'job', 'abacus', 'whole', 'very', 'quite', 'really', 'always'
        }
        if sum(1 for w in words if w in common_junk) >= len(words) / 2:
            return False
        return True
    
    filtered = {g: c for g, c in valid.items() if is_quality_ngram(g)}
    
    # Sort by frequency
    return [k for k, v in sorted(filtered.items(), key=lambda item: item[1], reverse=True)[:top_k]]


def clean_slide_text(text: str) -> str:
    # Remove AI metadata lines to improve embedding quality
    lines = text.splitlines()
    cleaned = []
    for line in lines:
        s = clean_ws(line)
        if s.startswith("> 🤖") or s.startswith("--- Slide") or s.startswith("> -"):
            # Try to save content summary if present
            if "Content summary" in s:
                m = re.search(r"\{([^}]+)\}", s)
                if m: cleaned.append(m.group(1))
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcript", required=True)
    ap.add_argument("--slides", required=True)
    ap.add_argument("--title", default="")
    ap.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2")
    args = ap.parse_args()

    # 1. Read Inputs
    with open(args.transcript, encoding="utf-8") as f:
        raw_transcript = f.read()
    with open(args.slides, encoding="utf-8") as f:
        raw_slides = f.read()
        
    clean_slides = clean_slide_text(raw_slides)
    
    # 2. Parse Transcript & Segment Adaptively
    # We parse the timestamped lines first
    # Regex for [MM:SS - MM:SS] Text
    rx = re.compile(r"^\[(?P<a>[^]\-]+)\s*[-–]\s*(?P<b>[^]]+)\]\s*(?P<txt>.*)$")
    
    parsed_segments = []
    for line in raw_transcript.splitlines():
        m = rx.match(line.strip())
        if m:
            parsed_segments.append({
                "start": m.group("a").strip(),
                "end": m.group("b").strip(),
                "text": m.group("txt").strip()
            })
            
    if not parsed_segments:
        # Fallback for non-timestamped text
        parsed_segments = [{"start": "00:00:00", "end": "00:05:00", "text": clean_ws(raw_transcript)}]

    # 3. Load Model EARLY (needed for semantic segmentation)
    st = SentenceTransformer(args.model)

    # Create Blocks (Semantic-Aware Topic Detection)
    # Detects topic changes using embedding similarity
    blocks = semantic_segmentation(
        parsed_segments, 
        model=st,
        similarity_threshold=0.50,  # Topic change if similarity < 50% (relaxed)
        min_dur=120,  # Min 2 minutes per block (prevent micro-blocks)
        max_dur=900   # Max 15 minutes per block
    )
    
    # 4. Prepare Embeddings
    
    # Slide Chunks
    # Split slides into chunks (e.g. per slide or by word count)
    # Since we stripped "--- Slide", we'll just chunk by words
    slide_words = clean_ws(clean_slides).split()
    slide_chunks_text = [" ".join(slide_words[i:i+200]) for i in range(0, len(slide_words), 200)]
    if not slide_chunks_text: slide_chunks_text = ["Empty Slides"]
    
    slide_vecs = st.encode(slide_chunks_text, normalize_embeddings=True)
    
    # FIX #3: Topic Vector - Use multiple representative chunks instead of just first 1000 chars
    # Select technical content chunks (avoid intro/TOC bias)
    topic_chunks = []
    if args.title:
        topic_chunks.append(args.title)
    
    # Take middle chunks (avoid intro and conclusion)
    if len(slide_chunks_text) > 3:
        # Use chunks from positions 25%, 50%, 75% of slides
        indices = [len(slide_chunks_text) // 4, len(slide_chunks_text) // 2, 3 * len(slide_chunks_text) // 4]
        topic_chunks.extend([slide_chunks_text[i] for i in indices if i < len(slide_chunks_text)])
    else:
        topic_chunks.extend(slide_chunks_text)
    
    topic_text = " ".join(topic_chunks)
    topic_vec = st.encode([topic_text], normalize_embeddings=True)[0]
    
    # 4. Global Mismatch Check (First 3 mins of transcript)
    intro_text = " ".join([b.text for b in blocks[:2]]) # First 1-2 blocks
    intro_vec = st.encode([intro_text or "empty"], normalize_embeddings=True)[0]
    deck_sim = float(np.dot(topic_vec, intro_vec))
    
    # Increased threshold from 0.28 to 0.35 to strictly catch wrong chapters within same domain
    is_deck_mismatch = deck_sim < 0.35
    
    # 5. Process Blocks
    results = []
    # FIX #1: Initialize Counter with all possible status types to ensure frontend gets complete data
    counts = Counter({
        "on_slide": 0,
        "expanded": 0,
        "side_topic": 0,
        "off_slide": 0,
        "banter": 0
    })
    
    # Pre-tokenize slide chunks for Jaccard
    slide_chunks_tokens = [set(tokenize(c)) for c in slide_chunks_text]

    for block in blocks:
        # Encode block
        block_vec = st.encode([block.text], normalize_embeddings=True)[0]
        
        # Compare with all slide chunks
        # 1. Cosine
        cos_sims = np.dot(slide_vecs, block_vec)
        
        # 2. Hybrid Calculation for best match
        best_score = -1.0
        best_chunk_idx = -1
        
        # Only check top 3 cosine matches to save time on Jaccard
        # or check all if small.
        top_indices = np.argsort(cos_sims)[-5:] # Top 5
        
        for idx in top_indices:
            score, _ = hybrid_similarity(
                block_vec, slide_vecs[idx], 
                block.tokens, slide_chunks_tokens[idx]
            )
            if score > best_score:
                best_score = score
                best_chunk_idx = idx
                
        # Topic relevance
        topic_rel = float(np.dot(topic_vec, block_vec))
        
        # FIX #5: Banter check - More sophisticated to avoid academic false positives
        banter_text = block.text.lower()
        # Only count banter if it appears in beginning/end (greetings/closings)
        # or if multiple banter phrases cluster together
        banter_hits = 0
        words = banter_text.split()
        first_50 = " ".join(words[:50]) if len(words) > 50 else banter_text
        last_50 = " ".join(words[-50:]) if len(words) > 50 else ""
        
        for hint in BANTER_HINTS:
            if hint in first_50 or hint in last_50:
                banter_hits += 1
        
        # Reduce weight if block is long and technical
        word_count = len(words)
        if word_count > 100:
            banter_hits = banter_hits * 0.5  # Longer blocks are less likely to be pure banter
        
        banter_ratio = min(1.0, banter_hits / 5.0)
        
        status, conf, reason = classify_block(best_score, banter_ratio, topic_rel, is_deck_mismatch)
        
        counts[status] += 1
        
        results.append({
            "index": block.index,
            "start": format_seconds(block.start_sec),
            "end": format_seconds(block.end_sec),
            "text": block.text,
            "slideCoverage": round(best_score, 4),
            "topicRelevance": round(topic_rel, 4),
            "banterScore": round(banter_ratio, 4),
            "status": status,
            "confidence": round(conf, 2),
            "reason": reason
        })

    # 6. Interpret & Summarize
    total = len(blocks)
    if total == 0: total = 1
    
    percent = {k: round((v/total)*100, 1) for k, v in counts.items()}
    
    # Score calculation
    # on_slide(100), expanded(85), side_topic(50), off_slide(20), banter(ignored if small)
    w_sum = (counts["on_slide"] * 100) + (counts["expanded"] * 85) + \
            (counts["side_topic"] * 50) + (counts["off_slide"] * 20)
    
    overall_score = int(w_sum / total)
    

    # FIX #2: Missed / Extra Topics via N-grams
    # Use ALL transcript content, not just on_slide/expanded to avoid false "missed" topics
    # 1. Slide n-grams
    slide_ngrams = set(extract_topic_ngrams(clean_slides, n=2, top_k=50))
    
    # 2. Transcript n-grams (from ALL blocks except pure banter)
    all_lecture_text = " ".join([r["text"] for r in results if r["status"] != "banter"])
    trans_ngrams = set(extract_topic_ngrams(all_lecture_text, n=2, top_k=50))
    
    missed = list(slide_ngrams - trans_ngrams)[:8]
    
    # Extra (from off_slide blocks)
    extra_text = " ".join([r["text"] for r in results if r["status"] == "off_slide"])
    extra_ngrams = set(extract_topic_ngrams(extra_text, n=2, top_k=30))
    extra = list(extra_ngrams - slide_ngrams)[:8]
    
    # Penalties (Applied after identifying missed topics)
    if is_deck_mismatch: 
        overall_score = min(overall_score, 30)
    elif missed:
        # UX Rule: If topics are missed, score cannot be Excellent (>80)
        overall_score = min(overall_score, 75)
    
    interpretation = "Analysis Complete."
    if is_deck_mismatch:
        interpretation = "⚠️ Deck Mismatch Detected - High deviation likely due to wrong slides."
    elif overall_score >= 85 and not missed:
        interpretation = "Excellent Match - Lecture follows slides closely."
    elif overall_score > 60:
        interpretation = "Good Match - Lecture covers slides with some expansions."
    elif overall_score > 40:
        interpretation = "Fair Match - Significant deviations or side topics."
    else:
        interpretation = "Low Match - Lecture diverges significantly."

    summary = {
        "totalSegments": total,
        "overallScore": overall_score,
        "interpretation": interpretation,
        "percent": percent,
        "counts": dict(counts),
        "missedTopics": missed,
        "extraTopics": extra,
        "isDeckMismatch": is_deck_mismatch,
        "deckSimilarity": round(deck_sim, 4)
    }

    print(json.dumps({"ok": True, "summary": summary, "segments": results}, ensure_ascii=True))


if __name__ == "__main__":
    main()
