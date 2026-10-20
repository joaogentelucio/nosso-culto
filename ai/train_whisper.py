#!/usr/bin/env python3
"""Fine-tune a Whisper singing recognizer and compare it against its baseline.

Only approved, segmented recordings prepared with prepare_dataset.py can be used.
Run on a CUDA GPU. No checkpoint is automatically shipped to users.
"""
import argparse
import json
import math
from pathlib import Path
import random

def load_manifest(folder: Path, split: str) -> list[dict]:
    path = folder / f"{split}.jsonl"
    if not path.is_file():
        raise ValueError(f"Faltando {path}; prepare os dados primeiro.")
    data = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not data:
        raise ValueError(f"Conjunto {split} está vazio.")
    for row in data:
        if not Path(row["audio"]).is_file() or not row["text"].strip():
            raise ValueError(f"Áudio ausente ou letra vazia no conjunto {split}.")
    return data


def train(args):
    import torch
    import librosa
    from datasets import Dataset
    from transformers import (
        WhisperForConditionalGeneration, WhisperProcessor,
        Seq2SeqTrainer, Seq2SeqTrainingArguments
    )
    from jiwer import wer

    if not torch.cuda.is_available() and not args.allow_cpu:
        raise RuntimeError("Treinamento exige GPU CUDA. Use --allow-cpu somente para testes pequenos.")
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    train_rows = load_manifest(args.data, "train")
    valid_rows = load_manifest(args.data, "validation")
    test_rows = load_manifest(args.data, "test")
    sets = [train_rows, valid_rows, test_rows]
    recordings = [{row["recording"] for row in rows} for rows in sets]
    if recordings[0] & recordings[1] or recordings[0] & recordings[2] or recordings[1] & recordings[2]:
        raise ValueError("Vazamento de gravações entre treino, validação e teste.")

    processor = WhisperProcessor.from_pretrained(
        args.base_model, language="Portuguese", task="transcribe")
    model = WhisperForConditionalGeneration.from_pretrained(args.base_model)
    model.generation_config.language = "portuguese"
    model.generation_config.task = "transcribe"
    model.generation_config.forced_decoder_ids = None
    model.config.forced_decoder_ids = None

    def preprocess(row):
        samples, sr = librosa.load(row["audio"], sr=16000, mono=True)
        if not 16000 <= len(samples) <= 16000 * 30:
            raise ValueError(f"Trecho precisa ter de 1 a 30 segundos: {row['audio']}")
        features = processor.feature_extractor(samples, sampling_rate=16000).input_features[0]
        target = processor.tokenizer(row["text"], truncation=True,
                                     max_length=225).input_ids
        return {"input_features": features, "labels": target}

    def dataset(rows):
        return Dataset.from_list(rows).map(preprocess, remove_columns=list(rows[0]),
                                           num_proc=1, desc="Extraindo características acústicas")

    train_ds, valid_ds, test_ds = [dataset(rows) for rows in sets]

    class Collator:
        def __call__(self, records):
            features = processor.feature_extractor.pad(
                [{"input_features": item["input_features"]} for item in records],
                return_tensors="pt")
            labels = processor.tokenizer.pad(
                [{"input_ids": item["labels"]} for item in records],
                return_tensors="pt")
            target = labels["input_ids"].masked_fill(labels.attention_mask.ne(1), -100)
            if (target[:, 0] == processor.tokenizer.bos_token_id).all().item():
                target = target[:, 1:]
            features["labels"] = target
            return features

    def calculate_metrics(predictions):
        guesses = predictions.predictions
        if isinstance(guesses, tuple):
            guesses = guesses[0]
        labels = predictions.label_ids.copy()
        labels[labels == -100] = processor.tokenizer.pad_token_id
        predicted_text = processor.tokenizer.batch_decode(guesses, skip_special_tokens=True)
        correct_text = processor.tokenizer.batch_decode(labels, skip_special_tokens=True)
        score = wer([t.lower().strip() for t in correct_text],
                    [t.lower().strip() for t in predicted_text])
        return {"wer": float(score)}

    args.output.mkdir(parents=True, exist_ok=True)
    # The holdout is scored on the untouched base model, then on the trained
    # candidate. It is NEVER used for gradient updates or choosing checkpoints.
    parameters = Seq2SeqTrainingArguments(
        output_dir=str(args.output / "checkpoints"),
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=args.accumulation,
        learning_rate=args.learning_rate,
        warmup_steps=min(100, max(0, args.epochs * len(train_rows) // 20)),
        num_train_epochs=args.epochs,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="wer",
        greater_is_better=False,
        predict_with_generate=True,
        generation_max_length=225,
        fp16=torch.cuda.is_available(),
        gradient_checkpointing=True,
        report_to="none",
        remove_unused_columns=False,
        logging_steps=10,
        seed=args.seed
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=parameters,
        data_collator=Collator(),
        train_dataset=train_ds,
        eval_dataset=valid_ds,
        processing_class=processor,
        compute_metrics=calculate_metrics
    )

    baseline = trainer.predict(test_ds, metric_key_prefix="baseline")
    baseline_wer = float(baseline.metrics["baseline_wer"])
    if not math.isfinite(baseline_wer):
        raise RuntimeError("Avaliação do modelo original retornou WER inválido.")
    trainer.train()
    candidate = trainer.predict(test_ds, metric_key_prefix="candidate")
    candidate_wer = float(candidate.metrics["candidate_wer"])
    if not math.isfinite(candidate_wer):
        raise RuntimeError("Avaliação do modelo treinado retornou WER inválido.")
    improvement = (baseline_wer - candidate_wer) / max(baseline_wer, 0.000001)
    approved = candidate_wer <= args.max_wer and improvement >= args.min_gain

    # Preserve the trained weights even when not approved; production promotion
    # is always a separate deliberate, versioned step.
    candidate_path = args.output / "candidate"
    trainer.save_model(str(candidate_path))
    processor.save_pretrained(str(candidate_path))
    report = {
        "base_model": args.base_model, "candidate_path": str(candidate_path),
        "train_clips": len(train_rows), "validation_clips": len(valid_rows),
        "test_clips": len(test_rows), "baseline_test_wer": round(baseline_wer, 5),
        "candidate_test_wer": round(candidate_wer, 5),
        "relative_wer_improvement": round(improvement, 5),
        "quality_gate_passed": approved, "exported_to_browser_onnx": False,
        "released_to_users": False,
        "notice": "WER mede palavras, não sincronização temporal. Avalie início dos versos separadamente."
    }
    (args.output / "quality-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not approved:
        print("Modelo salvo para pesquisa, mas NÃO aprovado para ativação em produção.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("ai/data/ready"))
    parser.add_argument("--output", type=Path, default=Path("ai/runs/whisper-pt-canto"))
    parser.add_argument("--base-model", default="openai/whisper-small")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--accumulation", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--max-wer", type=float, default=0.35)
    parser.add_argument("--min-gain", type=float, default=0.10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--allow-cpu", action="store_true")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.accumulation < 1:
        parser.error("epochs, batch-size e accumulation devem ser positivos.")
    if not 0 <= args.max_wer <= 2 or not 0 <= args.min_gain <= 1:
        parser.error("max-wer e min-gain fora dos limites.")
    train(args)


if __name__ == "__main__":
    main()
