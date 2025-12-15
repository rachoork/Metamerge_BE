# Security Best Practices

## Environment Variables

### API Keys
- **NEVER commit API keys to version control**
- The `.env` file is already in `.gitignore` and will not be committed
- Use `.env.example` as a template for other developers

### Current Setup
- ✅ `.env` file is in `.gitignore`
- ✅ `.env.example` provides template without secrets
- ✅ API keys are loaded from environment variables only

## Security Checklist

### ✅ Implemented
- [x] Environment variables for sensitive data
- [x] `.env` in `.gitignore`
- [x] CORS configured for specific origins
- [x] Input validation with class-validator
- [x] Request size limits (max prompt length)

### 🔄 To Implement (Enterprise Features)
- [ ] Rate limiting per IP/user
- [ ] API key authentication for endpoints
- [ ] Request signing/verification
- [ ] HTTPS enforcement
- [ ] Security headers (Helmet)
- [ ] Input sanitization
- [ ] SQL injection prevention (if using DB)
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Audit logging
- [ ] Secrets rotation

## API Key Management

### For Production
1. Use a secrets management service (AWS Secrets Manager, HashiCorp Vault, etc.)
2. Rotate keys regularly
3. Use different keys for different environments
4. Monitor API key usage
5. Set up alerts for unusual activity

### For Development
- Keep `.env` local only
- Never share API keys in chat/email
- Use `.env.example` for documentation

## OpenRouter API Key

The OpenRouter API key is stored in `.env` as:
```
OPENROUTER_API_KEY=sk-or-v1-...
```

This key is:
- ✅ Not committed to git
- ✅ Loaded at runtime from environment
- ✅ Required for all LLM API calls

