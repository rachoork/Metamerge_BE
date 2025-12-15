# API Response Payloads Documentation

This document describes the response payload structures for different API endpoints and modes.

## 1. Text Query Mode

**Endpoint:** `POST /api/v1/query`

**Request:**
```json
{
  "prompt": "What is machine learning?",
  "mode": "general",
  "queryModels": [
    {
      "id": "openai/gpt-4o-mini",
      "name": "GPT-4o Mini",
      "provider": "OpenAI"
    }
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
  "mergedAnswer": "# Machine Learning\n\nMachine learning is a subset of artificial intelligence...",
  "modelResults": [
    {
      "modelName": "GPT-4o Mini",
      "modelId": "openai/gpt-4o-mini",
      "provider": "OpenAI",
      "status": "success",
      "latency": 1.234,
      "content": "Machine learning is a method of data analysis..."
    }
  ],
  "totalLatency": 2.456,
  "judgeModelUsed": "Gemini 2.5 Flash",
  "mode": "text"
}
```

**Response Fields:**
- `mergedAnswer` (string, optional): Synthesized answer from judge model (Markdown format)
- `modelResults` (array): Array of individual model responses
  - `modelName` (string): Human-readable model name
  - `modelId` (string): Model identifier
  - `provider` (string): Model provider name
  - `status` (string): `"success"` or `"failed"`
  - `latency` (number): Response time in seconds
  - `content` (string, optional): Model's text response (Markdown format)
  - `errorMessage` (string, optional): Error message if status is "failed"
- `totalLatency` (number): Total request processing time in seconds
- `judgeModelUsed` (string, optional): Name of judge model used for synthesis
- `mode` (string): Response type, always `"text"` for this mode

---

## 2. Image Generation Mode

**Endpoint:** `POST /api/v1/generate-image`

**Request:**
```json
{
  "prompt": "A beautiful sunset over mountains",
  "imageModels": [
    {
      "id": "openai/dall-e-3",
      "name": "DALL-E 3",
      "provider": "OpenAI"
    }
  ],
  "size": "1024x1024",
  "responseFormat": "url"
}
```

**Response:**
```json
{
  "mergedImageUrl": "https://example.com/image.png",
  "imageResults": [
    {
      "modelName": "DALL-E 3",
      "modelId": "openai/dall-e-3",
      "provider": "OpenAI",
      "status": "success",
      "latency": 3.456,
      "imageUrl": "https://example.com/image.png"
    }
  ],
  "totalLatency": 3.789,
  "mode": "image"
}
```

**Response Fields:**
- `mergedImageUrl` (string, optional): Best selected image URL (first successful image)
- `mergedImageBase64` (string, optional): Best selected image as base64 (if `responseFormat: "b64_json"`)
- `imageResults` (array): Array of image generation results
  - `modelName` (string): Human-readable model name
  - `modelId` (string): Model identifier
  - `provider` (string): Model provider name
  - `status` (string): `"success"` or `"failed"`
  - `latency` (number): Response time in seconds
  - `imageUrl` (string, optional): Generated image URL (if `responseFormat: "url"`)
  - `imageBase64` (string, optional): Generated image as base64 (if `responseFormat: "b64_json"`)
  - `errorMessage` (string, optional): Error message if status is "failed"
- `totalLatency` (number): Total request processing time in seconds
- `mode` (string): Response type, always `"image"` for this mode

---

## 3. Deep Research Mode (Async Job)

### 3.1 Create Deep Research Job

**Endpoint:** `POST /api/v1/deep-research`

**Request:**
```json
{
  "query": "leader election in distributed node systems",
  "options": {
    "queryModels": [
      {
        "id": "openai/gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "OpenAI"
      }
    ],
    "judgeModel": {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "provider": "OpenAI"
    }
  }
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "b6595e0f-81e3-4d03-8e79-657bfb1b7002",
  "status": "queued"
}
```

### 3.2 Get Job Status

**Endpoint:** `GET /api/v1/deep-research/{jobId}`

**Response (while running):**
```json
{
  "jobId": "b6595e0f-81e3-4d03-8e79-657bfb1b7002",
  "status": "running",
  "progress": 60,
  "currentIteration": 3,
  "totalIterations": 5,
  "estimatedRemainingSeconds": 120,
  "createdAt": "2025-12-15T10:00:00.000Z",
  "updatedAt": "2025-12-15T10:02:00.000Z",
  "startedAt": "2025-12-15T10:00:05.000Z"
}
```

