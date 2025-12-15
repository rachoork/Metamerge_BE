# MetaMerge API Endpoints

## Base URL
`http://localhost:3000/api/v1`

## Endpoints

### 1. General Query
**Endpoint:** `POST /api/v1/query`

**Request:**
```json
{
  "prompt": "user's question",
  "mode": "query",  // or "general", "comprehensive", "concise", "technical", "creative"
  "queryModels": [
    { "id": "openai/gpt-4.1-mini", "name": "GPT-4.1 Mini", "provider": "OpenAI" }
  ],
  "judgeModel": {
    "id": "google/gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "provider": "Google"
  }
}
```

**Response:**
```json
{
  "mergedAnswer": "Synthesized answer...",
  "modelResults": [...],
  "totalLatency": 2.5,
  "judgeModelUsed": "Gemini 2.5 Flash",
  "mode": "text"
}
```

**Notes:**
- `mode: "query"` is automatically normalized to `"general"`
- Valid modes: `"query"`, `"general"`, `"comprehensive"`, `"concise"`, `"technical"`, `"creative"`
- `judgeModel` is required

---

### 2. Image Generation
**Endpoint:** `POST /api/v1/generate-image`

**Request:**
```json
{
  "prompt": "image description",
  "queryModels": [
    { "id": "openai/dall-e-3", "name": "DALL-E 3", "provider": "OpenAI" }
  ]
}
```

**Response:**
```json
{
  "mergedImageUrl": "https://...",
  "imageResults": [...],
  "totalLatency": 3.2,
  "mode": "image"
}
```

**Notes:**
- Only image generation models are accepted (DALL-E, Stable Diffusion, Flux, etc.)
- Text models (GPT, Claude, Gemini) are automatically filtered out
- `judgeModel` is NOT required
- `mode` field is NOT required

**Supported Image Models:**
- `openai/dall-e-3`
- `openai/dall-e-2`
- `black-forest-labs/flux-1.1-pro`
- `black-forest-labs/flux-1.1-schnell`
- `stability-ai/stable-diffusion-xl-base-1.0`
- `ideogram-ai/ideogram-v2`
- `playgroundai/playground-v2.5-1024px-aesthetic`
- And other image generation models

---

### 3. Deep Research
**Endpoint:** `POST /api/v1/deep-research`

**Request:**
```json
{
  "prompt": "research topic",
  "queryModels": [
    { "id": "openai/gpt-4.1-mini", "name": "GPT-4.1 Mini", "provider": "OpenAI" }
  ],
  "judgeModel": {
    "id": "google/gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "provider": "Google"
  }
}
```

**Response:**
```json
{
  "mergedAnswer": "Research-backed answer with citations...",
  "modelResults": [...],
  "totalLatency": 15.8,
  "judgeModelUsed": "Gemini 2.5 Flash",
  "mode": "research",
  "citations": ["url1", "url2"],
  "researchSources": [...]
}
```

**Notes:**
- Performs web research before generating answers
- Includes citations and research sources
- `judgeModel` is required
- `mode` field is NOT required (automatically set to "deep-research")

---

## Common Fields

### Model Object
```json
{
  "id": "provider/model-id",
  "name": "Model Display Name",
  "provider": "Provider Name"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "timestamp": "2025-12-15T03:46:04.516Z",
  "path": "/api/v1/generate-image",
  "method": "POST",
  "message": "Error message",
  "details": {
    "message": "Detailed error message",
    "error": "Bad Request",
    "statusCode": 400
  }
}
```

## Field Compatibility

- All endpoints accept `queryModels` (UI compatibility)
- Image generation endpoint also accepts `imageModels` (alternative name)
- `mode: "query"` is normalized to `"general"` automatically

