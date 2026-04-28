# Real Estate Pro Backend — Technical Architecture & Review Report

**Version:** v4.0.0 | **Date:** April 2026 | **Prepared by:** Senior Full-Stack Review

---

## Quick Tech Stack Overview

| **Stack** | **Database** | **Runtime** | **Version** |
|-----------|-------------|------------|------------|
| Node.js + Express v5 | MongoDB + Redis | Node 20 (LTS) | API v4.0.0 |

| **Auth** | **Real-Time** | **Storage** | **Payments** |
|---------|--------------|-----------|------------|
| JWT + Refresh Token | Socket.IO + Redis | Cloudinary + Local | PayPal + Paymob + 2 more |

---

## 1. Executive Summary

Real Estate Pro is a **production-ready, full-featured backend API (v4.0.0)** built for a real estate management platform. The system is written in Node.js using Express.js v5 with MongoDB (via Mongoose) as the primary database, Redis for caching, and Socket.IO for real-time features. This is **NOT a NestJS project** — it is a vanilla Express MVC-layer architecture.

The codebase demonstrates a high level of engineering maturity: it implements JWT access/refresh token rotation, OTP email verification, brute-force lockout, KYC identity verification, MongoDB transactions for auction bids, a multi-provider payment gateway (PayPal, Paymob, bank transfer, cash), server-side amount calculation, webhook idempotency guards, AES-256-GCM IBAN encryption, real-time Socket.IO with JWT authentication, 4 cron jobs, MongoDB text indexes for search, and a complete CI/CD pipeline with Docker.

However, the review identified several critical issues including real credentials committed to version control in .env, bugs in the dashboard controller, in-memory rate limiting that will not work in multi-instance deployments, and the refresh token being exposed in the JSON response body.

### Overall Quality Score

| **Category** | **Score** | **Status** | **Priority** |
|-------------|----------|-----------|------------|
| Architecture & Module Design | 8.5 / 10 | **GOOD** | — |
| Security | 7.5 / 10 | **GOOD** | Review Issues |
| Authentication / Auth Flow | 9.0 / 10 | **EXCELLENT** | — |
| Database Layer | 8.5 / 10 | **GOOD** | — |
| Payment System | 9.0 / 10 | **EXCELLENT** | — |
| Real-Time (Socket.IO) | 8.0 / 10 | **GOOD** | — |
| Background Jobs | 8.5 / 10 | **GOOD** | — |
| Error Handling & Logging | 9.0 / 10 | **EXCELLENT** | — |
| Testing & CI/CD | 7.5 / 10 | **GOOD** | — |
| Secrets Management | 3.0 / 10 | **CRITICAL** | **URGENT** |
| **OVERALL** | **7.9 / 10** | **PRODUCTION-READY*** | With fixes |

---

## 2. Project Overview

### 2.1 Identity & Purpose

| **Property** | **Value** |
|-------------|---------|
| **Project Name** | real-estate-backend-pro |
| **Version** | 4.0.0 |
| **Purpose** | Full-stack Real Estate Management System — listings, bookings, auctions, payments, KYC, reviews, analytics |
| **Language** | JavaScript (CommonJS modules) — no TypeScript |
| **Framework** | Express.js v5.2.1 (latest major) |
| **Database** | MongoDB 7.x via Mongoose 9.3.3 |
| **Cache Layer** | Redis (optional — falls back to in-memory if REDIS_URL not set) |
| **Real-Time** | Socket.IO v4.8.3 |
| **File Storage** | Cloudinary (images), local disk (uploads folder) |
| **Email** | Nodemailer via Gmail SMTP / Mailtrap |
| **Deployment** | Docker (multi-stage), Railway, CI via GitHub Actions |
| **Entry Point** | src/server.js |
| **License** | ISC |

### 2.2 Target Roles & User Types

- **buyer** — Can browse, favorite, book, review, bid, pay, manage saved searches
- **owner** — Can list properties, approve bookings, receive payments, view analytics
- **agent** — Same as owner; can manage listings on behalf of others
- **admin** — Full administrative access: KYC review, property approval, ban users, dashboard analytics, report management

### 2.3 Technology Stack Matrix

| **Concern** | **Library / Tool** | **Notes** |
|------------|-------------------|----------|
| Web Framework | Express 5.2.1 | Latest major — uses native async error handling |
| ODM | Mongoose 9.3.3 | Schema-first MongoDB ODM |
| Authentication | jsonwebtoken 9.0.3 | HS256 algorithm explicitly enforced |
| Password Hashing | bcryptjs 3.0.3 | 12 salt rounds |
| Validation | express-validator 7.3.1 + joi 18.1.1 | Both used in different routes |
| Rate Limiting | express-rate-limit 8.3.1 | In-memory — no Redis store yet |
| Security Headers | helmet 8.1.0 | Full CSP configured |
| NoSQL Injection | express-mongo-sanitize 2.2.0 | Custom fallback if not available |
| XSS Protection | Custom inline sanitizer | xss-clean incompatible with Express v5; custom HTMLescaper written |
| Parameter Pollution | hpp 0.2.3 | Whitelist: price, bedrooms, bathrooms, area |
| Compression | compression 1.8.1 | GZIP applied globally |
| Real-Time | Socket.IO 4.8.3 | JWT auth middleware on socket connection |
| Cron Jobs | node-cron 4.2.1 | 4 scheduled jobs |
| File Upload | multer 2.1.1 + Cloudinary SDK 2.9.0 | Images uploaded to Cloudinary |
| Encryption | Node.js crypto (built-in) | AES-256-GCM for IBAN, SHA-256 for tokens |
| Logging | winston 3.19.0 + daily-rotate-file | 4 log streams: combined, error, exceptions, rejections |
| API Docs | swagger-jsdoc + swagger-ui-express | Disabled in production |
| Testing | Jest 30 + Supertest + mongodb-memory-server | In-memory MongoDB for tests |
| Date Handling | dayjs 1.11.20 | — |

