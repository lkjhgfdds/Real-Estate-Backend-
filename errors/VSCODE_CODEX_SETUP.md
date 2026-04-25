# ═══════════════════════════════════════════════════════════
# FILE 1: .github/copilot-instructions.md
# (GitHub Copilot بيقراه تلقائياً في كل conversation)
# ═══════════════════════════════════════════════════════════

---

You are a Senior Backend Engineer specializing in Node.js, Express 5, MongoDB, and Mongoose.
You are fixing a production real-estate backend that has been professionally audited.

## YOUR IDENTITY & BEHAVIOR:
- You think like a Tech Lead reviewing code before it goes to 1M+ users
- You never guess — you always read the actual file before suggesting a fix
- You fix ONE thing at a time — no scope creep
- You never add new npm packages without explicit approval
- You always run tests after every fix
- You write CommonJS (require/module.exports) — never ESM
- You use Winston logger — never console.log/console.error
- You use AppError for all operational errors — never throw raw Error in controllers

## PROJECT STACK:
- Node.js 20 (CommonJS)
- Express 5
- MongoDB 7 + Mongoose 9
- Jest + Supertest + mongodb-memory-server (tests)
- Winston (logging)
- Redis (cache — optional fallback to Map)
- Railway (deployment)
- bcrypt (passwords), AES-256-GCM (IBAN encryption)
- JWT access (15min) + refresh tokens (httpOnly cookie)

## CRITICAL PROJECT RULES:
1. Never touch .env — only .env.example
2. Never commit secrets or credentials
3. Never modify test setup files (globalSetup.js, setup.js)
4. Always preserve existing API response shape: { status, data, message }
5. Always preserve existing route paths — no breaking changes
6. After every fix: run `npm test` and confirm it passes
7. Every DB write that has 2+ operations MUST use mongoose session transaction
8. Every read-only query MUST use .lean()
9. Error handling pattern: asyncHandler + AppError — no raw try/catch in controllers

## RESPONSE FORMAT FOR EVERY FIX:
```
📋 TASK: [name]
📁 FILES CHANGED: [list]

🔍 ROOT CAUSE:
[exact technical explanation — no vague statements]

❌ BEFORE: [file:line]
[old code]

✅ AFTER: [file:line]  
[new code]

🧪 TESTS TO RUN:
[exact commands]

⚠️ SIDE EFFECTS:
[any other files affected]
```

---

# ═══════════════════════════════════════════════════════════
# FILE 2: AGENTS.md  
# (ضعه في root المشروع — بيُقرأ من Codex CLI و Copilot Workspace)
# ═══════════════════════════════════════════════════════════

---

# Real Estate Backend — Agent Instructions

## WHO YOU ARE
Senior Backend Engineer. Node.js / Express 5 / MongoDB / Mongoose specialist.
Fixing production vulnerabilities based on a professional audit report.

## BEFORE YOU TOUCH ANY FILE:
1. Read the file completely
2. Understand what it currently does
3. Identify ONLY what needs to change for this specific task
4. Make the minimal change — nothing extra

## HARD RULES (violations = task failed):
- NO new npm packages without approval
- NO ESM syntax (import/export) — use require/module.exports
- NO console.log — use logger from src/utils/logger.js
- NO raw Error throws in controllers — use new AppError(message, statusCode)
- NO try/catch in controllers — use asyncHandler wrapper
- NO modifying .env — only .env.example
- NO changing API response shape or route paths
- NO touching test infrastructure files

## TASK EXECUTION PROTOCOL:
1. Read relevant files
2. Identify exact lines to change
3. Make change
4. Run: npm test -- --testPathPattern=[related-test]
5. If tests fail: fix the regression before moving on
6. Run: npm test -- --coverage
7. Confirm coverage didn't drop

## CURRENT TASK QUEUE (work in order, one at a time):

