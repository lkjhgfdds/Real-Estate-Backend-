# Real Estate Backend API

**Comprehensive project documentation — Node.js · Express 5 · MongoDB · Mongoose · Socket.IO**

**Version:** 4.0.0 | **Type:** CommonJS | **Status:** production-ready structure | ⚠️ needs fixes

**Project Metrics:**
- 95 source files
- 18 API route modules
- 14 Mongoose models
- 4 background jobs

---

## 1. Executive Overview

A full-featured real estate management REST API. The system handles property listings, multi-provider online payments, KYC (Know Your Customer) identity verification, live auction bidding, booking management, user notifications, saved property searches, and a detailed analytics dashboard — all delivered over HTTP REST and real-time Socket.IO channels.

The project demonstrates genuine production thinking: refresh token rotation, AES-256-GCM IBAN encryption, idempotent payment webhooks, MongoDB session transactions, and a Redis caching layer with in-memory fallback. It is not auto-generated boilerplate, but it carries several significant security defects that must be resolved before serving real traffic.

**Technology Stack:**
- Node.js 20 (CommonJS)
- Express 5.2
- MongoDB 7 / Mongoose 9
- Socket.IO 4
- Redis (ioredis)
- Cloudinary
- JWT + bcrypt
- Winston logging
- node-cron
- Swagger/OpenAPI
- Railway deployment
- Jest + Supertest

---

## 2. Architecture & Folder Structure

### Layer Architecture

```
Client (HTTP / WebSocket)
    ↓ JWT Bearer / httpOnly cookie
Middleware chain (Helmet · CORS · Rate limit · Sanitize · Auth)
    ↓
Router (18 route files, versioned under /api/v1)
    ↓
Controllers (feature-grouped — auth/property/bid/kyc…)
    ↓
Services (PaymentService · booking.service · analytics · email…)
    ↓
Models (Mongoose schemas)
    ↓
MongoDB Atlas + Redis + Cloudinary
```

### Directory Map

| Path | Description |
|------|-------------|
| `src/server.js` | Entry point — Express app + HTTP server + startup |
| `src/config/` | db, redis, socket, cloudinary — connection bootstraps |
| `src/controllers/` | Feature-grouped: auth/, property/, bid/, booking/, kyc/, dashboard/, admin/, search/, auction/, webhook/ |
| `src/services/` | PaymentService (class), booking.service, analytics.service, email.service, savedSearch.service; providers/ (factory, paymob, paypal, cash, bank_transfer) |
| `src/models/` | 14 Mongoose schemas — User, Property, Booking, Payment, Auction, Bid, Review, Favorite, Notification, RefreshToken, SavedSearch, Inquiry, ViewingRequest, PropertyView |
| `src/middlewares/` | auth, error, cache, upload, isOwner, kyc, restrictTo, pagination, rateLimit, requestLogger, trackView, validation |
| `src/routes/` | 18 route files, each co-located with Swagger JSDoc annotations |
| `src/validators/` | express-validator schemas for auth, property, booking, auction, review, inquiry, payment |
| `src/utils/` | AppError, asyncHandler, APIFeatures, jwt, logger, encryption.utils, mongoSanitize, notificationHelper, socket, sendEmail, constants |
| `src/jobs/` | auction.job, booking.job, savedSearch.job, payment-expiry.job |
| `src/docs/` | swagger.js — OpenAPI 3 setup, disabled in production |
| `tests/` | auth, property, booking, health, comprehensive — 1031 lines total |

---

## 3. Data Models (Mongoose Schemas)

### User

**Core Fields:**

| Field | Type / Notes |
|-------|--------------|
| `name` | String, 3–50 chars, required |
| `email` | String, unique, lowercase, regex validated |
| `password` | String, min 8, select:false, bcrypt(12) |
| `role` | enum: buyer \| owner \| agent \| admin, default buyer |
| `isVerified / isActive / isBanned` | Boolean flags |
| `tokenVersion` | Number — invalidates all tokens on password change |
| `otpHash / otpExpires / otpAttempts` | select:false — SHA-256 hashed OTP, 10min TTL, max 5 tries |
| `passwordResetToken / Expiry` | select:false — hashed token, 15min TTL |
| `loginAttempts / lockUntil` | Brute-force protection — 5 fails → 15min lock |

**Security Fields:**