---

## 3. Architecture & Project Structure

### 3.1 Architectural Pattern

The project follows a classic Express **MVC (Model-View-Controller) layered architecture** — appropriate for a JavaScript monolith without NestJS DI overhead. The pattern is:

```
Routes → Middlewares → Controllers → Services → Models (Mongoose)
```

### 3.2 Directory Structure

| **Path** | **Purpose** |
|---------|------------|
| `src/server.js` | Application entry point — bootstraps Express, loads middleware, registers routes, starts server |
| `src/config/` | db.js (MongoDB), redis.js (Redis client + cache helpers), socket.js (Socket.IO init + events), cloudinary.js |
| `src/models/` | 14 Mongoose schema definitions |
| `src/controllers/` | 12 controller folders + 3 root-level controllers; pure business logic, no ORM calls directly (good pattern) |
| `src/services/` | PaymentService.js (orchestrates payment flow), booking.service.js, email.service.js, analytics.service.js, savedSearch.service.js + providers/ |
| `src/services/providers/` | Payment provider pattern: factory.js, baseProvider.js, paymob.provider.js, paypal.provider.js, bankTransfer.provider.js, cash.provider.js |
| `src/routes/` | 18 route files — one per domain |
| `src/middlewares/` | auth, error, validation, rateLimit, cache, isOwner, kyc, paginate, requestLogger, restrictTo, trackView, upload |
| `src/validators/` | 8 validator files using express-validator; one per domain |
| `src/utils/` | AppError, asyncHandler, jwt, logger, encryption.utils, apiFeatures, cursorPaginate, constants, notificationHelper, mongoSanitize, sendEmail, socket |
| `src/jobs/` | auction.job.js, booking.job.js, payment-expiry.job.js, savedSearch.job.js |
| `src/docs/swagger.js` | Swagger/OpenAPI documentation setup |
| `tests/` | 11 test files: auth, booking, property, payment, bid-race, kyc, health, socket, webhook, paypal-webhook, comprehensive |
| `shared/` | shared/types.ts, shared/const.ts, shared/_core/errors.ts — TypeScript definitions for frontend/backend sharing |
| `logs/` | Rotating log files (combined, error, exceptions, rejections) — 30-day retention |
| `Dockerfile` | Multi-stage build: builder (npm ci) → runner (production deps only, non-root user) |
| `.github/workflows/ci.yml` | GitHub Actions CI: lint → test:coverage → docker build |

### 3.3 Request Lifecycle

Every HTTP request flows through this pipeline:

1. **requestLogger middleware** — assigns requestId (UUID), logs method + URL + IP
2. **compression** — GZIP
3. **helmet** — sets 7+ security headers (CSP, HSTS, X-Frame-Options, etc.)
4. **cors** — validates Origin against CLIENT_URL env var
5. **express.json / urlencoded** — body parsing (10MB limit)
6. **mongoSanitize** — strips MongoDB operators from req.body/params/query
7. **xssClean (custom)** — escapes HTML entities in all string inputs
8. **hpp** — prevents HTTP Parameter Pollution
9. **Rate limiter** — globalLimiter (200 req/15min) or authLimiter (20 req/15min)
10. **cookieParser** — parses cookies (refresh tokens)
11. **Route handler** — controller method wrapped in asyncHandler
12. **errorMiddleware** — catches all errors, formats response, hides stack traces in production

---

## 4. API Routes Catalog

All routes are prefixed with `/api/v1` (except `/api/health`). The following table catalogs every domain, its route prefix, and the HTTP methods available.