### PHASE 1 — EMERGENCY (must complete before anything else)
- [ ] T1: Remove rawOTP from resendOTP response
- [ ] T2: Fix middleware order in server.js  
- [ ] T3: Add { algorithms: ['HS256'] } to jwt.verify calls
- [ ] T4: Fix mongoSanitize regex missing 'g' flag
- [ ] T5: Fix broken /auth/me route reference
- [ ] T6: Add ownership check to updateProperty + deleteProperty
- [ ] T7: Make placeBid atomic with mongoose session transaction
- [ ] T8: Replace all console.* with logger.* in auth + email files

### PHASE 2 — SECURITY
- [ ] T9: Add ENCRYPTION_KEY to .env.example with generation note
- [ ] T10: Increase password minimum length from 6 to 8
- [ ] T11: Fix CORS wildcard fallback (fail-closed)
- [ ] T12: Add tokenVersion check to JWT protect middleware
- [ ] T13: Add magic-bytes file type validation to upload middleware

### PHASE 3 — PERFORMANCE
- [ ] T14: Add .lean() to all read-only queries in controllers
- [ ] T15: Fix APIFeatures.search() to use $text instead of $regex
- [ ] T16: Add compound indexes to Property, Booking, Bid, Notification models
- [ ] T17: Parallelize getMe dashboard queries with Promise.all

### PHASE 4 — ARCHITECTURE
- [ ] T18: Extract property.service.js from fat property controller
- [ ] T19: Unify error handling — asyncHandler everywhere
- [ ] T20: Delete dead server/ and drizzle/ directories + related config files

### PHASE 5 — DEVOPS
- [ ] T21: Write Dockerfile (multi-stage, Node 20 LTS, non-root)
- [ ] T22: Write docker-compose.yml (app + mongo + redis)
- [ ] T23: Write .github/workflows/ci.yml (lint → test → audit → deploy)
- [ ] T24: Raise jest coverage threshold to 80%
- [ ] T25: Write tests/auction.test.js (including concurrency test)

---

# ═══════════════════════════════════════════════════════════
# FILE 3: .vscode/tasks.json
# (اختصارات لتشغيل الـ tasks من VS Code مباشرة)  
# ═══════════════════════════════════════════════════════════

{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "🧪 Run All Tests",
      "type": "shell",
      "command": "npm test",
      "group": "test",
      "presentation": { "reveal": "always", "panel": "shared" }
    },
    {
      "label": "🧪 Run Tests with Coverage",
      "type": "shell", 
      "command": "npm test -- --coverage",
      "group": "test",
      "presentation": { "reveal": "always", "panel": "shared" }
    },
    {
      "label": "🔐 Run Auth Tests Only",
      "type": "shell",
      "command": "npm test -- --testPathPattern=auth",
      "group": "test"
    },
    {
      "label": "🏠 Run Property Tests Only",
      "type": "shell",
      "command": "npm test -- --testPathPattern=property",
      "group": "test"
    },
    {
      "label": "💰 Run Auction Tests Only",
      "type": "shell",
      "command": "npm test -- --testPathPattern=auction",
      "group": "test"
    },
    {
      "label": "🔍 Security Audit",
      "type": "shell",
      "command": "npm audit --audit-level=high",
      "group": "build"
    },
    {
      "label": "🧹 Find console.log in src/",
      "type": "shell",
      "command": "grep -rn 'console\\.' src/ --include='*.js'",
      "group": "build"
    },
    {
      "label": "🚀 Start Dev Server",
      "type": "shell",
      "command": "npm run dev",
      "group": "build",
      "isBackground": true
    }
  ]
}

---

# ═══════════════════════════════════════════════════════════
# PART 4 — PROMPTS للـ VS CODE COPILOT CHAT (Agent Mode)
# اكتب كل prompt في chat بعد @workspace
# ═══════════════════════════════════════════════════════════

## ─────────────────────────────────────
## T1 — rawOTP Fix
## ─────────────────────────────────────

@workspace
Task T1 from AGENTS.md: Fix rawOTP security vulnerability.

Read src/controllers/auth/auth.controller.js
Find the resendOTP function.
Remove the `rawOTP: otp` field from the JSON response.
That single field exposes the OTP to any caller — it completely
bypasses email verification.

Rules:
- Change ONLY that one line
- Do not touch any other function
- Run npm test -- --testPathPattern=auth after