| Field | Type / Notes |
|-------|--------------|
| `kycStatus` | enum: not_submitted\|pending\|approved\|rejected, indexed |
| `kycDocuments[]` | Embedded array: type, frontImage (Cloudinary URL), backImage, uploadedAt |
| `bankAccounts[]` | Embedded: ibanEncrypted (AES-256-GCM), ibanLast4, bankName, isDefault |
| `passwordChangedAt` | select:false — used to invalidate old JWTs |

**Model Methods:**
- `comparePassword(pwd)` — bcrypt.compare
- `createOTP()` — generates 6-digit OTP, stores SHA-256 hash
- `verifyOTP(otp)` — constant-time compare, increments otpAttempts
- `isLocked()` — checks lockUntil against Date.now
- `incLoginAttempts()` — handles lock reset + increment

**Pre-save Hook:**
Hashes password with bcrypt(12) on modification; sets `passwordChangedAt`, increments `tokenVersion`.

---

### Property

| Field | Notes |
|-------|-------|
| `title, description` | Required, min 10/20 chars |
| `price` | Number, min 0 |
| `type` | apartment\|villa\|house\|studio\|office\|shop\|land\|commercial |
| `listingType` | sale\|rent |
| `status` | available\|reserved\|sold |
| `location` | Embedded: city (req), district (req), street |
| `area, bedrooms, bathrooms` | Numbers with min:0 |
| `images[]` | Cloudinary URLs array |
| `owner` | ObjectId ref:User |
| `avgRating` | 0–5, set() rounds to 1dp |
| `isApproved` | Admin must approve before listing |

**Indexes:**
- price, type, listingType, location.city, owner, status (single)
- `{ isApproved:1, status:1 }` compound
- `{ owner:1, createdAt:-1 }` compound
- Full-text on title+description+city+district with weights (10/5/5/1)

**Virtuals:**
Virtual populate `reviews` → Review model via propertyId

---

### Booking

| Field | Notes |
|-------|-------|
| `user_id / property_id` | ObjectId refs (snake_case with alias) |
| `amount` | Required number |
| `start_date / end_date` | Date fields with aliases startDate/endDate |
| `status` | pending\|approved\|rejected\|cancelled\|completed |
| `paymentStatus` | not_initiated\|pending\|paid\|refunded, indexed |
| `paidAmount / paymentId` | Payment tracking |

**Indexes:**
- `{property_id,start_date,end_date}` — availability check
- `{user_id,created_at:-1}` — booking history pagination
- `{property_id,status}` — owner dashboard

---

### Payment

**Fields:** user, property, booking, propertyPrice, platformFee (2.5%), netAmount, totalAmount, currency (EGP/USD/EUR), paymentMethod (cash|bank_transfer|paypal|paymob), status (pending|completed|failed|refunded|expired), isVerified (idempotency guard), expiresAt (30min TTL), transactionId, ipAddress, userAgent, refundReason

**Critical index:** `{booking,status}` unique sparse partial on pending+completed — prevents double payments

---

### Auction

| Field | Notes |
|-------|-------|
| `property / seller` | ObjectId refs |
| `startingPrice / currentBid / bidIncrement` | Numbers; currentBid set to startingPrice on create |
| `startDate / endDate` | Required dates |
| `status` | upcoming\|active\|closed\|cancelled |
| `winner` | ObjectId ref:User, set on close |
| `isApproved` | Admin approval required |

**Virtuals:**
- `isLive` — status===active AND now between dates
- `remainingSeconds` — seconds until endDate

---

### Bid

| Field | Notes |
|-------|-------|
| `auction / bidder` | ObjectId refs, required |
| `amount` | Number, min:0, required |
| `isWinning` | Boolean — only one should be true per auction |

**Indexes:**
- `{auction,amount:-1}` — bid leaderboard
- `{auction,isWinning}` — winning bid lookup
- `{bidder}` — user bid history
- `{auction,createdAt:-1}`

---

### RefreshToken

**Fields:** userId, tokenHash (SHA-256), expiresAt, isRevoked, revokedAt, replacedByToken, userAgent, ip. TTL index on expiresAt (MongoDB auto-deletes expired docs).

**Static methods:** hashToken(), generateToken()

**Instance methods:** revoke(), isActive()

---

### Other Models