| **Domain** | **Base Route** | **Key Endpoints** |
|-----------|---------------|-----------------|
| Health | /api/health | GET / — system health check (DB, Redis, uptime) |
| Authentication | /auth | POST register, verifyOTP, resendOTP, login, logout, logoutAll, refreshToken, forgotPassword, resetPassword/:token — PATCH updateUserRole (admin) |
| Users | /users | GET me, :id — PATCH updateMe, changePassword — POST addBankAccount — GET/DELETE bankAccounts |
| KYC | /kyc | POST / (submit docs) — GET status, me — ADMIN: GET pending, summary — PATCH :userId/approve, reject, reset |
| Properties | /properties | GET / :id similar — POST / — PATCH :id — DELETE :id — POST :id/images — DELETE :id/images/:imageId — ADMIN: GET pending, PATCH :id/approve |
| Search | /search | GET / (advanced search) — GET/POST/DELETE savedSearches — GET :id/analytics — GET :id/similar |
| Reviews | /reviews | GET /property/:id — POST /property/:id — PATCH :id — DELETE :id |
| Favorites | /favorites | GET / — POST /:propertyId — DELETE /:propertyId — GET check/:propertyId |
| Bookings | /bookings | POST / — GET / (mine) — PATCH :id/approve, reject, cancel — GET :id — OWNER: GET received |
| Payments | /payments | POST /initiate — GET /verify/:paymentId — GET /my-payments — POST /webhook (Paymob/PayPal) |
| Inquiries | /inquiries | POST / — GET / (mine), received — PATCH :id/read — POST :id/reply |
| Viewing Requests | /viewing-requests | POST / — GET / (mine), received — PATCH :id/approve, reject, cancel |
| Dashboard | /dashboard | ADMIN: GET admin/stats, admin/users, admin/bookings, admin/payments — PATCH admin/users/:id/role, ban — GET owner/stats — BUYER: GET buyer/stats |
| Auctions | /auctions | POST / — GET / :id — PATCH :id — DELETE :id — ADMIN: GET pending, PATCH :id/approve |
| Bids | /bids | POST / (placeBid with MongoDB transaction + retry) — GET /auction/:id — GET /my-bids |
| Notifications | /notifications | GET / — PATCH :id/read — PATCH read-all — GET unread-count — DELETE :id |
| Reports | /reports | POST / — ADMIN: GET / :id — PATCH :id/status |

---

## 5. Database Models (Mongoose Schemas)

The project defines 14 Mongoose models. All schemas follow these standards: timestamps on most, proper enum validation, field-level min/max, and multiple indexes for query performance.

### 5.1 User Model

The most complex model, embedding authentication, KYC, banking, and access control fields.

| **Field** | **Type** | **Description** |
|----------|---------|-----------------|
| name | String | Required, 3–50 chars |
| email | String | Unique, lowercase, regex-validated, auto-indexed |
| password | String | Hashed with bcrypt (12 rounds), select:false — never returned in queries |
| role | Enum | buyer │ owner │ agent │ admin — default: buyer. Always forced server-side on registration |
| isVerified / isActive / isBanned | Boolean | Email verification, account suspension, ban flags |
| tokenVersion | Number | Incremented on password change — invalidates all existing JWTs globally |
| passwordChangedAt | Date | select:false — compared to JWT iat on each request |
| otpHash / otpExpires / otpAttempts | Mixed | SHA-256 hashed OTP, 10-min TTL, max 5 attempts before lockout |
| passwordResetToken / Expiry | Mixed | SHA-256 hashed reset token, 15-min TTL |
| loginAttempts / lockUntil | Number / Date | Brute-force protection: 5 failed attempts → 15 min lockout |
| kycStatus | Enum | not_submitted │ pending │ approved │ rejected — indexed |
| kycDocuments | Array | Embedded docs: type (national_id/passport/drivers_license), frontImage (Cloudinary URL), backImage, uploadedAt |
| bankAccounts | Array | Embedded: ibanEncrypted (AES-256-GCM), ibanLast4, accountHolderName, bankName, isDefault, encryptionTag — select:false |

**Instance methods:** comparePassword, createOTP, verifyOTP, isLocked, incLoginAttempts

**Pre-save hook:** auto-hashes password on change, increments tokenVersion

### 5.2 Property Model

| **Field** | **Type** | **Notes** |
|----------|---------|----------|
| title / description | String | Required, min/max length validation |
| price | Number | Required, min: 0 |
| type | Enum | apartment │ villa │ house │ studio │ office │ shop │ land │ commercial |
| listingType | Enum | sale │ rent |
| status | Enum | available │ reserved │ sold |
| location | Object | Embedded: {city (required), district (required), street} |
| area / bedrooms / bathrooms | Number | Numeric with min:0 |
| images | [String] | Array of Cloudinary URLs |
| owner | ObjectId → User | Required FK, indexed |
| avgRating / reviewCount | Number | Updated via Review.calcAverageRatings() post-hook |
| isApproved | Boolean | Admin must approve before property is visible |

**Indexes:** price, type, listingType, location.city, owner, status, isApproved+status (compound)

**FULL TEXT INDEX:** on title+description+city+district with weights (title:10, city:5, district:5, description:1)

### 5.3 Other Models — Quick Reference