**Response (completed):**
```json
{
  "jobId": "b6595e0f-81e3-4d03-8e79-657bfb1b7002",
  "status": "completed",
  "progress": 100,
  "currentIteration": 5,
  "totalIterations": 5,
  "createdAt": "2025-12-15T10:00:00.000Z",
  "updatedAt": "2025-12-15T10:05:00.000Z",
  "startedAt": "2025-12-15T10:00:05.000Z",
  "completedAt": "2025-12-15T10:05:00.000Z",
  "result": {
    "summary": "# Leader Election in Distributed Node Systems\n\nLeader election is a fundamental problem in distributed systems...",
    "sections": [
      {
        "title": "Research Summary",
        "content": "# Leader Election in Distributed Node Systems...",
        "type": "summary"
      },
      {
        "title": "Citations",
        "content": [
          "https://example.com/source1",
          "https://example.com/source2"
        ],
        "type": "citations"
      },
      {
        "title": "Research Sources",
        "content": [
          {
            "title": "Distributed Systems: Leader Election",
            "url": "https://example.com/source1",
            "snippet": "Leader election is a process..."
          }
        ],
        "type": "sources"
      }
    ],
    "citations": [
      "https://example.com/source1",
      "https://example.com/source2"
    ],
    "researchSources": [
      {
        "title": "Distributed Systems: Leader Election",
        "url": "https://example.com/source1",
        "snippet": "Leader election is a process..."
      },
      {
        "title": "Raft Consensus Algorithm",
        "url": "https://example.com/source2",
        "snippet": "Raft is a consensus algorithm..."
      }
    ],
    "debateRounds": 2,
    "modelAnswers": [
      {
        "model": "openai/gpt-4o-mini",
        "answer": "Leader election is a mechanism...",
        "citations": ["https://example.com/source1"]
      }
    ],
    "metadata": {
      "usedExternalSources": true,
      "researchSourcesCount": 8,
      "citationsCount": 5,
      "fallbackReason": null,
      "toolErrors": []
    }
  }
}
```

**Response (failed):**
```json
{
  "jobId": "b6595e0f-81e3-4d03-8e79-657bfb1b7002",
  "status": "failed",
  "progress": 30,
  "currentIteration": 2,
  "totalIterations": 5,
  "createdAt": "2025-12-15T10:00:00.000Z",
  "updatedAt": "2025-12-15T10:01:00.000Z",
  "startedAt": "2025-12-15T10:00:05.000Z",
  "error": {
    "code": "TIMEOUT",
    "message": "Research timeout after 300 seconds"
  }
}
```

**Response Fields:**
- `jobId` (string): Unique job identifier
- `status` (string): Job status - `"queued"`, `"running"`, `"completed"`, or `"failed"`
- `progress` (number): Progress percentage (0-100)
- `currentIteration` (number, optional): Current step in the research process (1-based)
- `totalIterations` (number, optional): Total expected steps (typically 5)
- `estimatedRemainingSeconds` (number, optional): Estimated time remaining in seconds (only when running)
- `createdAt` (string): ISO 8601 timestamp when job was created
- `updatedAt` (string): ISO 8601 timestamp when job was last updated
- `startedAt` (string, optional): ISO 8601 timestamp when job started processing
- `completedAt` (string, optional): ISO 8601 timestamp when job completed
- `result` (object, optional): Job result (only when status is "completed")
  - `summary` (string): Final synthesized research answer (Markdown format)
  - `sections` (array): Structured sections of the result
  - `citations` (array): Array of citation URLs
  - `researchSources` (array): Array of research sources with title, url, snippet
  - `debateRounds` (number): Number of debate rounds conducted
  - `modelAnswers` (array): Individual model answers with citations
  - `metadata` (object): Research metadata
    - `usedExternalSources` (boolean): Whether external research sources were used
    - `researchSourcesCount` (number): Number of research sources found
    - `citationsCount` (number): Number of citations extracted
    - `fallbackReason` (string | null): Reason for fallback if applicable (`"NO_EXTERNAL_SOURCES"`, `"NO_CITATIONS_EXTRACTED"`, or `null`)
    - `toolErrors` (array): Array of tool errors (currently empty)
- `error` (object, optional): Error details (only when status is "failed")
  - `code` (string): Error code (e.g., `"TIMEOUT"`, `"OPENROUTER_API_ERROR"`)
  - `message` (string): Human-readable error message

---

## 4. Query Mode with Deep Research (Synchronous - Deprecated)

**Note:** The synchronous deep research endpoint has been removed. Use the async job endpoint (`POST /api/v1/deep-research`) instead.

---

## Progress Calculation for Deep Research

For the frontend progress bar calculation:

```javascript
// Calculate progress percentage
const baseProgress = 10; // Initial 10%
const iterationProgress = (currentIteration / totalIterations) * 80; // 80% for iterations
const totalProgress = baseProgress + iterationProgress;

// Example: currentIteration = 3, totalIterations = 5
// Progress = 10 + (3/5 * 80) = 10 + 48 = 58%
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "statusCode": 400,
  "timestamp": "2025-12-15T10:00:00.000Z",
  "path": "/api/v1/query",
  "method": "POST",
  "message": "Prompt cannot exceed 8000 characters",
  "error": "Bad Request"
}
```

Common HTTP status codes:
- `200 OK`: Successful request
- `202 Accepted`: Job created successfully (deep research)
- `400 Bad Request`: Invalid request payload
- `404 Not Found`: Resource not found (e.g., job ID)
- `500 Internal Server Error`: Server error

