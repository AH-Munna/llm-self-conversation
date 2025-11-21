# Variable Replacement Example

## Using Variables in System Prompt and Character Definitions

You can now use `{{char1}}` and `{{char2}}` in your system prompt and character definitions. These will be automatically replaced with the actual character names.

### Example System Prompt:
```
You are {{char1}}, chatting with {{char2}}. Have a friendly conversation about technology.
```

**What Character 1 (Alice) sees:**
```
You are Alice, chatting with Bob. Have a friendly conversation about technology.
```

**What Character 2 (Bob) sees:**
```
You are Bob, chatting with Alice. Have a friendly conversation about technology.
```

### Example Character Definition:
```
You are {{char1}}, a friendly AI assistant. You enjoy discussing various topics with {{char2}}.
```

**For Alice:**
```
You are Alice, a friendly AI assistant. You enjoy discussing various topics with Bob.
```

**For Bob:**
```
You are Bob, a friendly AI assistant. You enjoy discussing various topics with Alice.
```

## New Context Format

Each API request now follows this format:

```
<system_prompt with variables replaced>
<character_definition with variables replaced>
[Start a new Chat]
<conversation history>
```

This provides clear separation between the setup and the actual conversation, allowing the LLM to better understand the context structure.

## Per-Character Model Selection

Each character can now use a different model:
- Character 1 could use `gpt-4`
- Character 2 could use `claude-3-opus`

This allows you to test different models conversing with each other!