| **Model** | **Key Fields & Design Decisions** |
|----------|----------------------------------|
| Booking | user_id, property_id, amount, start_date, end_date, status (enum: pending│approved│rejected│cancelled│completed), paymentStatus (enum: not_initiated│pending│paid│refunded), paymentId. Compound index on (property_id, start_date, end_date). |
| Payment | user, property, booking, propertyPrice, platformFee (2.5%), netAmount, totalAmount, currency (EGP/USD/EUR), paymentMethod (cash│bank_transfer│paypal│paymob), status (pending│completed│failed│refunded│expired), isVerified (idempotency guard), expiresAt (TTL: 30 min), ipAddress, userAgent, webhookSignature. Partial unique index: {booking, status} where status IN [pending, completed] prevents double-payments. |
| Auction | property, seller, startingPrice, currentBid, bidIncrement, startDate, endDate, status (upcoming│active│closed│cancelled), winner, isApproved. Virtuals: isLive, remainingSeconds. Pre-save: sets currentBid = startingPrice on creation. |
| Bid | auction, bidder, amount, isWinning. Index: (auction, amount DESC), (auction, isWinning), (bidder), (auction, createdAt DESC). Written inside MongoDB transactions. |
| RefreshToken | userId, tokenHash (SHA-256), expiresAt (30d), isRevoked, replacedByToken (rotation chain), userAgent, ip. TTL index on expiresAt. Static: hashToken(), generateToken(). Instance: revoke(), isActive(). Auto-deleted by MongoDB after expiry. |
| Review | propertyId, userId, rating (1–5), comment (500 chars max). Unique compound index (propertyId+userId) — one review per user per property. Static: calcAverageRatings() called via post-save and post-deleteOne hooks. |
| Notification | userId, type (booking│payment│inquiry│viewing│auction│review│system), title, message, isRead, link, meta. Index: (userId, createdAt DESC), (userId, isRead). |
| Inquiry | sender, receiver, property, content (1000 chars), isRead, replies[] (embedded subdocuments with from, message, createdAt). Enables threaded messaging. |
| ViewingRequest | property, requester, owner, preferredDate, preferredTime, message, status (pending│approved│rejected│cancelled). |
| Favorite | user_id, property_id. Unique compound index prevents duplicate favorites. |
| SavedSearch | userId, name, filters (type/listingType/city/district/minPrice/maxPrice/minArea/maxArea/bedrooms/bathrooms), notifyOnMatch, lastNotifiedAt. |
| Report | reporter, targetType (property│user│review│inquiry), targetId, reason (spam│fraud│inappropriate│wrong_info│duplicate│other), description, status (pending│reviewed│resolved│dismissed), adminNote, reviewedBy, reviewedAt. |
| PropertyView | property, viewer (nullable for guests), ip, userAgent, source (web│mobile│api). TTL: auto-deleted after 90 days. Used for analytics. |

---

## 6. Authentication & Authorization System

### 6.1 Authentication Flow

The authentication system is one of the strongest parts of this codebase. It implements industry-standard patterns correctly:

#### Registration Flow

- User submits name, email, password (phone optional). Role is **ALWAYS forced to buyer** server-side.
- OTP (6-digit) generated with `crypto.randomInt` (cryptographically secure). SHA-256 hashed before storage. 10-minute TTL. Max 5 failed attempts.
- Verification email sent (non-blocking — user is created even if email fails).
- User cannot log in until OTP is verified (isVerified gate in login handler).

#### Login Flow

- Brute-force protection: 5 failed attempts → 15-minute account lockout (stored in DB).
- Both email and banned/suspended checks return the same generic message to prevent user enumeration.
- Access token: JWT HS256, 15-minute TTL. Contains `{id, tokenVersion}`.
- Refresh token: separate JWT HS256, 30-day TTL. Stored as SHA-256 hash in RefreshToken collection.
- Refresh token sent in httpOnly, Secure, SameSite=strict cookie + also in JSON body (for mobile/API clients in test).

#### Token Rotation

- On `/auth/refreshToken`: old token is revoked (`isRevoked:true`), new pair generated.
- On password change: `tokenVersion` incremented on User — all old access tokens are immediately invalid on next request.
- On logout: specific refresh token marked revoked. On logoutAll: all refresh tokens for user revoked.
- On password reset: all refresh tokens revoked, new session issued.

### 6.2 JWT Verification Guards

The protect middleware (auth.middleware.js) validates:

| **Check** | **Details** |
|----------|-----------|
| Token presence | Must be Bearer token in Authorization header |
| JWT signature | Verified with JWT_SECRET, HS256 algorithm explicitly enforced |
| User existence | User must exist in DB (not just a valid JWT) |
| Account status | isActive + isBanned + isVerified checks |
| Password change | passwordChangedAt compared to token iat — new password invalidates old tokens |
| Token version | decoded.tokenVersion must match user.tokenVersion — global session invalidation |

### 6.3 Role-Based Access Control

Authorization uses the `restrictTo` middleware: `restrictTo("admin")` or `restrictTo("admin","owner")`. Applied per-route after protect. Four roles: buyer, owner, agent, admin.

Additional ownership check: `isOwner` middleware compares `req.user._id` with `resource.owner` — prevents owners from modifying each other's listings.

KYC middleware (kyc.middleware.js): requires `kycStatus === "approved"` before allowing payment initiation.

---

## 7. Payment System Architecture

### 7.1 Design Pattern

The payment system uses a clean **3-layer architecture**: Controller → PaymentService → ProviderFactory → Provider. This Strategy + Factory pattern makes it trivial to add new payment providers.

### 7.2 Payment Flow

| **Phase** | **Action** | **Security Check** |
|----------|-----------|-------------------|
| 1 | POST /payments/initiate | KYC middleware check (kycStatus=approved). Booking must be in approved status. |
| 2 | Server calculates amount | Amount NEVER from frontend. Fetched from property.price in DB. Platform fee = 2.5% (server-computed). |
| 3 | Double-payment guard | Checks existing Payment where status NOT IN [failed, expired]. Rejects if found. |
| 4 | Payment record created | status:pending, expiresAt: now+30min, ipAddress, userAgent stored. |
| 5 | Provider integration | ProviderFactory.getProvider(method). If provider fails → payment marked failed immediately. |
| 6 | Webhook received | Signature verified (HMAC-SHA256). isVerified guard prevents processing twice. |
| 7 | MongoDB transaction | Payment, Booking, and notifications updated atomically inside startSession/startTransaction. |

### 7.3 Payment Providers

