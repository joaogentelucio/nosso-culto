#!/usr/bin/env python3
"""Prepare consented song clips for Nosso Culto AI Whisper fine-tuning.

Input JSONL per annotated verse/phrase:
{"recording":"album/track.wav","start":12.3,"end":21.8,"text":"Jesus é meu Senhor","split":"train","licensed":true}
Allowed splits: train, validation, test. A recording cannot cross splits.
The script does not discover lyrics, invent timestamps, or download copyrighted audio.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

SPLITS = {"train", "validation", "test"}
EXTENSIONS = {".wav", ".flac", ".mp3", ".ogg", ".m4a", ".aac", ".opus"}


def within_root(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative.strip():
        raise ValueError("Arquivo de gravação obrigatório.")
    absolute = (root / relative).resolve()
    if not absolute.is_relative_to(root.resolve()) or absolute.suffix.lower() not in EXTENSIONS:
        raise ValueError(f"Caminho ou formato de gravação inválido: {relative}")
    if not absolute.is_file():
        raise ValueError(f"Arquivo não encontrado: {relative}")
    return absolute


def validate_row(row: dict, source_root: Path) -> dict:
    if not isinstance(row, dict):
        raise ValueError("Cada linha deve ser um objeto JSON.")
    if row.get("licensed") is not True:
        raise ValueError("Os dados exigem autorização de uso documentada: licensed=true.")
    recording = row.get("recording")
    original = within_root(source_root, recording)
    split = row.get("split")
    if split not in SPLITS:
        raise ValueError("A divisão deve ser train, validation ou test.")
    text = row.get("text")
    if not isinstance(text, str) or not text.strip() or len(text) > 2500:
        raise ValueError("Texto transcrito obrigatório e revisado, até 2.500 caracteres.")
    start, end = row.get("start"), row.get("end")
    if type(start) not in (int, float) or type(end) not in (int, float):
        raise ValueError("Início e fim devem ser segundos numéricos.")
    if not math.isfinite(start) or not math.isfinite(end) or start < 0 or not (1 <= end-start <= 30):
        raise ValueError("Cada trecho deve ter entre 1 e 30 segundos, com tempos válidos.")
    return {"recording": str(recording), "original": original, "split": split,
            "start": float(start), "end": float(end), "text": text.strip()}


def prepare(manifest: Path, source_root: Path, output: Path, ffmpeg: str) -> dict:
    if not manifest.is_file():
        raise ValueError(f"Manifesto não encontrado: {manifest}")
    rows = []
    ownership = {}
    for number, line in enumerate(manifest.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = validate_row(json.loads(line), source_root)
            recording = str(row["original"])
            if recording in ownership and ownership[recording] != row["split"]:
                raise ValueError("A mesma gravação não pode aparecer em train e validation/test.")
            ownership[recording] = row["split"]
            rows.append(row)
        except (ValueError, json.JSONDecodeError) as error:
            raise ValueError(f"Linha {number}: {error}") from error
    if not rows:
        raise ValueError("Nenhum trecho autorizado encontrado.")
    counts = {name: 0 for name in SPLITS}
    for row in rows:
        counts[row["split"]] += 1
    if not all(counts.values()):
        raise ValueError("É obrigatório fornecer treino, validação e teste de gravações distintas.")
    output.mkdir(parents=True, exist_ok=True)
    prepared = {name: [] for name in SPLITS}
    for row in rows:
        digest = hashlib.sha256(
            f"{row['recording']}:{row['start']:.3f}:{row['end']:.3f}".encode()
        ).hexdigest()[:20]
        path = output / "clips" / f"{digest}.wav"
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            command = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                       "-ss", str(row["start"]), "-i", str(row["original"]),
                       "-t", str(row["end"] - row["start"]),
                       "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(path)]
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            if result.returncode != 0 or not path.is_file() or path.stat().st_size < 44:
                raise RuntimeError(f"Falha ao preparar {row['recording']}: {result.stderr[-800:]}")
        prepared[row["split"]].append({
            "audio": str(path.resolve()), "text": row["text"],
            "recording": row["recording"], "start": row["start"], "end": row["end"]
        })
    for name, values in prepared.items():
        with (output / f"{name}.jsonl").open("w", encoding="utf-8") as handle:
            for item in values:
                handle.write(json.dumps(item, ensure_ascii=False) + "\n")
    summary = {"counts": {k: len(v) for k, v in prepared.items()},
               "recordings": len(ownership),
               "seconds": round(sum(r["end"]-r["start"] for r in rows), 1)}
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2),
                                         encoding="utf-8")
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("ai/data/ready"))
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.manifest, args.source_root, args.output, args.ffmpeg),
                         ensure_ascii=False, indent=2))
    except (ValueError, RuntimeError, OSError) as error:
        print(f"Erro na preparação: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
