"""
Neural Engine – FastAPI microservice
=====================================
Exposes:
  POST /classify         – BERT-based intent classification
  POST /generate_reply   – AI auto-reply generator
  GET  /rl/difficulty    – RL-derived lock difficulty for a user
"""
from fastapi import FastAPI
from neural_engine.inference.classifier import IntentClassifier
from neural_engine.inference.reply_generator import ReplyGenerator
from neural_engine.training.rl_agent import FocusRLAgent
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="NeuralCommander – Neural Engine", version="1.0.0")

classifier = IntentClassifier()
reply_gen = ReplyGenerator()
rl_agent = FocusRLAgent()


class ClassifyRequest(BaseModel):
    package_name: str
    title: str
    body: str


class ReplyRequest(BaseModel):
    sender: str
    message: str


@app.post("/classify")
def classify(req: ClassifyRequest):
    category = classifier.predict(req.package_name, req.title, req.body)
    return {"category": category}


@app.post("/generate_reply")
def generate_reply(req: ReplyRequest):
    reply = reply_gen.generate(req.sender, req.message)
    return {"reply": reply}


@app.get("/rl/difficulty/{user_id}")
def get_difficulty(user_id: int):
    difficulty = rl_agent.get_difficulty(user_id)
    return {"user_id": user_id, "lock_difficulty": difficulty}


@app.post("/rl/update/{user_id}")
def update_rl(user_id: int, bypass_count: int):
    new_difficulty = rl_agent.update(user_id, bypass_count)
    return {"user_id": user_id, "lock_difficulty": new_difficulty}


@app.get("/health")
def health():
    return {"status": "ok", "service": "Neural Engine"}