- **Paymob:** Egyptian payment gateway — creates payment order, returns iframeKey/paymentKey
- **PayPal:** Creates PayPal order, handles capture on webhook
- **Bank Transfer:** Manual — generates reference number, marks as pending until admin confirms
- **Cash:** Marks as completed immediately (used for in-person transactions)

### 7.4 Security Features

- **Idempotency Guard:** `isVerified` flag on Payment document prevents webhook double-processing
- **Partial Unique Index:** MongoDB partial filter prevents two non-failed payments per booking
- **HMAC-SHA256 Webhook Signature:** `timingSafeEqual` comparison prevents timing attacks
- **Payment Expiry:** Cron job every 10 minutes marks stale pending payments as expired
- **AES-256-GCM Encryption:** IBAN numbers stored encrypted with random IV + auth tag

---

## 8. Real-Time System (Socket.IO)

### 8.1 Architecture

Socket.IO is initialized in `src/config/socket.js` and attached to the HTTP server. The io instance is injected into every request via `app.use((req,res,next) => { req.io = io; next(); })` — enabling controllers to emit events directly.

### 8.2 Authentication

Every WebSocket connection is authenticated on the handshake:

- Client sends JWT in `socket.handshake.auth.token`
- Server verifies JWT with HS256 using JWT_SECRET
- User ban status is checked via Redis cache (TTL: 10 seconds) before DB lookup — reduces latency
- Connection rejected if token invalid or user banned

### 8.3 Rooms & Events

| **Room** | **Event** | **Triggered When** |
|---------|----------|-------------------|
| user_{userId} | notification | Any notification created for this user (booking, payment, auction, etc.) |
| auction_{auctionId} | newBid | Bid placed successfully — includes bidder name, amount, timestamp |
| auction_{auctionId} | auctionClosed | Auction ends (via cron job) — includes winner, finalBid |
| auction_{auctionId} | auctionJoined | Client emits joinAuction — receives current state |

---

## 9. Background Jobs (Cron)

| **Job** | **Schedule** | **Function** |
|--------|-------------|------------|
| AuctionJob | * * * * * | Every minute: (1) Activates upcoming auctions whose startDate <= now and isApproved=true. (2) Closes active auctions whose endDate < now — finds winning bid, emits Socket.IO auctionClosed, sends winner email, creates notifications for winner and seller. |
| BookingJob | 0 * * * * | Every hour: Updates approved bookings whose end_date < now to status=completed — enables review eligibility. |
| PaymentExpiryJob | */10 * * * * | Every 10 minutes: Marks pending payments where expiresAt < now and isVerified=false as expired — cleans up stale payment sessions. |
| SavedSearchJob | 0 * * * * | Every hour: Finds properties created in last hour matching saved search filters. Sends batch notifications via Promise.all. Uses bulkWrite to update lastNotifiedAt timestamps. Limit: 10 saved searches per user. |

---

## 10. Security Analysis

### 10.1 Security Controls Implemented

| **Control** | **Status** | **Implementation** |
|------------|-----------|-------------------|
| Helmet (security headers) | **PASS** | Full CSP, HSTS, X-Frame-Options:deny, noSniff, hidePoweredBy |
| CORS (restrictive) | **PASS** | Single origin from CLIENT_URL env var. Methods whitelisted. |
| Rate Limiting | **PARTIAL** | Global: 200/15min. Auth: 20/15min. Upload: 30/hr. Bids: 10/min. IN-MEMORY — not Redis-backed. |
| Input Validation | **PASS** | express-validator on all mutation routes. Sanitize + whitelist. |
| NoSQL Injection Prevention | **PASS** | express-mongo-sanitize strips $ operators from body/params/query |
| XSS Prevention | **PASS** | Custom HTML escape function (xss-clean incompatible with Express v5) |
| Parameter Pollution | **PASS** | hpp middleware with whitelist for price, bedrooms, bathrooms, area |
| JWT Algorithm Pinning | **PASS** | algorithms: ["HS256"] explicitly set in verify calls — prevents alg:none attacks |
| Password Hashing | **PASS** | bcryptjs, 12 rounds — strong and appropriate |
| Brute-Force Protection | **PASS** | 5 failed logins → 15-min lockout stored in User document |
| Email Enumeration Prevention | **PASS** | forgotPassword always returns 200 regardless of email existence |
| Global Error Handler | **PASS** | Stack traces hidden in production. requestId in all error responses for tracing. |
| Sensitive Fields Hidden | **PASS** | password, OTP fields, KYC fields all have select:false |
| IBAN Encryption | **PASS** | AES-256-GCM with random IV + auth tag. Only last 4 digits displayed. |
| Webhook Signature Verification | **PASS** | HMAC-SHA256 + timingSafeEqual prevents spoofing and timing attacks |
| Role Enforcement | **PASS** | Role always set server-side. Never trusted from request body. |
| Secrets in Env | **FAIL** | Real .env committed to git with Gmail credentials + Atlas URI. CRITICAL. |
| Refresh Token Body Exposure | **PARTIAL** | Refresh token in httpOnly cookie (secure) BUT also in JSON body for API clients. |
| Docker Non-Root User | **PASS** | Runs as node user — not root |
| Production Swagger Disable | **PASS** | Swagger only available when NODE_ENV !== production |

### 10.2 OWASP Top 10 Mapping

