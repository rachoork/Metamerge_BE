# Git Ignore Guide - Files NOT to Commit

## ⚠️ CRITICAL - Never Commit These Files

### 1. Environment Variables (`.env`)
**Status**: ✅ Now ignored
- Contains your OpenRouter API key
- Contains sensitive credentials
- Should use `.env.example` as template instead

### 2. Build Output (`dist/`)
**Status**: ✅ Now ignored
- Generated TypeScript compilation output
- Can be regenerated with `npm run build`
- Should not be in version control

### 3. Dependencies (`node_modules/`)
**Status**: ✅ Already ignored
- Installed via `npm install`
- Can be regenerated from `package.json`
- Too large for git

### 4. TypeScript Build Info (`*.tsbuildinfo`)
**Status**: ✅ Now ignored
- TypeScript incremental build cache
- Generated automatically
- Can be regenerated

## 📋 Files That SHOULD Be Committed

✅ `.env.example` - Template for environment variables (no secrets)
✅ `config.json` - Application configuration (no secrets)
✅ `package.json` - Dependencies list
✅ `tsconfig.json` - TypeScript configuration
✅ `src/` - Source code
✅ `README.md` - Documentation
✅ All `.md` documentation files

## 🔍 How to Verify

```bash
# Check what's being tracked
git status

# Check what's ignored
git status --ignored

# Verify .env is not tracked
git ls-files | grep .env
```

## 🚨 If You Already Committed Sensitive Files

If you accidentally committed `.env` or other sensitive files:

```bash
# Remove from git (but keep local file)
git rm --cached .env

# Remove from git history (if already pushed)
# WARNING: This rewrites history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team first!)
git push origin --force --all
```

## ✅ Current Status

- ✅ `.env` - Ignored (contains API key)
- ✅ `dist/` - Ignored (build output)
- ✅ `node_modules/` - Ignored (dependencies)
- ✅ `*.tsbuildinfo` - Ignored (TypeScript cache)
- ✅ `.DS_Store` - Ignored (macOS files)
- ✅ Log files - Ignored
- ✅ IDE files - Ignored

