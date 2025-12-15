# MetaMerge Backend

Backend service for MetaMerge MVP - A multi-LLM aggregation service that calls multiple language models concurrently and uses a judge model to merge responses.

## Features

- **Parallel LLM Calls**: Calls multiple models concurrently via OpenRouter
- **Unbiased Judge**: Uses a separate judge model to merge answers without vendor bias
- **Robust Error Handling**: Graceful fallbacks and comprehensive error reporting
- **Observability**: Request tracking with UUIDs, latency metrics, and structured logging
- **Type Safety**: Full TypeScript implementation with NestJS

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenRouter API key

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=your_key_here
   PORT=3000
   NODE_ENV=development
   FRONTEND_ORIGIN=http://localhost:3001
   ```

3. **Configure models** (optional):
   
   Edit `config.json` to customize models, timeouts, etc.:
   ```json
   {
     "models": [
       "openai/gpt-4o-mini",
       "anthropic/claude-3.5-sonnet",
       "google/gemini-2.0-flash-exp",
       "xai/grok-2-1212"
     ],
     "judge_model": "openai/gpt-4o",
     "per_model_timeout_ms": 20000,
     "judge_timeout_ms": 25000,
     "max_prompt_length": 8000
   }
   ```

## Running

**Development**:
```bash
npm run start:dev
```

**Production**:
```bash
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## API

### POST /api/merge

Merges responses from multiple LLMs using a judge model.

**Request**:
```json
{
  "prompt": "What is the capital of France?",
  "mode": "general"
}
```

**Response (200 OK)**:
```json
{
  "merged_answer": "The capital of France is Paris...",
  "model_answers": [
    {
      "model": "openai/gpt-4o-mini",
      "answer": "Paris is the capital...",
      "latency_ms": 1234,
      "success": true,
      "error": null
    },
    {
      "model": "anthropic/claude-3.5-sonnet",
      "answer": "The capital city of France is Paris...",
      "latency_ms": 1456,
      "success": true,
      "error": null
    }
  ],
  "meta": {
    "total_latency_ms": 3456,
    "timestamp": "2025-12-14T12:00:00Z",
    "request_id": "uuid-here"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid prompt (missing, empty, or too long)
- `500 Internal Server Error`: All model calls failed

## Architecture

- **MergeController**: Handles HTTP requests
- **MergeService**: Orchestrates parallel model calls and judge merging
- **OpenRouterService**: Handles API calls to OpenRouter
- **JudgeService**: Manages judge model calls with anonymized inputs
- **LoggerService**: Structured logging with request tracking

## Configuration

### Environment Variables

- `OPENROUTER_API_KEY`: Required - Your OpenRouter API key
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `FRONTEND_ORIGIN`: CORS origin for frontend

### Config File (`config.json`)

- `models`: Array of model IDs to call in parallel
- `judge_model`: Model ID for judge/merging
- `per_model_timeout_ms`: Timeout per model call
- `judge_timeout_ms`: Timeout for judge call
- `max_prompt_length`: Maximum prompt length in characters

## Logging

Each request is assigned a UUID and logged with:
- Request metadata (prompt hash, mode, models)
- Per-model results (latency, success, errors)
- Judge results
- Total request latency

## Error Handling

- **Model failures**: Individual model failures don't stop the request if at least one succeeds
- **Judge failure**: Falls back to the first successful model's answer
- **All models fail**: Returns 500 with error details
- **Network errors**: Automatic retry (1 retry) for transient errors
- **Timeouts**: Configurable per-model and judge timeouts

## Security

- API keys stored in environment variables (never exposed)
- CORS configured for frontend origin
- Input validation and sanitization
- Request size limits

## Development

```bash
# Run in watch mode
npm run start:dev

# Run tests
npm run test

# Lint
npm run lint

# Format code
npm run format
```

