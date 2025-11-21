from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import httpx
import json
import os
import asyncio
import uuid
from typing import Optional, List, Dict, Any
from pathlib import Path
from datetime import datetime

app = FastAPI(title="LLM Conversation Testing System")

# Configuration
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

CHARACTERS_DIR = DATA_DIR / "characters"
CHARACTERS_DIR.mkdir(exist_ok=True)

SYSTEM_PROMPT_FILE = DATA_DIR / "system_prompt.json"
API_CONFIG_1_FILE = DATA_DIR / "api_config_1.json"
API_CONFIG_2_FILE = DATA_DIR / "api_config_2.json"

# ==================== Pydantic Models ====================

class SystemPrompt(BaseModel):
    prompt: str

class APIConfig(BaseModel):
    base_url: str
    api_key: str

class Character(BaseModel):
    name: str
    definition: str
    model: str
    starting_message: Optional[str] = None

class CharacterPair(BaseModel):
    id: str
    name: str  # "Char1_Char2"
    created_at: str
    last_conversation_id: Optional[str] = None
    character1: Character
    character2: Character

class Message(BaseModel):
    id: str
    role: str
    content: str
    character: str
    timestamp: str

class Conversation(BaseModel):
    id: str
    character_pair_id: str
    created_at: str
    updated_at: str
    turn_count: int
    messages: List[Message]

class ConversationRequest(BaseModel):
    turns: int = 10

# ==================== Helper Functions ====================

def load_json(file_path: Path, default: Any = None):
    """Load JSON from file, return default if not exists"""
    if file_path.exists():
        with open(file_path, 'r') as f:
            return json.load(f)
    return default if default is not None else {}

def save_json(file_path: Path, data: Any):
    """Save data to JSON file"""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

def get_character_pair_path(char1_name: str, char2_name: str) -> Path:
    """Get or create unique path for character pair with auto-increment"""
    base_name = f"{char1_name}_{char2_name}"
    counter = 1
    
    while True:
        folder_name = f"{base_name}_{counter}"
        pair_path = CHARACTERS_DIR / folder_name
        if not pair_path.exists():
            pair_path.mkdir(parents=True, exist_ok=True)
            (pair_path / "conversations").mkdir(exist_ok=True)
            return pair_path
        counter += 1

def find_character_pair_path(pair_id: str) -> Optional[Path]:
    """Find character pair folder by ID"""
    for pair_folder in CHARACTERS_DIR.iterdir():
        if pair_folder.is_dir():
            pair_file = pair_folder / "character_pair.json"
            if pair_file.exists():
                data = load_json(pair_file)
                if data.get("id") == pair_id:
                    return pair_folder
    return None

def save_character_pair(pair: CharacterPair) -> None:
    """Save character pair to disk"""
    pair_path = find_character_pair_path(pair.id)
    if not pair_path:
        # New pair - create folder
        pair_path = get_character_pair_path(pair.character1.name, pair.character2.name)
    
    pair_file = pair_path / "character_pair.json"
    save_json(pair_file, pair.dict())

def load_character_pair(pair_id: str) -> Optional[CharacterPair]:
    """Load character pair by ID"""
    pair_path = find_character_pair_path(pair_id)
    if not pair_path:
        return None
    
    pair_file = pair_path / "character_pair.json"
    data = load_json(pair_file)
    return CharacterPair(**data) if data else None

def list_character_pairs() -> List[Dict[str, Any]]:
    """List all character pairs"""
    pairs = []
    for pair_folder in CHARACTERS_DIR.iterdir():
        if pair_folder.is_dir():
            pair_file = pair_folder / "character_pair.json"
            if pair_file.exists():
                data = load_json(pair_file)
                pairs.append({
                    "id": data["id"],
                    "name": data["name"],
                    "created_at": data["created_at"],
                    "character1_name": data["character1"]["name"],
                    "character2_name": data["character2"]["name"]
                })
    return sorted(pairs, key=lambda x: x["created_at"], reverse=True)