**Notification:** userId, type (booking|payment|inquiry|viewing|auction|review|system), title, message, isRead, link, meta. Indexes: {userId,createdAt:-1} and {userId,isRead}.

**SavedSearch:** userId, name, filters object (type, listingType, city, district, minPrice, maxPrice, minArea, maxArea, bedrooms, bathrooms), notifyOnMatch (bool), lastNotifiedAt. Index: {userId}. Max 10 per user enforced in controller.

**Review:** userId, propertyId, rating (1–5), comment. Linked via virtual populate on Property.

**Inquiry / ViewingRequest:**
- **Inquiry:** buyer to owner free-text message about a property. Fields: userId, propertyId, message, status (open|answered|closed).
- **ViewingRequest:** schedule a physical viewing. Fields: userId, propertyId, scheduledDate, status (pending|approved|rejected|cancelled), notes.

**Favorite:** user_id, property_id. Unique compound index prevents duplicate favorites.

**PropertyView:** Tracks page views per property for analytics. Fields: propertyId, userId (optional for anon), viewedAt, ipAddress, userAgent.

---

## 4. Authentication & Security System

### Auth Flow

```
POST /register → create user (role:buyer forced) → generate OTP → SHA-256 hash stored → email sent

POST /verify-otp → verifyOTP() — max 5 attempts → isVerified = true

POST /login → account lock check → bcrypt compare → signToken(id, tokenVersion) → access token (15m) in JSON

refresh token (30d) → SHA-256 hash stored in RefreshToken collection → httpOnly cookie (SameSite:strict)
```

### Token Verification (protect middleware)

- Extract Bearer token from Authorization header
- jwt.verify() with `{ algorithms: ['HS256'] }`
- Load user + select passwordChangedAt, isActive, isBanned, isVerified
- Check isActive, isBanned, isVerified flags
- Compare `decoded.iat` vs `passwordChangedAt`
- Compare `decoded.tokenVersion` vs `user.tokenVersion`
- Attach `req.user` and pass to next()

### Security Layers Applied

- Helmet with explicit CSP directives
- CORS restricted to CLIENT_URL (fails closed if not set)
- express-mongo-sanitize (NoSQL injection)
- Custom XSS sanitizer (req.body, req.params, req.query)
- hpp (HTTP Parameter Pollution)
- Global rate limiter: 200 req/15min
- Auth rate limiter: 20 req/15min
- Per-endpoint: uploadLimiter (30/hr), bidLimiter (10/min), searchLimiter (60/min)
- express-validator on all auth routes
- Joi validation on property, booking, auction, review

---

### AES-256-GCM Encryption (`encryption.utils.js`)

Used for IBAN storage in User.bankAccounts. Uses `crypto.scryptSync(ENCRYPTION_KEY, 'payment-system', 32)` to derive a 32-byte key. Each encryption uses a random 16-byte IV + GCM authentication tag, providing authenticated encryption (detects tampering). Module is frozen with `Object.freeze()`. Webhook signatures verified using `crypto.timingSafeEqual()`.

**Functions exported:**
- `encryptField(value)` → `{encrypted, iv, authTag}`
- `decryptField({encrypted, iv, authTag})` → plaintext
- `extractLast4(value)` — display last 4 digits without decrypting
- `validateIBAN(iban)` — basic format regex check
- `hashField(value)` — SHA-256 one-way hash (fraud detection)
- `generateToken(length)` — crypto.randomBytes hex
- `verifyWebhookSignature(payload, sig, secret)` — HMAC-SHA256 + timingSafeEqual

---

## 5. Payment System

### Architecture: Controller → PaymentService → ProviderFactory → Provider

**PaymentService class (singleton):**
- `initiatePayment(bookingId, method, userId, ip, ua)` — validates booking, calculates server-side amount (property price + 2.5% platform fee), double-payment check, creates Payment record (status:pending, expiresAt:+30min), delegates to provider
- `verifyPayment(paymentId, webhookData?)` — uses MongoDB session transaction; idempotency guard (isVerified flag prevents double-credit); updates Payment + Booking atomically
- `getPaymentStatus(paymentId, userId?)`
- `listPayments(userId, page, limit)`
- `refundPayment(paymentId, reason, adminId)`

**ProviderFactory (singleton):**
Lazy-initializes providers on first use. Supported: `paymob`, `paypal`, `bank_transfer`, `cash`.

