"""
Fine-tuning script for the BERT-based intent classifier.

Usage:
    python -m neural_engine.training.train_classifier \
        --data_path data/notifications.jsonl \
        --output_dir neural_engine/models/intent_classifier \
        --epochs 5

Data format (JSONL):
    {"text": "Submit assignment before midnight", "label": 1}
    label: 0=Urgent, 1=Academic, 2=Ignore
"""
import argparse
import json
from pathlib import Path

import numpy as np


def load_dataset(data_path: str):
    texts, labels = [], []
    with open(data_path) as f:
        for line in f:
            item = json.loads(line)
            texts.append(item["text"])
            labels.append(int(item["label"]))
    return texts, labels


def train(data_path: str, output_dir: str, epochs: int = 5, batch_size: int = 16):
    from transformers import (
        AutoModelForSequenceClassification,
        AutoTokenizer,
        Trainer,
        TrainingArguments,
    )
    import torch
    from torch.utils.data import Dataset

    class NotifDataset(Dataset):
        def __init__(self, encodings, labels):
            self.encodings = encodings
            self.labels = labels

        def __len__(self):
            return len(self.labels)

        def __getitem__(self, idx):
            item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}
            item["labels"] = torch.tensor(self.labels[idx])
            return item

    BASE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL, num_labels=3, ignore_mismatched_sizes=True
    )

    texts, labels = load_dataset(data_path)
    encodings = tokenizer(texts, truncation=True, padding=True, max_length=128)
    dataset = NotifDataset(encodings, labels)

    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        save_strategy="epoch",
        logging_steps=10,
        load_best_model_at_end=False,
    )
    trainer = Trainer(model=model, args=training_args, train_dataset=dataset)
    trainer.train()

    tokenizer.save_pretrained(output_dir)
    model.save_pretrained(output_dir)
    print(f"Model saved to {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_path", required=True)
    parser.add_argument("--output_dir", default="neural_engine/models/intent_classifier")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch_size", type=int, default=16)
    args = parser.parse_args()
    train(args.data_path, args.output_dir, args.epochs, args.batch_size)
