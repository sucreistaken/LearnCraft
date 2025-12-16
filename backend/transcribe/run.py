import argparse, json, os, subprocess, sys
from faster_whisper import WhisperModel

def ffprobe_duration(path: str) -> float:
    out = subprocess.check_output([
        "ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=noprint_wrappers=1:nokey=1", path
    ], text=True).strip()
    return float(out)

def to_wav_16k_mono(src: str, dst: str):
    """
    Convert to 16k mono WAV + basic cleanup.
    This usually helps with:
      - low volume recordings
      - background hum (AC/fan)
      - mild noise
    """
    # Audio cleanup chain (balanced, not too aggressive):
    # - highpass/lowpass: remove rumble + harsh high noise
    # - afftdn: FFT denoise
    # - acompressor: stabilize speech loudness
    # - dynaudnorm: normalize dynamics (prevents "too quiet" parts)
    af = (
        "highpass=f=80,"
        "lowpass=f=8000,"
        "afftdn=nf=-25,"
        "acompressor=threshold=-18dB:ratio=3:attack=5:release=50,"
        "dynaudnorm=f=150:g=15"
    )

    subprocess.check_call(
        ["ffmpeg", "-y", "-i", src, "-ac", "1", "-ar", "16000", "-af", af, dst],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--model", default=os.getenv("WHISPER_MODEL", "small"))
    ap.add_argument("--device", default=os.getenv("WHISPER_DEVICE", "cpu"))
    ap.add_argument("--compute", default=os.getenv("WHISPER_COMPUTE", "int8"))
    ap.add_argument("--lang", default="en")
    args = ap.parse_args()

    src = args.input
    wav = args.input + ".16k.clean.wav"

    # Convert + clean
    to_wav_16k_mono(src, wav)

    # Duration for progress calc
    dur = ffprobe_duration(wav)
    print(json.dumps({"type":"meta","duration":dur,"model":args.model}, ensure_ascii=False), flush=True)

    # Whisper
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute)

    # Some safe quality settings:
    # - beam_size=5: better decoding (a bit slower)
    # - temperature=0.0: more stable output
    # - vad_filter=True: skip silence
    segments, _info = model.transcribe(
        wav,
        language=args.lang,
        vad_filter=True,
        beam_size=5,
        temperature=0.0
    )

    last_end = 0.0
    for seg in segments:
        start = float(seg.start)
        end = float(seg.end)
        text = (seg.text or "").strip()

        last_end = max(last_end, end)
        progress = min(1.0, last_end / max(dur, 1e-6))

        print(json.dumps({
            "type":"segment",
            "start":start,"end":end,
            "text":text,
            "progress":progress
        }, ensure_ascii=False), flush=True)

    print(json.dumps({"type":"done","progress":1.0}, ensure_ascii=False), flush=True)

    # cleanup
    try:
        os.remove(wav)
    except:
        pass

if __name__ == "__main__":
    main()
