#!/usr/bin/env python3
"""Evaluate verse onset predictions against annotated audio references.

Input JSONL:
{"recording":"track1.wav","reference":[{"time":12.4,"text":"Senhor eu te amo"}],
 "prediction":[{"time":12.7,"text":"Senhor eu te amo"}]}

Match repeated choruses in order, without inventing timestamps for missing lines.
Evaluate only held-out recordings, not audio used for training.
"""
import argparse
import json
import math
from pathlib import Path
import re
import unicodedata


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFD", value.casefold())
    value = "".join(x for x in value if not unicodedata.combining(x))
    return " ".join(re.findall(r"[a-z0-9]+", value))


def check_verses(values, key):
    if not isinstance(values, list) or not values:
        raise ValueError(f"{key} precisa conter ao menos um verso.")
    last = -1
    for value in values:
        if not isinstance(value, dict) or type(value.get("time")) not in (int, float) or not math.isfinite(value["time"]):
            raise ValueError(f"{key} tem tempo inválido.")
        if value["time"] <= last:
            raise ValueError(f"{key} precisa estar em ordem cronológica, sem duplicados.")
        if not isinstance(value.get("text"), str) or not normalize(value["text"]):
            raise ValueError(f"{key} tem texto inválido.")
        last = value["time"]


def score_file(path: Path, max_error: float = 0.5, min_coverage: float = 0.90):
    if not path.is_file():
        raise ValueError(f"Arquivo de avaliação não encontrado: {path}")
    errors = []
    total = 0
    recording_ids = set()
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
            if not isinstance(entry.get("recording"), str) or not entry["recording"]:
                raise ValueError("Identificador de gravação obrigatório.")
            if entry["recording"] in recording_ids:
                raise ValueError("Gravação duplicada no teste.")
            recording_ids.add(entry["recording"])
            expected, actual = entry.get("reference"), entry.get("prediction")
            check_verses(expected, "reference")
            check_verses(actual, "prediction")
            j = 0
            for true in expected:
                total += 1
                while j < len(actual) and normalize(actual[j]["text"]) != normalize(true["text"]):
                    j += 1
                if j == len(actual):
                    continue
                errors.append(abs(actual[j]["time"] - true["time"]))
                j += 1
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            raise ValueError(f"Linha {number}: {error}") from error
    if total == 0:
        raise ValueError("Nenhum verso de referência encontrado.")
    coverage = len(errors) / total
    mae = sum(errors) / max(1, len(errors))
    passed = coverage >= min_coverage and mae <= max_error
    return {
        "recordings": len(recording_ids), "reference_verses": total,
        "matched_verses": len(errors), "coverage": round(coverage, 5),
        "mean_absolute_start_error_seconds": round(mae, 5),
        "max_allowed_mean_error_seconds": max_error, "required_coverage": min_coverage,
        "timing_gate_passed": passed
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("ai/runs/timing-quality.json"))
    parser.add_argument("--max-error", type=float, default=0.5)
    parser.add_argument("--min-coverage", type=float, default=0.90)
    args = parser.parse_args()
    if args.max_error <= 0 or not 0 < args.min_coverage <= 1:
        parser.error("Limites de avaliação inválidos.")
    report = score_file(args.input, args.max_error, args.min_coverage)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