Show me before/after diff, then make the change.

## ─────────────────────────────────────
## T2 — Middleware Order Fix
## ─────────────────────────────────────

@workspace
Task T2 from AGENTS.md: Fix middleware execution order in server.js

Read src/server.js completely.
The bug: mongoSanitize(), xssClean(), hpp() are mounted BEFORE
express.json() — so req.body is undefined when they execute.
All XSS and NoSQL injection protection is silently disabled.

Fix: Reorder middleware so express.json() and express.urlencoded()
come BEFORE mongoSanitize(), xssClean(), hpp().

Rules:
- Only reorder — do not change any middleware configuration
- Do not touch helmet, cors, rate limiters, or routes
- Run npm test after

Show me the exact before/after line order, then apply the fix.

## ─────────────────────────────────────
## T3 — JWT Algorithm Fix
## ─────────────────────────────────────

@workspace
Task T3 from AGENTS.md: Add JWT algorithm specification.

Read src/utils/jwt.js completely.
The bug: jwt.verify() calls don't specify { algorithms: ['HS256'] }
This enables algorithm confusion attacks.

Fix: Add { algorithms: ['HS256'] } as third argument to:
1. verifyAccessToken function
2. verifyRefreshToken function

Do NOT touch signToken or signRefreshToken.
Run npm test -- --testPathPattern=auth after.

Show before/after for both functions, then apply.

## ─────────────────────────────────────
## T4 — mongoSanitize Regex Fix
## ─────────────────────────────────────

@workspace
Task T4 from AGENTS.md: Fix mongoSanitize regex missing global flag.

Read src/utils/mongoSanitize.js completely.
The bug: key.replace(/\./, '_') — missing 'g' flag.
'a.b.c' becomes 'a_b.c' — dot still present, still injectable.

Fix: Change replace(/\./, '_') to replace(/\./g, '_')

One character. Do NOT change anything else in this file.
Run npm test after.

## ─────────────────────────────────────
## T5 — Fix Broken /auth/me Route
## ─────────────────────────────────────

@workspace
Task T5 from AGENTS.md: Fix broken /auth/me route.

Read these files:
1. src/routes/auth.routes.js  
2. src/controllers/auth/auth.controller.js
3. src/controllers/user.controller.js

The bug: auth.routes.js calls authController.getMe but that 
function doesn't exist in auth.controller.js (it was moved to 
user.controller.js). Every GET /api/v1/auth/me crashes with 500.

Fix: In auth.routes.js, import userController and change:
  router.get('/me', protect, authController.getMe)
to:
  router.get('/me', protect, userController.getMe)

Only change auth.routes.js. Don't touch the controllers.
Run npm test -- --testPathPattern=auth after.

## ─────────────────────────────────────
## T6 — Property Ownership Check
## ─────────────────────────────────────

@workspace
Task T6 from AGENTS.md: Add ownership check to property mutations.

Read these files:
1. src/controllers/property/property.controller.js
2. src/utils/AppError.js

The bug: updateProperty() and deleteProperty() have no check that
req.user._id === property.owner. Any logged-in user can modify
or delete any property in the system.

Fix: In BOTH updateProperty and deleteProperty, after the 
Property.findById() call (and null check), add:

  if (property.owner.toString() !== req.user._id.toString() 
      && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized to modify this property', 403));
  }

Do NOT add this check to getProperty, getAllProperties, or any read endpoints.
Run npm test -- --testPathPattern=property after.

## ─────────────────────────────────────
## T7 — Atomic Bid Placement
## ─────────────────────────────────────

@workspace
Task T7 from AGENTS.md: Fix bid race condition with MongoDB transaction.

Read src/controllers/bid/bid.controller.js completely.

The bug: placeBid() reads auction, validates bid amount, then does
3 separate DB writes without a transaction. Under concurrent load,
two users can both pass validation and both become winning bidder.
This is a financial data corruption bug.

