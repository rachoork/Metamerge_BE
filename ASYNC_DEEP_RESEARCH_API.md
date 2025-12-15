# Async Deep Research Jobs API

## Overview
The async deep research API allows clients to start long-running research jobs that may take >5 minutes and poll for status/results without holding HTTP connections open.

## Endpoints

### 1. Create Deep Research Job
**Endpoint:** `POST /api/deep-research`

**Request:**
```json
{
  "query": "What are the latest developments in quantum computing?",
  "options": {
    "depth": 5,
    "language": "en",
    "queryModels": [
      { "id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI" }
    ],
    "judgeModel": {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "provider": "OpenAI"
    }
  }
}
```

**Response:** `202 Accepted`
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

**Notes:**
- Returns immediately (does not wait for research to complete)
- `options` field is optional
- If `queryModels` or `judgeModel` are not provided, defaults will be used

---

### 2. Get Job Status
**Endpoint:** `GET /api/deep-research/{jobId}`

**Response Examples:**

**Queued:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "progress": 0,
  "createdAt": "2025-12-15T04:00:00.000Z",
  "updatedAt": "2025-12-15T04:00:00.000Z"
}
```

**Running:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "progress": 45,
  "estimatedRemainingSeconds": 120,
  "createdAt": "2025-12-15T04:00:00.000Z",
  "updatedAt": "2025-12-15T04:00:05.000Z",
  "startedAt": "2025-12-15T04:00:01.000Z"
}
```

**Completed:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "result": {
    "summary": "Research-backed answer with citations...",
    "sections": [
      {
        "title": "Research Summary",
        "content": "...",
        "type": "summary"
      },
      {
        "title": "Citations",
        "content": ["url1", "url2"],
        "type": "citations"
      }
    ],
    "citations": ["url1", "url2"],
    "researchSources": [
      {
        "title": "Source Title",
        "url": "https://example.com",
        "snippet": "Relevant snippet..."
      }
    ],
    "debateRounds": 2,
    "modelAnswers": [...]
  },
  "createdAt": "2025-12-15T04:00:00.000Z",
  "updatedAt": "2025-12-15T04:05:30.000Z",
  "startedAt": "2025-12-15T04:00:01.000Z",
  "completedAt": "2025-12-15T04:05:30.000Z"
}
```

**Failed:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "progress": 0,
  "error": {
    "code": "RESEARCH_TIMEOUT",
    "message": "Deep research exceeded the max time budget"
  },
  "createdAt": "2025-12-15T04:00:00.000Z",
  "updatedAt": "2025-12-15T04:02:00.000Z",
  "startedAt": "2025-12-15T04:00:01.000Z",
  "completedAt": "2025-12-15T04:02:00.000Z"
}
```

**Error Codes:**
- `RESEARCH_TIMEOUT` - Research exceeded maximum time
- `RATE_LIMIT_EXCEEDED` - API rate limit exceeded
- `INVALID_INPUT` - Invalid input parameters
- `RESEARCH_FAILED` - General research failure

**404 Not Found:**
```json
{
  "message": "Job not found",
  "jobId": "invalid-job-id"
}
```

---

## Usage Example

### 1. Start a Research Job
```bash
curl -X POST http://localhost:3000/api/deep-research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the latest developments in quantum computing?",
    "options": {
      "queryModels": [
        {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI"}
      ],
      "judgeModel": {
        "id": "openai/gpt-4o",
        "name": "GPT-4o",
        "provider": "OpenAI"
      }
    }
  }'
```

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

### 2. Poll for Status
```bash
curl http://localhost:3000/api/deep-research/550e8400-e29b-41d4-a716-446655440000
```

**Polling Strategy:**
- Poll every 2-5 seconds while `status === "running"` or `status === "queued"`
- Stop polling when `status === "completed"` or `status === "failed"`
- Use exponential backoff if needed (e.g., 2s, 4s, 8s intervals)

### 3. Handle Results
- When `status === "completed"`, access `result` field
- When `status === "failed"`, check `error` field for details

---

## Implementation Details

### Job Store
- **Phase 1**: In-memory storage (jobs lost on server restart)
- **Future**: Persist to database (PostgreSQL, MongoDB, etc.)

### Background Worker
- Automatically processes queued jobs
- Processes one job at a time (can be scaled)
- Updates progress periodically
- Handles errors gracefully

### Progress Tracking
- Progress: 0-100 (percentage)
- Estimated remaining time in seconds
- Status transitions: `queued` → `running` → `completed`/`failed`

### Security (Future)
- User authentication required
- Jobs scoped to user (only owner can access)
- Rate limiting per user

---

## Error Handling

All endpoints return standard HTTP status codes:
- `202 Accepted` - Job created successfully
- `200 OK` - Job status retrieved successfully
- `400 Bad Request` - Invalid input
- `404 Not Found` - Job not found
- `500 Internal Server Error` - Server error

---

## Limitations (Phase 1)

1. **In-Memory Storage**: Jobs are lost on server restart
2. **No Authentication**: All jobs are accessible (add auth in future)
3. **Single Worker**: Processes one job at a time
4. **No Cancellation**: Cannot cancel running jobs (future feature)
5. **No Job History**: Old jobs are cleaned up after 24 hours

---

## Future Enhancements

- [ ] Database persistence (PostgreSQL/MongoDB)
- [ ] User authentication and authorization
- [ ] Job cancellation
- [ ] Multiple workers (parallel processing)
- [ ] Webhook notifications
- [ ] Job retry mechanism
- [ ] Job priority queue
- [ ] Job scheduling

