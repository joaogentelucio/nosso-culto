#!/usr/bin/env python3
"""Promote a trained speech model ONLY after measurable QA and format tests.

This tool never performs ONNX/GGML export and never invents metrics.
A release still requires maintainer review and application-level testing.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import sys


def load(path: Path):
    if not path.is_file():
        raise ValueError(f"Relatório inexistente: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Relatório inválido: {path}")
    return data


def validate_reports(training: dict, timing: dict):
    if training.get("quality_gate_passed") is not True:
        raise ValueError("O candidato não passou no teste independente de palavras.")
    if timing.get("timing_gate_passed") is not True:
        raise ValueError("O candidato não passou no teste independente de tempos.")
    before, after = training.get("baseline_test_wer"), training.get("candidate_test_wer")
    if type(before) not in (int, float) or type(after) not in (int, float):
        raise ValueError("WER original e candidato precisam ser números reais.")
    if not math.isfinite(before) or not math.isfinite(after) or before <= after:
        raise ValueError("O candidato precisa melhorar o WER em um teste independente.")
    mean = timing.get("mean_absolute_start_error_seconds")
    coverage = timing.get("coverage")
    if type(mean) not in (int, float) or type(coverage) not in (int, float):
        raise ValueError("A avaliação precisa medir erro médio de tempo e cobertura.")
    if not math.isfinite(mean) or mean > 0.5 or not math.isfinite(coverage) or coverage < 0.9:
        raise ValueError("É necessário <=0,5s de erro médio e >=90% de cobertura.")


def promote(args):
    training = load(args.training_report)
    timing = load(args.timing_report)
    validate_reports(training, timing)
    if not args.confirmed_runtime_tests:
        raise ValueError("Exige --confirmed-runtime-tests após execução real na plataforma de destino.")
    if args.target == "web":
        if not args.onnx_verified:
            raise ValueError("Confirme --onnx-verified após testar os pesos no Transformers.js.")
        if not args.model_id or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.model_id):
            raise ValueError("Informe um repositório de modelo versionado: --model-id org/model.")
        release = {
            "schema_version": 1,
            "model_id": args.model_id,
            "quality_gate_passed": True,
            "timing_gate_passed": True,
            "browser_export_verified": True,
            "status": "custom-validated"
        }
        destination = args.output or Path("public/ai/active-model.json")
    else:
        if not args.ggml_verified:
            raise ValueError("Confirme --ggml-verified após testar os pesos no whisper.cpp.")
        source = args.weights
        if not source or not source.is_file() or not 50_000_000 <= source.stat().st_size <= 3_000_000_000:
            raise ValueError("Arquivo GGML ausente ou incompatível em tamanho.")
        directory = args.output or Path("build-tools/transcription/models")
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / "ggml-nosso-culto-ai.bin"
        if source.resolve() != target.resolve():
            shutil.copy2(source, target)
        digest = hashlib.sha256()
        with target.open("rb") as handle:
            for part in iter(lambda: handle.read(4 * 1024 * 1024), b""):
                digest.update(part)
        release = {
            "schema_version": 1,
            "filename": target.name,
            "quality_gate_passed": True,
            "timing_gate_passed": True,
            "ggml_export_verified": True,
            "sha256": digest.hexdigest(),
            "baseline_test_wer": training["baseline_test_wer"],
            "candidate_test_wer": training["candidate_test_wer"],
            "mean_absolute_start_error_seconds": timing["mean_absolute_start_error_seconds"]
        }
        destination = directory / "release.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    print(f"Manifesto de ativação criado em {destination}. Revise antes de publicar.")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--target", required=True, choices=["web", "desktop"])
    p.add_argument("--training-report", required=True, type=Path)
    p.add_argument("--timing-report", required=True, type=Path)
    p.add_argument("--output", type=Path)
    p.add_argument("--model-id", help="Identificador do modelo ONNX publicado, org/model")
    p.add_argument("--weights", type=Path, help="Arquivo GGML exportado e testado")
    p.add_argument("--onnx-verified", action="store_true")
    p.add_argument("--ggml-verified", action="store_true")
    p.add_argument("--confirmed-runtime-tests", action="store_true")
    args = p.parse_args()
    try:
        promote(args)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"Modelo NÃO aprovado: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
