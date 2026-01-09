# 🤖 LLM Conversation Testing System

A beautiful web-based application for testing AI-to-AI conversations using OpenAI-compatible LLM APIs.

## ✨ Features

- **Turn-based AI Conversations**: Watch two AI characters converse autonomously
- **Live Streaming**: See messages appear in real-time as they're generated (no loading screens!)
- **OpenAI-Compatible API Support**: Works with any OpenAI-compatible endpoint
- **Per-Character Model Selection**: Each character can use a different model (e.g., GPT-4 vs Claude)
- **Variable Replacement**: Use `{{char1}}` and `{{char2}}` in prompts for dynamic character references
- **Character-Driven**: Define unique personalities and conversation styles
- **Premium Dark UI**: Glassmorphism effects with vibrant gradients
- **JSON Persistence**: All configurations and conversations saved locally

## 🚀 Quick Start

### 1. Start the Server

```bash
./venv/bin/python server.py
```

### 2. Open in Browser

Navigate to: **http://localhost:8000**

### 3. Configure & Test

1. Enter your API Base URL and API Key
2. Fetch and select a model
3. Define your characters
4. Start the conversation!

## 📁 Project Structure

- `server.py` - FastAPI backend
- `static/` - Frontend files (HTML, CSS, JS)
- `data/` - JSON storage for configurations and conversations
- `requirements.txt` - Python dependencies
- `venv/` - Virtual environment

## 🎯 How It Works

1. **Character 1** starts with a predefined message
2. **Character 2** responds (AI-generated)
3. Characters alternate for 10 turns
4. Click "Continue" for 10 more turns
5. All conversations are saved

## 🛠️ Technology Stack

- **Backend**: Python, FastAPI, httpx
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Storage**: JSON files
- **API**: OpenAI-compatible endpoints

---

**Ready to test!** The server is currently running at http://localhost:8000
