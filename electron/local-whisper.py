#!/usr/bin/env python3
"""Offline CPU transcription worker. No external API is contacted.
The model is downloaded once, then reused from the local user profile.
Only one JSON result is emitted to stdout; diagnostic messages go to stderr.
"""
import json
import sys
from pathlib import Path

def main():
    if len(sys.argv) != 6:
        raise ValueError("Argumentos inválidos para o motor local.")
    audio, language, model_size, cache_dir, max_size = sys.argv[1:]
    if model_size not in {"tiny", "base", "small"}:
        raise ValueError("Modelo local inválido.")
    if language not in {"auto", "pt", "en", "es"}:
        raise ValueError("Idioma inválido.")
    if not Path(audio).is_file():
        raise ValueError("Arquivo de música não encontrado.")
    cache = Path(cache_dir)
    cache.mkdir(parents=True, exist_ok=True)

    from faster_whisper import WhisperModel
    model = WhisperModel(model_size, device="cpu", compute_type="int8", download_root=str(cache))
    segments, info = model.transcribe(
        audio,
        language=None if language == "auto" else language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    words = []
    fallback_segments = []
    for segment in segments:
        if len(fallback_segments) >= 2000:
            break
        phrase = str(segment.text).strip()
        if phrase:
            fallback_segments.append({
                "start": float(segment.start), "end": float(segment.end), "text": phrase
            })
        for word in segment.words or []:
            if len(words) >= 12000:
                break
            text = str(word.word).strip()
            if text:
                words.append({
                    "start": float(word.start), "end": float(word.end), "word": text
                })
    print(json.dumps({
        "words": words,
        "segments": fallback_segments,
        "duration": float(info.duration or 0),
        "language": str(info.language or ""),
    }, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except ImportError as ex:
        print("Falta o pacote faster-whisper. Instale com: py -3 -m pip install faster-whisper", file=sys.stderr)
        sys.exit(4)
    except Exception as ex:
        print(str(ex), file=sys.stderr)
        sys.exit(2)
