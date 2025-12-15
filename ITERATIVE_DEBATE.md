# Iterative Debate System

## Overview

The iterative debate system allows models to refine their answers through multiple rounds, with the judge model providing feedback after each round. This creates a collaborative refinement process where models can see each other's answers and the judge's guidance.

## How It Works

### Flow

1. **Initial Answers**: All models provide initial answers in parallel
2. **Debate Rounds** (if enabled):
   - **Round 1+**: 
     - Judge evaluates current answers and provides brief feedback
     - All models see judge feedback + other models' answers
     - Models refine their answers in parallel
     - Repeat for configured number of rounds
3. **Final Judge Merge**: Judge merges the final refined answers

### Example Flow

```
Initial Answers (Round 0):
├─ Model A: "Answer A"
├─ Model B: "Answer B"  
└─ Model C: "Answer C"

↓ Judge Feedback Round 1
"Focus on clarity. Address edge cases."

↓ Models Refine (Round 1)
├─ Model A: "Refined Answer A"
├─ Model B: "Refined Answer B"
└─ Model C: "Refined Answer C"

↓ Judge Feedback Round 2
"Good improvements. Add examples."

↓ Models Refine (Round 2)
├─ Model A: "Final Answer A"
├─ Model B: "Final Answer B"
└─ Model C: "Final Answer C"

↓ Final Judge Merge
"Final Merged Answer"
```

## Configuration

In `config.json`:

```json
{
  "enable_debate": true,
  "max_debate_rounds": 2,
  "debate_timeout_ms": 10000,
  "judge_feedback_timeout_ms": 8000
}
```

- `enable_debate`: Enable/disable iterative debate (default: true)
- `max_debate_rounds`: Number of debate rounds (default: 2)
- `debate_timeout_ms`: Timeout per model in debate round (default: 10000ms)
- `judge_feedback_timeout_ms`: Timeout for judge feedback (default: 8000ms)

## Speed Optimizations

1. **Fast Timeouts**: Shorter timeouts (10s vs 20s) for debate rounds
2. **Truncated Inputs**: Answers truncated to 300-500 chars for judge feedback
3. **Parallel Processing**: All models refine simultaneously
4. **No Retries**: Debate rounds don't retry on failure (keeps speed)
5. **Concise Prompts**: Short, focused prompts for faster processing

## Performance Impact

- **Without Debate**: ~5-8 seconds total
- **With 2 Rounds Debate**: ~15-25 seconds total
  - Round 1: ~8-12s (judge feedback + model refinement)
  - Round 2: ~8-12s (judge feedback + model refinement)
  - Final merge: ~3-5s

## Error Handling

- If judge feedback fails: Uses generic feedback, continues debate
- If model fails in debate round: Keeps previous answer, continues
- If all models fail: Falls back to initial answers
- If debate fails entirely: Continues with initial answers to final judge

## Benefits

1. **Better Quality**: Models refine based on judge guidance
2. **Collaborative**: Models see and respond to each other
3. **Iterative Improvement**: Answers get better each round
4. **Fast**: Optimized for speed with short timeouts and truncation

## Trade-offs

- **Latency**: Adds 10-20 seconds for 2 rounds
- **Cost**: More API calls (judge feedback + model refinements)
- **Complexity**: More moving parts to manage

## Disabling Debate

Set `enable_debate: false` in config to skip debate and go straight to final judge merge.