Fix: Wrap the 3 DB operations in a mongoose session transaction:
  const mongoose = require('mongoose'); // if not already required
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Re-read auction WITH session for isolation:
    const auction = await Auction.findById(auctionId).session(session);
    // ... all existing validation logic ...
    await Bid.updateMany({ auction: auctionId, isWinning: true }, 
                          { isWinning: false }, { session });
    const [newBid] = await Bid.create([{ ...bidData }], { session });
    await Auction.findByIdAndUpdate(auctionId, 
      { currentBid: amount }, { session, new: true });
    await session.commitTransaction();
    res.status(201).json({ status: 'success', data: { bid: newBid } });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

Note: Bid.create() with session requires array syntax: Bid.create([data], {session})
Run npm test -- --testPathPattern=auction after.

## ─────────────────────────────────────
## T8 — Replace console.log with Logger
## ─────────────────────────────────────

@workspace
Task T8 from AGENTS.md: Replace console.* with Winston logger.

Read these files:
1. src/controllers/auth/auth.controller.js
2. src/services/email.service.js
3. src/utils/logger.js (to understand the logger interface)

The bug: Both files use console.log/console.error which:
- Bypasses structured logging
- Leaks PII (email addresses) to raw stdout
- Doesn't appear in log files

Fix:
- In auth.controller.js: logger is already imported — just replace
  every console.log → logger.info, console.error → logger.error
- In email.service.js: add const logger = require('../utils/logger')
  at the top, then replace all console.* calls

Do NOT change any logic — only replace console.* calls.
Run npm test after.

## ─────────────────────────────────────
## T14 — Add .lean() to Read Queries
## ─────────────────────────────────────

@workspace
Task T14 from AGENTS.md: Add .lean() to read-only queries.

Read these files:
1. src/controllers/property/property.controller.js
2. src/controllers/search/search.controller.js
3. src/controllers/dashboard/dashboard.controller.js

Rule: Any Mongoose find/findById that feeds directly into res.json()
must use .lean() to avoid Mongoose document overhead at scale.

IMPORTANT — Do NOT add .lean() when:
- The result is used to call .save() afterwards
- The result needs virtuals populated
- The document needs Mongoose methods

Add .lean() to every other find/findById chain.

Run npm test after each file change.
Show me every line you're adding .lean() to.

## ─────────────────────────────────────
## T16 — Add Compound Indexes
## ─────────────────────────────────────

@workspace
Task T16 from AGENTS.md: Add missing compound indexes.

Read these files:
1. src/models/property.model.js
2. src/models/booking.model.js
3. src/models/bid.model.js
4. src/models/notification.model.js

Add these indexes (they are missing and cause full collection scans):

property.model.js → add after existing indexes:
  propertySchema.index({ isApproved: 1, status: 1 });

booking.model.js → add:
  bookingSchema.index({ userId: 1, createdAt: -1 });
  bookingSchema.index({ property_id: 1, status: 1 });

bid.model.js → add:
  bidSchema.index({ auction: 1, isWinning: 1 });
  bidSchema.index({ auction: 1, amount: -1 });

notification.model.js → add:
  notificationSchema.index({ userId: 1, createdAt: -1 });
  notificationSchema.index({ userId: 1, isRead: 1 });

Do NOT remove or modify existing indexes.
Run npm test after.

## ─────────────────────────────────────
## T18 — Extract property.service.js
## ─────────────────────────────────────

@workspace
Task T18 from AGENTS.md: Extract property.service.js from fat controller.

Read src/controllers/property/property.controller.js completely.

The problem: this controller imports 7+ models and handles
Cloudinary logic, cache invalidation, and saved search notifications
inline — violating separation of concerns.

Step 1: Create src/services/property.service.js
Extract these into it as exported functions:
  - processUploadedImages(files) — parse Cloudinary URLs from multer
  - deletePropertyImages(imageUrls) — delete from Cloudinary
  - invalidatePropertyCaches(cacheClient, propertyId) — clear cache keys
  - notifyMatchingSavedSearches(io, property) — emit socket events

Step 2: Update property.controller.js
  - Import and call the service functions
  - Remove the extracted inline logic
  - Controller functions should only: parse request → call service → send response

Do NOT change any function signatures or API behavior.
Run npm test -- --testPathPattern=property after both files are done.

