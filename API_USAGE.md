# API Usage Guide

## POST /api/merge

### Request Body

```json
{
  "prompt": "string (required)",
  "mode": "string (optional: 'general' | 'coding' | 'system-design')",
  "models": ["string"] (optional),
  "judge_model": "string (optional)",
  "use_fewer_models": boolean (optional)
}
```

### Parameters

#### Required
- **prompt** (string): The question/prompt to send to models. Max 8000 characters.

#### Optional
- **mode** (string): Context mode for the query
  - `"general"` - Default, general purpose
  - `"coding"` - For code-related questions
  - `"system-design"` - For architecture/system design questions

- **models** (string[]): Array of model IDs to query. If not provided, uses default from `config.json`.
  - Example: `["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"]`
  - Min: 1 model, Max: 10 models
  - If provided, overrides default models from config

- **judge_model** (string): Model ID to use as judge. If not provided, uses default from `config.json`.
  - Example: `"openai/gpt-4o"`
  - If not provided, uses `judge_model` from `config.json`

- **use_fewer_models** (boolean): If `true` and `models` is not provided, uses only first 2 models from default config.
  - Example: `true` - Uses first 2 models from config
  - Example: `false` or omitted - Uses all models from config
  - Ignored if `models` array is provided

### Behavior Logic

1. **If `models` is provided:**
   - Uses the provided models array
   - `use_fewer_models` is ignored
   - `judge_model` can still be customized

2. **If `models` is NOT provided but `use_fewer_models` is `true`:**
   - Uses first 2 models from default config
   - Falls back to all default models if less than 2 available

3. **If neither `models` nor `use_fewer_models` is provided:**
   - Uses all models from `config.json`

4. **Judge Model:**
   - If `judge_model` is provided, uses it
   - Otherwise uses `judge_model` from `config.json`

### Examples

#### Example 1: Default behavior (all models from config)
```json
{
  "prompt": "What is the capital of France?",
  "mode": "general"
}
```

#### Example 2: Custom models only
```json
{
  "prompt": "Explain async/await in JavaScript",
  "mode": "coding",
  "models": ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
  "judge_model": "openai/gpt-4o"
}
```

#### Example 3: Use fewer models (first 2 from config)
```json
{
  "prompt": "Design a scalable API",
  "mode": "system-design",
  "use_fewer_models": true
}
```

#### Example 4: Custom models with custom judge
```json
{
  "prompt": "What are the best practices for microservices?",
  "models": ["openai/gpt-4o-mini", "google/gemini-2.0-flash-exp"],
  "judge_model": "anthropic/claude-3.5-sonnet"
}
```

### Response

```json
{
  "merged_answer": "string | null",
  "model_answers": [
    {
      "model": "string",
      "answer": "string | null",
      "latency_ms": 0,
      "success": true,
      "error": "string | null"
    }
  ],
  "meta": {
    "total_latency_ms": 0,
    "timestamp": "2025-12-14T12:00:00Z",
    "request_id": "uuid"
  }
}
```

### Error Responses

#### 400 Bad Request
- Prompt is missing or empty
- Prompt exceeds 8000 characters
- Invalid model array (empty, too many models)

#### 500 Internal Server Error
- All model calls failed
- No answers available to merge

### Notes

- All model calls happen in parallel for speed
- If debate is enabled, models will refine answers iteratively
- Judge model merges all successful answers
- Failed models are included in response with `success: false`