| **#** | **OWASP Risk** | **Status** | **Notes** |
|-----|----------------|-----------|----------|
| A01 | Broken Access Control | **MITIGATED** | protect + restrictTo + isOwner guards |
| A02 | Cryptographic Failures | **MITIGATED** | bcrypt(12), AES-256-GCM, SHA-256, HTTPS enforced |
| A03 | Injection (NoSQL) | **MITIGATED** | mongo-sanitize + express-validator strips operators |
| A04 | Insecure Design | **PARTIAL** | Rate limiter not Redis-backed for multi-instance |
| A05 | Security Misconfiguration | **CRITICAL** | .env committed to git with real secrets |
| A06 | Vulnerable Components | **REVIEW** | Run npm audit — no automated dependency scanning in CI |
| A07 | Auth Failures | **MITIGATED** | Token rotation, tokenVersion, brute-force protection |
| A08 | Integrity Failures | **MITIGATED** | Webhook HMAC verification, payment idempotency |
| A09 | Logging Failures | **MITIGATED** | Winston structured logging, requestId tracing, 4 log streams |
| A10 | SSRF / Exception Handling | **MITIGATED** | Error middleware hides stack in production |

---

## 11. Bugs, Issues & Recommendations

### 11.1 Critical Issues

| **ID** | **Issue** | **Details & Fix** |
|--------|----------|-----------------|
| **C-01** | Real Credentials in .env Committed to Git | The .env file contains a real Gmail app password, a MongoDB Atlas URI with credentials, JWT secrets, and an ENCRYPTION_KEY. This file was committed to the git repository. Any developer who clones the repo or has repository access can extract production credentials. **FIX:** Immediately rotate all secrets (Gmail, MongoDB Atlas password, generate new JWT_SECRET/JWT_REFRESH_SECRET with `crypto.randomBytes(64).toString("hex")`). Add .env to .gitignore. Use GitHub Secrets for CI. Consider using a secrets vault (AWS Secrets Manager, HashiCorp Vault) for production. |
| **C-02** | dashboard.controller.js — changeUserRole Bug | Uses `.lean()` which returns a plain JS object (no Mongoose methods), then calls `.save()` on it — this will throw a runtime error. **FIX:** Remove `.lean()` or use `findByIdAndUpdate` instead. |
| **C-03** | adminStats Revenue Aggregation — Wrong Status Field | adminStats matches Payment documents with `status:"paid"` but the Payment schema enum is `["pending","completed","failed","refunded","expired"]` — "paid" is not a valid status. Revenue will always be $0. **FIX:** Change `$match` to `{ status: "completed" }` or check which status represents successful payment. |

### 11.2 High Severity Issues

| **ID** | **Issue** | **Details & Fix** |
|--------|----------|-----------------|
| **H-01** | Rate Limiter — In-Memory Store Only | express-rate-limit defaults to in-memory store. In a multi-instance/clustered deployment (Docker Swarm, Kubernetes, Railway with multiple instances), each instance has its own counter. An attacker can hit the auth endpoint 20 times per instance across N instances = 20*N total requests. **FIX:** Add `@express-rate-limit/redis` or `rate-limit-redis` with the existing Redis connection for shared state. |
| **H-02** | Refresh Token Exposed in JSON Body | Login and refreshToken endpoints return the refresh token in the JSON response body in addition to the httpOnly cookie. Web clients storing this in JavaScript memory are fine, but clients storing it in localStorage (common mistake) expose it to XSS. **FIX:** Only set the httpOnly cookie. Mobile clients can read from the body during login, but subsequent refresh calls should use the cookie. |
| **H-03** | recentPayments Dashboard — Wrong Field References | In dashboard.controller.js, recentPayments populates `user_id` and `booking_id` but the Payment model defines these as `user` and `booking` (no underscore). This will return null for these populated fields. **FIX:** Update populate calls to use the correct field names. |
| **H-04** | KYC Documents Exposed in Admin Listing | getPendingKYC includes kycDocuments in the select list, which contains Cloudinary image URLs of national IDs and passports. These are sensitive and should be protected. **FIX:** Either exclude document URLs from listing endpoint and only show them in a dedicated detail endpoint, or use Cloudinary signed URLs with short TTL. |

### 11.3 Medium Severity Issues

| **ID** | **Issue** | **Details & Fix** |
|--------|----------|-----------------|
| **M-01** | No .dockerignore File | The .env file (with real credentials) and logs/ folder (with potentially sensitive request logs) may be copied into the Docker image during builds. **FIX:** Add a .dockerignore file excluding .env, logs/, node_modules/, .git/, tests/, coverage/. |
| **M-02** | Cookie-Parser Order | cookieParser is registered AFTER the rate limiter. The rate limiter reads req.ip, not cookies, so no functional issue today. But if cookie-based features are added to middleware, this ordering could cause subtle bugs. **FIX:** Move cookieParser before rate limiters. |
| **M-03** | Offset Pagination in Admin Dashboard | Admin dashboard routes use skip/limit (offset pagination). At large offsets (page 500+ with 10k+ records) this becomes slow as MongoDB must scan all preceding documents. **FIX:** Use cursor-based pagination (cursorPaginate utility already exists in the codebase). |
| **M-04** | No npm audit in CI | CI pipeline does not run npm audit. Vulnerable packages would not be caught. **FIX:** Add `npm audit --audit-level=high` step to CI workflow. Consider adding Dependabot configuration. |
| **M-05** | Shared TypeScript Files Unused | The shared/ directory contains TypeScript files (types.ts, const.ts, errors.ts) but the backend is pure JavaScript with no TypeScript compilation step. These files are not imported anywhere in src/. **FIX:** Either compile them and import the JS output, or move type definitions to JSDoc comments. |
| **M-06** | Inconsistent Validation Library Usage | The project uses both express-validator (validators/ folder) and joi (some controllers import joi directly). Having two validation libraries increases bundle size and maintenance burden. **FIX:** Standardize on express-validator (already used in validators/ folder for all route-level validation). |