def save_conversation(conv: Conversation, pair_id: str) -> None:
    """Save conversation to pair's conversation folder"""
    pair_path = find_character_pair_path(pair_id)
    if not pair_path:
        raise ValueError(f"Character pair {pair_id} not found")
    
    conv_file = pair_path / "conversations" / f"{conv.id}.json"
    save_json(conv_file, conv.dict())
    
    # Update last_conversation_id in pair
    pair = load_character_pair(pair_id)
    if pair:
        pair.last_conversation_id = conv.id
        save_character_pair(pair)

def load_conversation(conv_id: str, pair_id: str) -> Optional[Conversation]:
    """Load specific conversation"""
    pair_path = find_character_pair_path(pair_id)
    if not pair_path:
        return None
    
    conv_file = pair_path / "conversations" / f"{conv_id}.json"
    data = load_json(conv_file)
    return Conversation(**data) if data else None

def list_conversations(pair_id: str) -> List[Dict[str, Any]]:
    """List all conversations for a pair with metadata"""
    pair_path = find_character_pair_path(pair_id)
    if not pair_path:
        return []
    
    convs_dir = pair_path / "conversations"
    conversations = []
    
    for conv_file in convs_dir.glob("*.json"):
        data = load_json(conv_file)
        if data:
            conversations.append({
                "id": data["id"],
                "created_at": data["created_at"],
                "updated_at": data["updated_at"],
                "turn_count": data["turn_count"]
            })
    
    return sorted(conversations, key=lambda x: x["updated_at"], reverse=True)

def delete_conversation(conv_id: str, pair_id: str) -> bool:
    """Delete a conversation"""
    pair_path = find_character_pair_path(pair_id)
    if not pair_path:
        return False
    
    conv_file = pair_path / "conversations" / f"{conv_id}.json"
    if conv_file.exists():
        conv_file.unlink()
        return True
    return False

def replace_variables(text: str, char_name: str, other_name: str) -> str:
    """Replace {{char1}} and {{char2}} with actual character names"""
    return text.replace("{{char1}}", char_name).replace("{{char2}}", other_name)

async def call_llm_api(config: APIConfig, model: str, messages: List[Dict[str, str]]) -> str:
    """Call the LLM API and return the response content"""
    base_url = config.base_url.rstrip('/')
    api_key = config.api_key
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.85,
                "max_tokens": 4096
            },
            timeout=120.0
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

# ==================== API Routes ====================

@app.get("/")
async def read_root():
    """Serve the main HTML page"""
    return FileResponse("static/index.html")

# System Prompt
@app.get("/api/system-prompt")
async def get_system_prompt():
    """Get global system prompt"""
    data = load_json(SYSTEM_PROMPT_FILE, {"prompt": ""})
    return data

@app.post("/api/system-prompt")
async def save_system_prompt(prompt: SystemPrompt):
    """Save global system prompt"""
    save_json(SYSTEM_PROMPT_FILE, prompt.dict())
    return {"status": "success", "message": "System prompt saved"}

# API Configurations
@app.get("/api/config/{config_num}")
async def get_api_config(config_num: int):
    """Get API configuration (1 or 2)"""
    if config_num not in [1, 2]:
        raise HTTPException(status_code=400, detail="Config number must be 1 or 2")
    
    config_file = API_CONFIG_1_FILE if config_num == 1 else API_CONFIG_2_FILE
    config = load_json(config_file, {})
    return config

@app.post("/api/config/{config_num}")
async def save_api_config(config_num: int, config: APIConfig):
    """Save API configuration (1 or 2)"""
    if config_num not in [1, 2]:
        raise HTTPException(status_code=400, detail="Config number must be 1 or 2")
    
    config_file = API_CONFIG_1_FILE if config_num == 1 else API_CONFIG_2_FILE
    save_json(config_file, config.dict())
    return {"status": "success", "message": f"API config {config_num} saved"}

