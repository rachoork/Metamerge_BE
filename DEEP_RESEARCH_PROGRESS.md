# Deep Research Progress Tracking

## Progress Percentage in Status Response

**Yes, we are sending the progress percentage (0-100) in every status check response.**

### Response Structure

When you call `GET /api/v1/deep-research/{jobId}`, the response includes:

```json
{
  "jobId": "b6595e0f-81e3-4d03-8e79-657bfb1b7002",
  "status": "running",
  "progress": 60,  // ← Progress percentage (0-100)
  "currentIteration": 3,
  "totalIterations": 5,
  "estimatedRemainingSeconds": 120,
  "createdAt": "2025-12-15T10:00:00.000Z",
  "updatedAt": "2025-12-15T10:02:00.000Z"
}
```

### Progress Calculation

The progress is calculated and updated throughout the deep research process:

1. **Initial (0%)**: Job created, queued
2. **Iteration 1 (10%)**: Web research started
3. **Iteration 2 (30%)**: Getting initial model answers
4. **Iteration 3 (50%)**: Conducting debate round 1
5. **Iteration 4 (70%)**: Conducting debate round 2
6. **Iteration 5 (100%)**: Judge synthesis complete

### Progress Formula

The progress percentage is calculated as:
- Base progress: 10% (initial)
- Iteration progress: `10% + (currentIteration / totalIterations) * 80%`
- Final progress: 100% when completed

Example:
- `currentIteration = 3`, `totalIterations = 5`
- Progress = `10 + (3/5 * 80)` = `10 + 48` = **58%**

### Frontend Usage

The frontend can use the progress in two ways:

1. **Direct percentage**: Use `progress` field directly (0-100)
2. **Calculate from iterations**: Use `currentIteration` and `totalIterations` for more granular control

```javascript
// Option 1: Use direct progress percentage
const progressPercentage = response.progress; // 0-100

// Option 2: Calculate from iterations (more granular)
const baseProgress = 10;
const iterationProgress = (response.currentIteration / response.totalIterations) * 80;
const calculatedProgress = baseProgress + iterationProgress;
```

### Progress Updates

Progress is updated:
- ✅ When job status changes (queued → running → completed)
- ✅ At each iteration step (1, 2, 3, 4, 5)
- ✅ On every status check request (returns current progress)
- ✅ When job completes (set to 100%)

### Response Fields for Progress

| Field | Type | Description |
|-------|------|-------------|
| `progress` | `number` | Progress percentage (0-100) |
| `currentIteration` | `number?` | Current step (1-based, optional) |
| `totalIterations` | `number?` | Total expected steps (typically 5, optional) |
| `estimatedRemainingSeconds` | `number?` | Estimated time remaining (only when running) |

### Example Status Check Flow

```javascript
// Poll for status
const checkStatus = async (jobId) => {
  const response = await fetch(`/api/v1/deep-research/${jobId}`);
  const data = await response.json();
  
  console.log(`Progress: ${data.progress}%`);
  console.log(`Iteration: ${data.currentIteration}/${data.totalIterations}`);
  
  if (data.status === 'completed') {
    console.log('Job complete!', data.result);
  } else if (data.status === 'running') {
    // Update progress bar
    updateProgressBar(data.progress);
    // Poll again after delay
    setTimeout(() => checkStatus(jobId), 2000);
  }
};
```

### Notes

- Progress is **always** included in the response (even if 0%)
- Progress is clamped to 0-100 range
- Progress updates are stored in the job and persist across status checks
- When `status === "completed"`, `progress` is always `100`
- When `status === "failed"`, `progress` reflects the last completed step