---

## 12. Engineering Strengths & Best Practices

### 12.1 Excellent Patterns

- **Token Architecture:** Separate `JWT_SECRET` and `JWT_REFRESH_SECRET`. Access token 15m TTL. Refresh token stored hashed (SHA-256) in DB with TTL index for auto-cleanup. Token rotation on every refresh. Global invalidation via `tokenVersion`. This is a textbook implementation.

- **MongoDB Transactions for Bidding:** placeBid uses startSession/startTransaction with optimistic locking, retry logic (5 attempts), and jitter (10-100ms random delay) to prevent livelock in concurrent bid scenarios. Industry-standard race condition handling.

- **Payment Idempotency:** The `isVerified` flag on the Payment document acts as a database-level guard against webhook replay attacks. Even if the same webhook fires multiple times, only the first processing succeeds.

- **Server-Side Amount Calculation:** Payment amounts are NEVER trusted from the client. All amounts are calculated server-side from `property.price` in the database. This prevents price tampering attacks.

- **Graceful Shutdown:** SIGTERM and SIGINT handlers close the HTTP server gracefully, then close MongoDB connection. 10-second hard timeout prevents zombie processes.

- **Logging Architecture:** Winston with 4 separate log streams (combined, error, exceptions, rejections). Daily rotation with gzip compression. 30-day error retention, 14-day combined. requestId UUID attached to every request for distributed tracing.

- **Redis-Cached Socket Authentication:** Ban status checked via Redis (10s TTL) before hitting MongoDB — reduces DB load on WebSocket connections which can be high-frequency.

- **MongoDB Text Search:** Full-text index on Property (title, description, city, district) with weighted scoring (title:10 > city:5 > description:1). Uses $text operator for O(log n) search instead of O(n) $regex scans.

- **Cursor Pagination:** cursorPaginate utility uses cursor-based pagination (MongoDB ObjectId comparison) for O(1) page jumps — correct implementation for large datasets in bid listing.

- **TTL Indexes:** RefreshToken has TTL index on expiresAt → auto-deleted by MongoDB when expired. PropertyView has 90-day TTL index → auto-purged analytics data.

- **Encryption Utils:** AES-256-GCM with authenticated encryption for IBAN storage. Auth tag detection catches tampered data. scryptSync key derivation from ENCRYPTION_KEY.

- **CI/CD Pipeline:** GitHub Actions runs lint → test:coverage → docker build on every push. Concurrency group with cancel-in-progress prevents wasted CI runs on rapid pushes.

- **Multi-stage Dockerfile:** Builder stage installs all deps. Runner stage copies only source + prod deps. Runs as non-root node user. Docker healthcheck included.

- **Saved Search Job — Batch Processing:** Job uses a single query for new properties + single query for all saved searches, then batch processes matches in memory instead of N+1 DB calls. Uses Promise.all for parallel notifications and bulkWrite for batch updates.

---

## 13. Testing & Quality Assurance

### 13.1 Test Suite Overview

| **Test File** | **Coverage** |
|---------------|------------|
| auth.test.js | Registration, OTP, login, refresh, logout, password reset, role update |
| booking.test.js | Create, approve, reject, cancel booking flows |
| property.test.js | CRUD, admin approval, image management |
| payment.test.js | Initiate, verify, webhook processing, expiry |
| bid-race.test.js | Concurrent bid stress test — verifies transaction isolation prevents race conditions |
| kyc.test.js | Document submission, admin approve/reject/reset |
| health.test.js | Health endpoint — DB status, Redis status, uptime |
| socket.test.js | JWT socket auth, joinAuction, newBid emission |
| webhook.test.js | Paymob webhook signature validation, idempotency |
| paypal-webhook.test.js | PayPal webhook event handling |
| comprehensive.test.js | End-to-end flows combining multiple domains |

**Test infrastructure:** mongodb-memory-server spins up an in-memory MongoDB instance for tests — no external DB dependency. Rate limiters are skipped in test environment. Coverage threshold: 70/80/80 (statements/branches/lines) enforced in CI.

### 13.2 CI/CD Pipeline

| **Step** | **Details** |
|---------|-----------|
| Trigger | Push to main/master/develop + all PRs + manual dispatch |
| Runner | ubuntu-latest, Node 20, timeout: 25 minutes |
| MongoDB Binaries Cache | Cached by package-lock.json hash to speed up CI runs |
| Lint | ESLint on src/**/*.js — hard failure |
| Test + Coverage | Jest --runInBand (sequential for MongoDB in-memory). Coverage thresholds enforced. |
| Coverage Upload | Coverage report uploaded as GitHub Actions artifact (even on failure) |
| Docker Build | docker build validates Dockerfile is buildable |
| Concurrency | ci-{workflow}-{ref} group with cancel-in-progress:true |