All providers extend `baseProvider` and implement: `createPayment(opts)`, `verifyPayment(key)`, `handleWebhook(data, payment)`.

**Idempotency:**
Payment model has `isVerified: Boolean`. verifyPayment() checks this first — if already true, returns early without re-crediting. Prevents webhook replay attacks.

**Double-payment prevention:**
Unique partial index on `{booking, status}` where status IN [pending, completed] — MongoDB rejects duplicate payment creation at the database level.

---

## 6. Real-Time System (Socket.IO)

### Initialization

Socket.IO server created on the same HTTP server instance. Attached to every request as `req.io`. CORS origin mirrors the HTTP CORS setting.

### Auth middleware (every connection)

- Reads JWT from `socket.handshake.auth.token`
- Verifies with `{ algorithms: ['HS256'] }`
- Checks banned status via Redis cache (10s TTL) before DB lookup
- Rejects banned/inactive accounts

### Rooms

- `user_{userId}` — personal notifications per user
- `auction_{auctionId}` — live auction bidding room

### Events (server → client)

| Event | Room | Payload |
|-------|------|---------|
| `newBid` | auction_X | auctionId, bid{}, currentBid, timestamp |
| `auctionClosed` | auction_X | winner, finalBid, closedAt |
| `auctionJoined` | socket (ack) | full auction state |
| `notification` | user_X | type, title, message, link |

### Events (client → server)

- `joinAuction(auctionId)` — joins room, receives current state
- `leaveAuction(auctionId)` — leaves room

### emitNewBid(auctionId, bidData)

Exported function called by bid controller after successful transaction commit

---

## 7. Background Jobs (node-cron)

### Auction Job — every minute

- Activates upcoming auctions where startDate ≤ now AND isApproved=true
- Finds active auctions where endDate < now
- For each expired auction: finds winning bid, updates auction status to 'closed', sets winner, emits `auctionClosed` socket event, sends winner email, creates notifications for winner and seller via notificationHelper

### Booking Job — every hour

- Auto-completes approved bookings where end_date has passed
- Allows users to write reviews only for 'completed' bookings

### Saved Search Job — every hour

- Fetches all new properties (createdAt >= 1hr ago, isApproved, available) in one query
- Fetches all active saved searches with notifyOnMatch=true
- Matrix matching: each property × each search, checks listingType, type, city, price range, area range, bedrooms, bathrooms
- Sends notifications in parallel (Promise.all)
- Batch-updates lastNotifiedAt via SavedSearch.bulkWrite()

### Payment Expiry Job

- Finds pending payments where expiresAt < now
- Marks them as 'expired'
- Prevents zombie pending payments from blocking new ones

---

## 8. Caching Layer

### Redis (primary)

`ioredis`. Connection URL from `REDIS_URL` env var. Optional — app starts without it and falls back gracefully.

Cache middleware: skips authenticated requests (requires fresh data for protected endpoints). Key format: `cache:{originalUrl}`. Intercepts `res.json()` — only caches 200 responses. TTL configurable per route (default 60s).

`clearCache(pattern)` — pattern-matches Redis keys and deletes them. Called on property create/update/delete to invalidate listing caches.

### Redis helpers (used by Socket.IO auth)

- `cacheGet(key)` — null on miss or error
- `cacheSet(key, value, ttlSeconds)`
- `cacheDel(key)`

Used to cache user banned status (10s TTL) to avoid DB lookup on every socket connection.

### Known limitation

Cache is Redis-only when enabled. No in-memory Map fallback in the cacheMiddleware (only in redis config). Multi-instance deployments require Redis to be configured — without it, caching is fully disabled (which is safe, just uncached).

---

## 9. Complete API Reference

### Auth (`/api/v1/auth`)

| Method + Path | Auth | Description |
|---------------|------|-------------|
| POST /register | — | Register user (role forced to buyer). Sends OTP email. |
| POST /verify-otp | — | Verify email OTP (SHA-256 compare, max 5 attempts) |
| POST /resend-otp | — | Regenerate and resend OTP |
| POST /login | — | Login — returns access token (JSON) + sets refresh token cookie |
| POST /refresh-token | cookie | Token rotation — revokes old refresh token, issues new pair |
| POST /logout | protect | Revokes current refresh token, clears cookie |
| POST /logout-all | protect | Revokes ALL refresh tokens for user (all devices) |
| POST /forgot-password | — | Sends password reset email (always returns 200 to prevent enumeration) |
| PATCH /reset-password/:token | — | Reset password with token, revokes all refresh tokens |
| GET /me | protect | Get current user profile + role dashboard data |
| PATCH /update-role | protect, admin | Admin changes user role (whitelist: buyer/owner/agent only) |