@app.get("/api/models/{config_num}")
async def fetch_models(config_num: int):
    """Fetch available models from the configured LLM API"""
    if config_num not in [1, 2]:
        raise HTTPException(status_code=400, detail="Config number must be 1 or 2")
    
    config_file = API_CONFIG_1_FILE if config_num == 1 else API_CONFIG_2_FILE
    config_data = load_json(config_file)
    
    if not config_data or "base_url" not in config_data:
        raise HTTPException(status_code=400, detail=f"API {config_num} not configured. Please set base URL and API key first.")
    
    base_url = config_data["base_url"].rstrip('/')
    api_key = config_data.get("api_key", "")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

# Character Pairs
@app.get("/api/character-pairs")
async def get_character_pairs():
    """List all character pairs"""
    pairs = list_character_pairs()
    return {"pairs": pairs}

@app.post("/api/character-pairs")
async def create_character_pair(pair: CharacterPair):
    """Create new character pair"""
    # Generate new ID and timestamp if not provided
    if not pair.id:
        pair.id = str(uuid.uuid4())
    if not pair.created_at:
        pair.created_at = datetime.now().isoformat()
    
    save_character_pair(pair)
    return {"status": "success", "pair_id": pair.id, "message": "Character pair created"}

@app.get("/api/character-pairs/{pair_id}")
async def get_character_pair(pair_id: str):
    """Get specific character pair"""
    pair = load_character_pair(pair_id)
    if not pair:
        raise HTTPException(status_code=404, detail="Character pair not found")
    return pair

@app.put("/api/character-pairs/{pair_id}")
async def update_character_pair(pair_id: str, pair: CharacterPair):
    """Update character pair"""
    existing_pair = load_character_pair(pair_id)
    if not existing_pair:
        raise HTTPException(status_code=404, detail="Character pair not found")
    
    pair.id = pair_id  # Ensure ID doesn't change
    save_character_pair(pair)
    return {"status": "success", "message": "Character pair updated"}

@app.delete("/api/character-pairs/{pair_id}")
async def delete_character_pair(pair_id: str):
    """Delete character pair and all its conversations"""
    pair_path = find_character_pair_path(pair_id)
    if not pair_path:
        raise HTTPException(status_code=404, detail="Character pair not found")
    
    # Delete entire folder
    import shutil
    shutil.rmtree(pair_path)
    return {"status": "success", "message": "Character pair deleted"}

# Conversations
@app.get("/api/character-pairs/{pair_id}/conversations")
async def get_conversations(pair_id: str):
    """List all conversations for a pair"""
    conversations = list_conversations(pair_id)
    return {"conversations": conversations}

@app.post("/api/character-pairs/{pair_id}/conversations")
async def create_conversation(pair_id: str):
    """Create new empty conversation for a pair"""
    pair = load_character_pair(pair_id)
    if not pair:
        raise HTTPException(status_code=404, detail="Character pair not found")
    
    conv = Conversation(
        id=str(uuid.uuid4()),
        character_pair_id=pair_id,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
        turn_count=0,
        messages=[]
    )
    
    # Add Character 1's starting message if provided
    if pair.character1.starting_message:
        starting_msg = Message(
            id=str(uuid.uuid4()),
            role="assistant",
            content=pair.character1.starting_message,
            character=pair.character1.name,
            timestamp=datetime.now().isoformat()
        )
        conv.messages.append(starting_msg)
        conv.turn_count = 1
        conv.updated_at = datetime.now().isoformat()
    
    save_conversation(conv, pair_id)
    return {"status": "success", "conversation_id": conv.id}

