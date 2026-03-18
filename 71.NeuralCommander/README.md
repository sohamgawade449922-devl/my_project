# 🧠 NeuralCommander

> An autonomous AI-Agent ecosystem that manages academic, social, and system-level mobile interactions.

---

## 📐 Architecture Overview

```
71.NeuralCommander/
├── backend/           ← FastAPI REST API + PostgreSQL/pgvector
├── neural_engine/     ← BERT intent classifier + RL focus agent
├── mobile/            ← React Native app + Kotlin Android Native Modules
├── infrastructure/    ← Docker Compose · Terraform (AWS) · Nginx
├── docker-compose.yml
└── .env.example
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Docker ≥ 24 & Docker Compose v2
- Python 3.11 (for local dev)
- Node 20 + React Native CLI (for mobile)
- Android Studio (for the native Android build)

### 2. Clone & Configure
```bash
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, SECRET_KEY
```

### 3. Start the Full Stack
```bash
docker-compose up --build
```

| Service        | URL                          |
|----------------|------------------------------|
| API            | http://localhost:8000        |
| API Docs       | http://localhost:8000/docs   |
| Neural Engine  | http://localhost:8001        |
| Nginx Proxy    | http://localhost:80          |
| PostgreSQL     | localhost:5432               |
| Redis          | localhost:6379               |

### 4. Run Database Migrations
```bash
docker-compose exec backend alembic upgrade head
```

---

## 🧩 Component Breakdown

### `/backend` – FastAPI

| Endpoint | Description |
|---|---|
| `POST /api/v1/auth/register` | Create user account |
| `POST /api/v1/auth/login` | JWT login |
| `GET  /api/v1/auth/google` | Google OAuth2 redirect URL |
| `GET  /api/v1/auth/google/callback` | OAuth2 callback + token exchange |
| `POST /api/v1/classroom/sync/{uid}` | Sync Google Classroom assignments |
| `POST /api/v1/tasks/{uid}` | Create task (auto priority scoring) |
| `GET  /api/v1/tasks/{uid}` | List tasks sorted by priority |
| `POST /api/v1/notifications/{uid}` | Ingest + classify notification |
| `POST /api/v1/focus/{uid}/start` | Start focus session |
| `POST /api/v1/focus/{sid}/stop` | End focus session |
| `POST /api/v1/focus/{sid}/bypass` | Report app-lock bypass (RL signal) |

**Priority Scoring Algorithm**
```
score = 0.6 × urgency(deadline) + 0.4 × difficulty_score
urgency = 10 × exp(-hours_left / 168 × 4)
```

### `/neural_engine` – AI Brain

| Endpoint | Description |
|---|---|
| `POST /classify` | BERT-based 3-class notification classification |
| `POST /generate_reply` | AI auto-reply (GPT-3.5 or template fallback) |
| `GET  /rl/difficulty/{uid}` | Get current RL lock difficulty for user |
| `POST /rl/update/{uid}` | Update Q-table after focus session |

**Intent Classes:** `Urgent` · `Academic` · `Ignore`

**RL Loop:**
- State: bypass count (discretized to 5 bins)
- Actions: increase / keep / decrease lock difficulty
- Reward: −1 per bypass, +1 for clean completion
- Algorithm: Q-learning (α=0.1, γ=0.9, ε=0.1)

### `/mobile` – Android App

**Kotlin Native Modules:**
- `NeuralCommanderAccessibilityService` – intercepts WhatsApp/Instagram/Snapchat notifications via `AccessibilityService`, forwards to backend
- `AppLockOverlayService` – draws a `TYPE_APPLICATION_OVERLAY` full-screen lock with 5 difficulty levels
- `NeuralCommanderModule` – React Native bridge exposing `enableFocusMode`, `lockApp`, `checkPermissions`, `lockScreen`
- `NeuralCommanderDeviceAdmin` – `DeviceAdminReceiver` for emergency screen lock

**Lock Difficulty Levels:**

| Level | Behavior |
|---|---|
| 1 | Simple dismiss button |
| 2 | 5-second countdown then dismiss |
| 3 | Math challenge required |
| 4 | 30s countdown + math challenge |
| 5 | No dismiss – only ends with focus session |

**React Native Screens:**
- `DashboardScreen` – tasks, focus toggle, classroom sync
- `NotificationsScreen` – classified notifications with AI replies

### `/infrastructure`

**`docker-compose.yml`** – Full stack: API + Neural Engine + PostgreSQL/pgvector + Redis + Nginx + Celery

**Terraform (`infrastructure/terraform/main.tf`):**
- AWS provider (ap-south-1)
- VPC + private/public subnets + NAT Gateway
- ECS Cluster
- RDS PostgreSQL 16 with pgvector parameter group
- ElastiCache Redis 7

---

## ⚙️ Local Development (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Neural Engine
cd neural_engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# Mobile
cd mobile
npm install
npx react-native run-android
```

---

## 🔐 Permissions Required (Android)

| Permission | Purpose |
|---|---|
| `SYSTEM_ALERT_WINDOW` | System overlay for App Lock |
| `BIND_ACCESSIBILITY_SERVICE` | Intercept notifications |
| `FOREGROUND_SERVICE` | Keep overlay service alive |
| `BIND_DEVICE_ADMIN` | Optional screen lock |
| `INTERNET` | Backend API calls |

> **OS Constraints Note:** `AccessibilityService` cannot directly suppress or auto-reply to WhatsApp notifications — it can only read them. True notification interception for auto-reply requires a `NotificationListenerService`. Direct WhatsApp auto-reply may require Notification Reply Actions or the WhatsApp Business API.

---

## 🏋️ Training the BERT Classifier

```bash
# Prepare JSONL training data
# {"text": "Assignment due tonight", "label": 1}
# label: 0=Urgent  1=Academic  2=Ignore

python -m neural_engine.training.train_classifier \
  --data_path data/notifications.jsonl \
  --output_dir neural_engine/models/intent_classifier \
  --epochs 5
```

---

## 🗃️ Database Schema

```
users               → id, email, google tokens, ...
tasks               → id, title, deadline, difficulty, priority_score, ...
notifications       → id, package_name, category, ai_reply, was_suppressed, ...
focus_sessions      → id, start_time, bypass_count, lock_difficulty, ...
semantic_memories   → id, content, embedding (vector 384), ...
```

---

## 📦 Key Dependencies

| Layer | Library | Purpose |
|---|---|---|
| Backend | FastAPI, SQLAlchemy, asyncpg | API + async ORM |
| Backend | pgvector, alembic | Vector DB + migrations |
| Backend | python-jose, passlib | JWT auth |
| Backend | google-api-python-client | Classroom API |
| Neural Engine | transformers, sentence-transformers | BERT classifier |
| Neural Engine | LangChain, openai | AI reply generation |
| Neural Engine | numpy | RL Q-table |
| Mobile | react-native, @react-navigation | UI shell |
| Mobile | react-native-vector-icons | Icons |
| Mobile | axios, @reduxjs/toolkit | API + state |
| Android | AccessibilityService | Notification intercept |
| Android | TYPE_APPLICATION_OVERLAY | App lock |
| Android | DevicePolicyManager | Screen lock |