---

### Properties (`/api/v1/properties`)

| Method + Path | Auth | Description |
|---------------|------|-------------|
| GET / | optional | List approved properties. APIFeatures: filter(?price[gte]=), search(?search=), sort, fields, paginate. Cached. |
| POST / | protect, owner/agent/admin | Create property (owner set to req.user). Clears cache, notifies saved searches. |
| GET /:id | optional | Single property with owner populate + last 5 reviews + isFavorited flag |
| PATCH /:id | protect, isOwner/admin | Update — ownership verified in controller |
| DELETE /:id | protect, isOwner/admin | Delete + remove Cloudinary images |
| POST /:id/images | protect, isOwner/admin, upload | Upload images → Cloudinary (magic-bytes validated), push to images[] |
| DELETE /:id/images | protect, isOwner/admin | Delete specific image from Cloudinary and images[] |
| PATCH /:id/approve | protect, admin | Admin approves property for listing |

---

### Search, Auctions, Bids

| Method + Path | Auth | Description |
|---------------|------|-------------|
| GET /search | optional | Advanced search — MongoDB $text index, 12 filter params, price stats aggregation, similar properties |
| GET /search/saved | protect | Get user's saved searches |
| POST /search/saved | protect | Save a search (max 10 per user) |
| DELETE /search/saved/:id | protect | Delete saved search |
| GET /auctions | — | List auctions with status filter + pagination |
| POST /auctions | protect, owner/agent/admin | Create auction for owned property |
| GET /auctions/my | protect | Current user's auctions |
| GET /auctions/:id | — | Auction detail with bids |
| PATCH /auctions/:id | protect | Update auction (upcoming only) |
| PATCH /auctions/:id/approve | protect, admin | Admin approves auction |
| PATCH /auctions/:id/close | protect, admin | Admin force-close auction |
| POST /bids | protect | Place bid — MongoDB session transaction, atomic 3-op write |
| GET /bids/auction/:auctionId | — | Bid history for auction (sorted by amount desc) |
| GET /bids/my | protect | Current user's bid history |

---

### Bookings, Payments, KYC

| Method + Path | Auth | Description |
|---------------|------|-------------|
| POST /bookings | protect, KYC | Create booking — validates date overlap, checks property availability |
| GET /bookings | protect | Owner sees property bookings; buyer sees own bookings |
| PATCH /bookings/:id/approve | protect, owner/admin | Owner approves booking |
| PATCH /bookings/:id/reject | protect, owner/admin | Owner rejects booking |
| PATCH /bookings/:id/cancel | protect | User cancels own booking |
| POST /payments/initiate | protect, KYC | Initiate payment — server validates amount, chooses provider, creates Payment record |
| GET /payments/:id | protect | Payment status |
| GET /payments | protect | User payment history (paginated) |
| POST /payments/webhook/paymob | — | Webhook — HMAC-SHA256 signature verified with timingSafeEqual |
| POST /kyc | protect | Submit KYC documents (document type + Cloudinary URLs) |
| GET /kyc/status | protect | Check current KYC status |
| GET /kyc/pending | protect, admin | Admin list of pending KYC submissions |
| PATCH /kyc/:userId/approve | protect, admin | Admin approves KYC |
| PATCH /kyc/:userId/reject | protect, admin | Admin rejects KYC with reason |

---

### Users, Dashboard, Reviews, Notifications, Favorites