---

## 14. Infrastructure & Configuration

### 14.1 Environment Variables

| **Variable** | **Required** | **Description** |
|-------------|-----------|-----------------|
| PORT | No (3000) | HTTP server port |
| NODE_ENV | Yes | development │ production │ test |
| MONGO_URI | Yes | MongoDB connection string (Atlas or local) |
| JWT_SECRET | Yes (startup check) | Access token signing secret — min 64 chars recommended |
| JWT_REFRESH_SECRET | Yes (startup check) | Refresh token signing secret — MUST differ from JWT_SECRET |
| JWT_EXPIRES_IN | No (15m) | Access token TTL — default 15m |
| CLIENT_URL | Yes (startup check) | Frontend origin for CORS — throws if missing |
| REDIS_URL | No | Redis connection string — if absent, falls back to in-memory cache |
| EMAIL_HOST / PORT / USER / PASS | Yes (for OTP) | SMTP configuration for nodemailer |
| CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET | Yes (for uploads) | Cloudinary credentials for image upload |
| PAYMOB_WEBHOOK_SECRET | Yes (for Paymob) | HMAC signing secret for Paymob webhook verification |
| PAYPAL_WEBHOOK_ID | Yes (for PayPal) | PayPal webhook ID for signature verification |
| ENCRYPTION_KEY | Yes (for IBAN) | 64-char hex string for AES-256-GCM encryption of bank account data |

### 14.2 Database Configuration

- MongoDB connection pool: `maxPoolSize: 10`, `serverSelectionTimeoutMS: 10000`, `socketTimeoutMS: 45000`
- No synchronize:true equivalent (Mongoose does not auto-sync in production — schemas are applied on first use)
- MongoDB Atlas recommended for production (connection string format shows Atlas SRV)

### 14.3 Deployment

- **Railway:** railway.json present — configured for one-click Railway deployment
- **Docker:** Multi-stage build. Production image: node:20-alpine, runs as non-root node user, EXPOSE 3000, healthcheck every 30s
- **Logs:** Persist to ./logs/ directory. Consider mounting a volume in Docker for log persistence

---

## 15. Prioritized Recommendations

### Priority 1 — Immediate (Before Production)

- **ROTATE ALL CREDENTIALS** in .env immediately. Revoke Gmail app password, MongoDB Atlas user, generate new JWT secrets. Add .env to .gitignore. Purge from git history (git filter-branch or BFG Repo Cleaner).

- **Fix adminStats:** Change `status: "paid"` to `status: "completed"` in the revenue aggregation match stage.

- **Fix changeUserRole:** Remove `.lean()` call or use `findByIdAndUpdate()`.

- **Fix recentPayments:** Change `populate("user_id")` to `populate("user")` and `populate("booking_id")` to `populate("booking")`.

- **Add .dockerignore:** Exclude .env, logs/, .git/, tests/, coverage/ from Docker builds.

### Priority 2 — Short Term (Week 1–2)

- **Redis-backed rate limiter:** Install `rate-limit-redis` and connect to the existing Redis client. Critical for any multi-instance deployment.

- **Add npm audit to CI:** Add `npm audit --audit-level=high` step after lint in ci.yml.

- **Protect KYC documents:** Remove kycDocuments from getPendingKYC select. Use Cloudinary signed URLs for secure document access.

- **Standardize validation:** Remove joi dependency. Use express-validator exclusively. Eliminate dual-library confusion.

### Priority 3 — Medium Term (Month 1)

- **Consider migrating to TypeScript:** The shared/ directory already has TypeScript files. A full TS migration would add compile-time safety, catch the adminStats status bug statically.

- **Add Redis-backed session store:** Use connect-redis if session management is needed beyond JWT.

- **Add Swagger coverage:** Ensure all endpoints have JSDoc swagger annotations. Currently only partially documented.

- **Add Dependabot:** Configure .github/dependabot.yml for weekly npm package updates.

- **Consider cursor pagination in dashboard:** Replace skip/limit with cursor-based pagination in admin dashboard routes for scalability.

---

## 16. Project Metrics

| **Metric** | **Value** |
|-----------|----------|
| Total source files | ~65 JS files (excl. tests, logs, node_modules) |
| Mongoose models | 14 |
| API route files | 18 |
| Controller files | 15 |
| Service files | 7 (incl. 4 providers) |
| Middleware files | 11 |
| Cron jobs | 4 |
| Test files | 11 |
| Payment providers | 4 (PayPal, Paymob, Bank Transfer, Cash) |
| MongoDB collections | 14 |
| MongoDB indexes | ~40+ across all models |
| Socket.IO event types | 5 (joinAuction, leaveAuction, newBid, auctionClosed, notification) |
| Log retention | 30 days errors, 14 days combined |
| Request size limit | 10MB JSON, 10MB URL-encoded |
| Node.js version | 20 LTS (specified in Dockerfile) |
| Express version | 5.2.1 (latest major — uses native async errors) |
| Total dependencies | 25 production + 7 dev |

---

**Real Estate Pro Backend — Technical Review Report • v4.0.0 • April 2026**

**Prepared by Senior Full-Stack MEAN Developer Review**

*Confidential — Senior Full-Stack Review*