## ─────────────────────────────────────
## T21 — Dockerfile
## ─────────────────────────────────────

@workspace
Task T21 from AGENTS.md: Write production Dockerfile.

Read package.json to confirm:
- Node version requirement
- Start command (node src/server.js)
- All dependencies

Write two files:

1. Dockerfile:
- Multi-stage: builder stage (installs all deps + any build steps)
  then production stage (only copies node_modules from builder)
- Base: node:20-alpine
- Non-root user: USER node
- WORKDIR /app
- Health check: GET /api/health every 30s
- Expose PORT env variable (default 3000)
- CMD ["node", "src/server.js"]

2. .dockerignore:
- node_modules, .env, logs/, coverage/, .git,
  server/ (dead code), drizzle/ (dead code), *.test.js

Show me both complete files.

## ─────────────────────────────────────
## T23 — GitHub Actions CI/CD
## ─────────────────────────────────────

@workspace
Task T23 from AGENTS.md: Write GitHub Actions CI/CD pipeline.

Read:
1. package.json (for scripts)
2. jest.config.js (for coverage config)
3. railway.json (for deployment config)

Write .github/workflows/ci.yml with:

JOB 1 — "test" (runs on every push and PR):
  - ubuntu-latest, Node 20
  - npm ci
  - npm run lint (only if lint script exists in package.json)
  - npm test -- --coverage --ci
  - Fail if coverage < 80% (branches: 70, functions: 80, lines: 80)
  - npm audit --audit-level=high
  - Upload coverage report as artifact

JOB 2 — "deploy" (runs ONLY on push to main, needs test job to pass):
  - Trigger Railway deploy via webhook
  - Use secret: RAILWAY_WEBHOOK_URL
  - Only runs if NODE_ENV would be production

Required GitHub Secrets (add as comment at top of file):
  RAILWAY_WEBHOOK_URL

Show me the complete .github/workflows/ci.yml file.

---

# ═══════════════════════════════════════════════════════════
# PART 5 — SETUP GUIDE (خطوات إعداد VS Code)
# ═══════════════════════════════════════════════════════════

## الخطوة 1: ضع الملفات في مكانها

```
real-estate-backend/
├── .github/
│   └── copilot-instructions.md   ← PART 1 من الملف ده
├── AGENTS.md                      ← PART 2 من الملف ده
├── .vscode/
│   └── tasks.json                 ← PART 3 من الملف ده
└── src/
    └── ...
```

## الخطوة 2: افتح VS Code وفعّل Copilot Chat

```
Ctrl+Shift+P → "GitHub Copilot Chat: Focus on Chat View"
```

## الخطوة 3: غيّر Copilot لـ Agent Mode

في الـ Chat panel:
- اضغط على dropdown بجانب "Ask Copilot"  
- اختار **"Agent"** أو **"Edits"**
- ده بيخليه يقدر يعدل ملفات فعلياً

## الخطوة 4: ابدأ الشغل

انسخ prompt T1 من PART 4 واكتبه في الـ Chat

## الخطوة 5: بعد كل fix

```bash
# في الـ terminal:
git add [changed-file]
git commit -m "fix(T1): remove rawOTP exposure from resendOTP"
git push origin main
```

## تسلسل الـ commits المثالي:

```
fix(T1): remove rawOTP exposure from resendOTP response
fix(T2): move body parsers before sanitization middleware  
fix(T3): add algorithm specification to jwt.verify calls
fix(T4): fix mongoSanitize regex missing global flag
fix(T5): fix broken auth/me route reference to userController
fix(T6): add ownership authorization to property mutations
fix(T7): wrap placeBid in mongoose session transaction
fix(T8): replace console.log with winston logger
...
```

## إذا Copilot هلوس (لم يقرأ الملف الفعلي):

```
Stop. Before suggesting anything:
1. Open src/[filename].js
2. Read it completely  
3. Show me the current content of the specific function
4. Then and only then suggest the fix
```

## إذا قطع الـ response في النص:

```
Continue. Show me the rest of the file from where you stopped.
Do not repeat what you already showed me.
```