| Method + Path | Auth | Description |
|---------------|------|-------------|
| GET /users | protect, admin | All users (paginated) — includes all fields |
| GET /users/:id | protect, admin | Single user by ID |
| GET /users/me | protect | Profile + role-specific dashboard data (owner/agent/buyer/admin) |
| PATCH /users/me | protect | Update profile (name, phone, bio, photo) |
| PATCH /users/me/password | protect | Change password — requires currentPassword, min 8 chars, invalidates tokens |
| PATCH /users/:id/ban | protect, admin | Ban/unban user |
| GET /dashboard/admin/stats | protect, admin | Total users, properties, bookings, revenue (parallel queries) |
| GET /dashboard/admin/users | protect, admin | Recent users paginated |
| GET /dashboard/admin/bookings | protect, admin | Recent bookings paginated |
| POST /reviews | protect | Create review (requires completed booking for property) |
| GET /reviews/property/:id | — | Reviews for property (paginated) |
| GET /notifications | protect | User notifications (paginated, sorted newest first) |
| PATCH /notifications/:id/read | protect | Mark notification as read |
| POST /favorites | protect | Toggle favorite (add or remove) |
| GET /favorites | protect | User's favorited properties |
| POST /inquiries | protect | Send inquiry to property owner |
| GET /inquiries | protect | Inquiries for owner's properties or sent by buyer |
| POST /viewing-requests | protect | Request a property viewing |
| GET /api/health | — | System health check |

---

## 10. Middleware Pipeline

Request flows through this chain in order:

```
requestLogger (requestId) → compression → helmet (CSP) → cors (CLIENT_URL) → 
express.json (10mb) → mongoSanitize → xssClean → hpp → globalLimiter → 
authLimiter (/auth) → cookieParser → req.io attach → Route handlers → 
404 handler → errorMiddleware
```

### Error Middleware handles

- Mongoose CastError → 400 (invalid ObjectId)
- Mongo duplicate key (code 11000) → 400
- Mongoose ValidationError → 400 with errors array
- JsonWebTokenError → 401
- TokenExpiredError → 401
- Multer LIMIT_FILE_SIZE/COUNT → 400
- AppError (isOperational) → statusCode + message
- Unknown → 500, stack only in development
- requestId attached to all error responses for tracing

### Other Middleware

**isOwner middleware:** Loads the target resource and compares resource.owner vs req.user._id. Allows admin bypass.

**requireKYC middleware:** Blocks if kycStatus !== 'approved'. Returns 403 with current kycStatus and help text.

**restrictTo(...roles):** RBAC — checks req.user.role against whitelist. Also re-checks isActive and isBanned.

**paginate middleware:** Parses page/limit query params, sets res.locals.pagination = {page, limit, skip}.

**upload middleware:** multer(memoryStorage) → extension + MIME check → magic-bytes buffer validation (JPEG FF D8 FF, PNG 89504E47, WEBP RIFF/WEBP) → Cloudinary upload_stream

---

## 11. APIFeatures Utility

Chainable query builder used on the GET /properties endpoint. Initialized with a Mongoose query and the request query string.

### Methods

- `.filter()` — copies query params, removes reserved keys (page, sort, limit, fields, search), converts `gte/gt/lte/lt` to MongoDB operators
- `.search()` — if ?search= present, applies `$or` with `$regex` across title, description, location.city, location.district
- `.sort()` — comma-separated sort fields; default: `-createdAt`
- `.limitFields()` — comma-separated field projection; default excludes `__v`
- `.paginate()` — skip/limit based on page/limit params (default: page=1, limit=10)

### Usage example

```
GET /properties?type=villa&price[gte]=500000&sort=price,-createdAt&fields=title,price&page=2&limit=12&search=cairo
```

### Note on search()

Uses `$regex` (full collection scan) rather than the available `$text` index. advancedSearch in search.controller.js correctly uses `$text`. This inconsistency means the primary listing endpoint is slower than the dedicated search endpoint.

---

## 12. Logging System

Winston with daily-rotate-file transport. Logs to `logs/` directory.

### Transports

- `error-{DATE}.log` — error level only, 30-day retention, 20MB max, gzipped
- `combined-{DATE}.log` — all levels, 14-day retention, 20MB max, gzipped
- `exceptions-{DATE}.log` — uncaught exceptions handler
- `rejections-{DATE}.log` — unhandled promise rejections
- Console transport in non-production with colorized output

### Log format (JSON)

- timestamp: YYYY-MM-DD HH:mm:ss
- level, message, stack (on error)
- requestId attached by requestLogger middleware

### Log level

Production: `warn`. Development: `debug`. Override via `LOG_LEVEL` env var.

---

## 13. Testing

### Setup

- Jest + Supertest + mongodb-memory-server
- `globalSetup.js` — starts MongoMemoryServer, exports URI
- `setup.js` — connects Mongoose, creates test helpers, clears collections after each test
- `createVerifiedUser(role?)` helper abstracts user creation + verification
- Tests run in-band (`--runInBand`) to avoid port conflicts

