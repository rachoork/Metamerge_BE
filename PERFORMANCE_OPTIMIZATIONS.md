# Performance Optimizations for MetaMerge Backend

This document outlines the optimizations implemented to reduce latency and improve response times.

## Key Optimizations Implemented

### 1. **Early Judge Start** ⚡ (Biggest Impact)
- **What**: Start the judge model as soon as we have 2+ successful model responses, instead of waiting for all models
- **Impact**: Can save 5-15 seconds if some models are slow
- **How**: Uses promise wrapping to trigger judge when `min_models_for_judge` threshold is met
- **Config**: `enable_early_judge: true`, `min_models_for_judge: 2`

### 2. **Answer Truncation** 📝
- **What**: Truncate long model answers before sending to judge (max 2000 chars)
- **Impact**: Reduces judge processing time by 20-40% for long answers
- **How**: Truncates at word boundaries to preserve readability
- **Config**: `max_answer_length_for_judge: 2000`

### 3. **Optimized Judge Prompt** 🎯
- **What**: Reduced judge system prompt from ~200 to ~50 tokens
- **Impact**: Faster judge processing, lower token costs
- **How**: More concise instructions while maintaining quality

### 4. **HTTP Connection Pooling** 🔗
- **What**: Reuse HTTP connections with keep-alive
- **Impact**: Saves 50-200ms per request (connection overhead)
- **How**: Configured axios with keep-alive agents

### 5. **Concurrent Processing** ⚙️
- **What**: All model calls happen in parallel (already implemented)
- **Impact**: Total time = slowest model, not sum of all models

## Expected Performance Improvements

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Fast models (2s each) | ~7s | ~4s | ~43% faster |
| Mixed speeds (2s, 5s, 8s, 10s) | ~18s | ~7s | ~61% faster |
| All slow models | ~20s | ~20s | Same (no early start benefit) |

*Note: Times include judge processing (~2-3s)*

## Additional Optimization Ideas (Future)

### 1. **Streaming Responses**
- Stream judge response as it's generated
- Return partial results to client immediately
- **Impact**: Perceived latency reduction

### 2. **Model Prioritization**
- Call faster models first
- Start judge with fastest 2 models
- **Impact**: 2-5s improvement

### 3. **Caching**
- Cache similar prompts (hash-based)
- Return cached merged answers
- **Impact**: Near-instant for cached queries

### 4. **Faster Judge Model**
- Use `gpt-4o-mini` or `claude-3-haiku` for judge
- **Impact**: 1-3s faster judge processing
- **Trade-off**: Slightly lower merge quality

### 5. **Answer Summarization**
- Summarize answers before judge (if very long)
- **Impact**: Faster judge, but may lose detail

### 6. **Timeout Optimization**
- Reduce timeouts for faster models
- Use adaptive timeouts based on model speed
- **Impact**: Fail faster, start judge sooner

## Configuration Tuning

### For Maximum Speed:
```json
{
  "min_models_for_judge": 2,
  "enable_early_judge": true,
  "max_answer_length_for_judge": 1500,
  "judge_model": "openai/gpt-4o-mini",
  "per_model_timeout_ms": 15000
}
```

### For Maximum Quality:
```json
{
  "min_models_for_judge": 3,
  "enable_early_judge": true,
  "max_answer_length_for_judge": 3000,
  "judge_model": "openai/gpt-4o",
  "per_model_timeout_ms": 20000
}
```

## Monitoring

Track these metrics to measure optimization impact:
- `total_latency_ms` - Total request time
- `judge_latency_ms` - Judge processing time
- Model latencies - Individual model response times
- Early judge start rate - How often early judge triggers

Look for:
- Judge starting before all models complete
- Reduced total latency vs. sum of model latencies
- Lower judge processing times (from truncation)

