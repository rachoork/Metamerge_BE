export const APP_CONSTANTS = {
  DEFAULT_TIMEOUT_MS: 20000,
  DEFAULT_JUDGE_TIMEOUT_MS: 25000,
  DEFAULT_MAX_PROMPT_LENGTH: 8000,
  DEFAULT_MIN_MODELS_FOR_JUDGE: 2,
  DEFAULT_MAX_ANSWER_LENGTH: 5000,
  DEFAULT_DEBATE_ROUNDS: 2,
  DEFAULT_DEBATE_TIMEOUT_MS: 10000,
  DEFAULT_JUDGE_FEEDBACK_TIMEOUT_MS: 8000,
  MAX_MODELS_ALLOWED: 10,
  MIN_MODELS_REQUIRED: 1,
} as const;

export const ERROR_MESSAGES = {
  PROMPT_REQUIRED: 'Prompt is required and cannot be empty',
  PROMPT_TOO_LONG: (maxLength: number) => `Prompt cannot exceed ${maxLength} characters`,
  NO_MODELS_PROVIDED: 'At least one query model must be provided',
  ALL_MODELS_FAILED: 'All model calls failed',
  CONFIG_LOAD_FAILED: 'Failed to load configuration',
  API_KEY_MISSING: 'OPENROUTER_API_KEY environment variable is required',
} as const;

export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
  OK: 200,
} as const;