### Test files

| File | Lines | Coverage |
|------|-------|----------|
| auth.test.js | 167 | Register, login, OTP, duplicate email, role injection prevention |
| property.test.js | 169 | CRUD, pagination, unauthorized access |
| booking.test.js | 139 | Create, approve, cancel, overlap detection |
| health.test.js | 30 | Health endpoint smoke test |
| comprehensive.test.js | 442 | Mixed coverage across features |

### Coverage threshold

Set to 50% (branches, functions, lines) — below production standards for a financial system. Zero test coverage for: auction bidding, payment flow, KYC, webhooks, socket events.

---

## 14. Environment Variables

### Required (app crashes without)

- `CLIENT_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `MONGO_URI`

### Optional but recommended

- `REDIS_URL`
- `ENCRYPTION_KEY` (required if KYC/IBAN used)
- `PORT` (default 3000)
- `NODE_ENV`
- `LOG_LEVEL`

### Email (Nodemailer)

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`

### Cloudinary

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Payment Providers

- `PAYMOB_API_KEY`
- `PAYMOB_INTEGRATION_ID`
- `PAYMOB_IFRAME_ID`
- `PAYMOB_HMAC_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MODE` (sandbox/live)

### JWT

- `JWT_EXPIRES_IN` (default 15m)

---

## 15. Known Issues & Technical Debt

| Severity | Issue | Location |
|----------|-------|----------|
| ✅ resolved | rawOTP previously exposed in resendOTP response — now removed | auth.controller.js |
| ✅ resolved | Middleware order — sanitizers now run after body parsing | server.js |
| ✅ resolved | JWT algorithms specified: { algorithms: ['HS256'] } | jwt.js |
| ✅ resolved | tokenVersion validated in protect middleware | auth.middleware.js |
| ✅ resolved | bid placement wrapped in MongoDB session transaction | bid.controller.js |
| ✅ resolved | Magic-bytes file validation added to upload middleware | upload.middleware.js |
| ✅ resolved | CORS fails closed — throws on missing CLIENT_URL | server.js |
| ⚠️ medium | APIFeatures.search() uses $regex instead of $text index | utils/apiFeatures.js |
| ⚠️ medium | getMe runs sequential DB queries; should use Promise.all | user.controller.js |
| ⚠️ medium | Mixed error handling (asyncHandler vs raw try/catch) across controllers | auth.controller.js, property.controller.js |
| ⚠️ medium | Version mismatch: package.json says 4.0.0, server.js root endpoint returns '3.0.0' | server.js line ~root endpoint |
| ⚠️ medium | Test coverage threshold 50% — too low for financial system (target: 80%) | jest.config.js |
| ℹ️ low | No Dockerfile / docker-compose.yml | repo root |
| ℹ️ low | No GitHub Actions CI/CD pipeline | repo root |
| ℹ️ low | Offset pagination (skip/limit) — will degrade at scale; cursor pagination needed | all list endpoints |
| ℹ️ low | Dead code: server/, drizzle/, tsconfig.json, vite.config.ts (tRPC scaffold artifact) | repo root |
| ℹ️ low | Missing tests: auction bid race condition, payment webhook, KYC, socket events | tests/ |
| ℹ️ low | getAllUsers admin endpoint exposes all user fields — should project sensitive fields out | user.controller.js |

---

## 16. Deployment

### Current setup

- Platform: Railway (`railway.json` present)
- Auto-restart on failure configured
- Nixpacks auto-detection (no Dockerfile)
- Graceful shutdown on SIGTERM/SIGINT with 10s force-exit fallback
- Swagger docs auto-disabled in production (`NODE_ENV=production`)
- Winston logs to files in `logs/` directory

### Startup sequence

```
connectDB() → MongoDB Atlas
connectRedis() → Redis (optional, non-blocking)
server.listen(PORT)
initAuctionJob(io) — every minute cron
initSavedSearchJob(io) — hourly cron
initBookingJob() — hourly cron
initPaymentExpiryJob() — cron
```

Test mode: `process.env.NODE_ENV === 'test'` skips startServer() — Jest controls the lifecycle.

---

*Generated from source analysis of 95 files · Real Estate Backend API v4.0.0 · Node.js + Express 5 + MongoDB + Mongoose + Socket.IO*