@app.get("/api/conversations/{conv_id}")
async def get_conversation(conv_id: str, pair_id: str):
    """Get specific conversation"""
    conv = load_conversation(conv_id, pair_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@app.delete("/api/conversations/{conv_id}")
async def delete_conversation_endpoint(conv_id: str, pair_id: str):
    """Delete a conversation"""
    success = delete_conversation(conv_id, pair_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "success", "message": "Conversation deleted"}

@app.delete("/api/conversations/{conv_id}")
async def delete_conversation_endpoint(conv_id: str, pair_id: str):
    """Delete a conversation"""
    success = delete_conversation(conv_id, pair_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "success", "message": "Conversation deleted"}

# Streaming Conversation Endpoints
@app.get("/api/conversations/{conv_id}/start-stream")
async def start_conversation_stream(conv_id: str, pair_id: str, turns: int = 10):
    """Start or continue conversation with streaming"""
    async def event_generator():
        try:
            # Load character pair
            pair = load_character_pair(pair_id)
            if not pair:
                yield f"data: {{\"error\": \"Character pair not found\"}}\n\n"
                return
            
            # Load API configs
            config1_data = load_json(API_CONFIG_1_FILE)
            config2_data = load_json(API_CONFIG_2_FILE)
            
            if not config1_data or not config2_data:
                yield f"data: {{\"error\": \"Please configure both API endpoints\"}}\n\n"
                return
            
            config1 = APIConfig(**config1_data)
            config2 = APIConfig(**config2_data)
            
            # Load or create conversation
            conv = load_conversation(conv_id, pair_id)
            if not conv:
                raise HTTPException(status_code=404, detail="Conversation not found")
            
            # Load system prompt
            system_prompt_data = load_json(SYSTEM_PROMPT_FILE, {"prompt": ""})
            system_prompt_text = system_prompt_data.get("prompt", "")
            
            # Continue conversation
            current_turn = conv.turn_count
            turns_to_generate = turns if current_turn == 0 else turns
            
            # If we just added a starting message, we already have 1 turn, so generate turns-1 more
            if current_turn == 1:
                turns_to_generate = turns - 1
            elif current_turn == 0:
                turns_to_generate = turns
            
            for turn in range(turns_to_generate):
                total_turns = current_turn + turn
                
                # Determine which character speaks
                # If we have messages already (including starting message), figure out who's next
                if len(conv.messages) % 2 == 0:  # Even number of messages: Character 1 speaks next
                    current_char = pair.character1
                    other_char = pair.character2
                    config = config1
                else:  # Odd number of messages: Character 2 speaks next
                    current_char = pair.character2
                    other_char = pair.character1
                    config = config2
                
                # Build context
                sys_prompt = replace_variables(system_prompt_text, current_char.name, other_char.name)
                char_def = replace_variables(current_char.definition, current_char.name, other_char.name)
                
                context_parts = [sys_prompt, char_def, "[Start a new Chat]"]
                for msg in conv.messages:
                    context_parts.append(f"{msg.character}: {msg.content}")
                
                full_context = "\\n".join(context_parts)
                messages = [{"role": "system", "content": full_context}]
                
                # Call LLM API
                try:
                    response_content = await call_llm_api(config, current_char.model, messages)
                    
                    # Validate response
                    if not response_content or response_content.strip() == "" or response_content.lower() == "null":
                        yield f"data: {{\"error\": \"Received empty or null response from LLM API\"}}\n\n"
                        return
                    
                    # Create message
                    message = Message(
                        id=str(uuid.uuid4()),
                        role="assistant",
                        content=response_content,
                        character=current_char.name,
                        timestamp=datetime.now().isoformat()
                    )
                    conv.messages.append(message)
                    conv.turn_count += 1
                    conv.updated_at = datetime.now().isoformat()
                    
                    # Stream message
                    yield f"data: {json.dumps(message.dict())}\n\n"
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    yield f"data: {{\"error\": \"LLM API call failed: {str(e)}\"}}\n\n"
                    return
            
            # Save conversation
            save_conversation(conv, pair_id)
            
            # Send completion
            yield f"data: {{\"complete\": true, \"total_turns\": {conv.turn_count}}}\n\n"
            
        except Exception as e:
            yield f"data: {{\"error\": \"Unexpected error: {str(e)}\"}}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting LLM Conversation Testing System...")
    print("📍 Server running at: http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)

