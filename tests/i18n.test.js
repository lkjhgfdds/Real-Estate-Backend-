'use strict';

/**
 * i18n Localization System Test Suite
 * ─────────────────────────────────────────────────────────────
 * Tests:
 *  1. Translation files are valid JSON and non-empty
 *  2. All keys in EN exist in AR (parity check)
 *  3. i18next engine initialises and resolves keys
 *  4. Interpolation works ({{variable}} substitution)
 *  5. Fallback to English when language is unsupported
 *  6. Key coverage: spot-check critical runtime keys
 */

const path   = require('path');
const fs     = require('fs');

// ── Colours ─────────────────────────────────────────────────
const G = '\x1b[32m✓\x1b[0m';
const R = '\x1b[31m✗\x1b[0m';
const Y = '\x1b[33m⚠\x1b[0m';
const B = '\x1b[34m';
const E = '\x1b[0m';

let passed = 0;
let failed = 0;
let warned = 0;

function pass(msg)  { console.log(`  ${G} ${msg}`); passed++; }
function fail(msg)  { console.log(`  ${R} ${msg}`); failed++; }
function warn(msg)  { console.log(`  ${Y} ${msg}`); warned++; }
function header(msg){ console.log(`\n${B}▶ ${msg}${E}`); }

// ── Helper: flatten nested object to dot-notation keys ──────
function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      acc.push(...flattenKeys(v, key));
    } else {
      acc.push(key);
    }
    return acc;
  }, []);
}

// ─────────────────────────────────────────────────────────────
// 1. Load Translation Files
// ─────────────────────────────────────────────────────────────
header('TEST 1 — Translation Files Load');

const localesBase = path.join(__dirname, '..', 'src', 'locales');

let en, ar;
try {
  en = JSON.parse(fs.readFileSync(path.join(localesBase, 'en', 'translation.json'), 'utf8'));
  pass('en/translation.json loaded successfully');
} catch (e) {
  fail(`en/translation.json FAILED: ${e.message}`);
  process.exit(1);
}

try {
  ar = JSON.parse(fs.readFileSync(path.join(localesBase, 'ar', 'translation.json'), 'utf8'));
  pass('ar/translation.json loaded successfully');
} catch (e) {
  fail(`ar/translation.json FAILED: ${e.message}`);
  process.exit(1);
}

const enKeys = flattenKeys(en);
const arKeys = flattenKeys(ar);

pass(`EN has ${enKeys.length} translation keys`);
pass(`AR has ${arKeys.length} translation keys`);

// ─────────────────────────────────────────────────────────────
// 2. Key Parity Check (EN ↔ AR)
// ─────────────────────────────────────────────────────────────
header('TEST 2 — Key Parity (EN keys must all exist in AR)');

const missingInAR = enKeys.filter(k => !arKeys.includes(k));
const missingInEN = arKeys.filter(k => !enKeys.includes(k));

if (missingInAR.length === 0) {
  pass('All EN keys exist in AR');
} else {
  missingInAR.forEach(k => fail(`Missing in AR: ${k}`));
}

if (missingInEN.length === 0) {
  pass('All AR keys exist in EN');
} else {
  missingInEN.forEach(k => warn(`Extra in AR (not in EN): ${k}`));
}

// ─────────────────────────────────────────────────────────────
// 3. i18next Engine Initialisation
// ─────────────────────────────────────────────────────────────
header('TEST 3 — i18next Engine Init & Resolution');

const i18next = require('i18next');
const Backend  = require('i18next-fs-backend');

i18next
  .use(Backend)
  .init({
    supportedLngs: ['en', 'ar'],
    fallbackLng:   'en',
    preload:       ['en', 'ar'],
    ns:            ['translation'],
    defaultNS:     'translation',
    backend: {
      loadPath: path.join(localesBase, '{{lng}}', '{{ns}}.json'),
    },
    interpolation: { escapeValue: false },
    debug: false,
  }, runEngineTests);

function runEngineTests(err) {
  if (err) {
    fail(`i18next init FAILED: ${err}`);
    printSummary();
    return;
  }
  pass('i18next initialised successfully');

// ─────────────────────────────────────────────────────────────
// 4. Key Resolution Tests (EN)
// ─────────────────────────────────────────────────────────────
header('TEST 4 — Key Resolution: English');

const EN_SPOT_CHECKS = [
  ['AUTH.EMAIL_IN_USE',       'Email already in use'],
  ['AUTH.INVALID_CREDENTIALS','Email or password is incorrect'],
  ['PROPERTY.NOT_FOUND',      'Property not found'],
  ['BOOKING.DATE_CONFLICT',   'The property is booked during this time range'],
  ['PAYMENT.NOT_FOUND',       'Payment not found'],
  ['AUCTION.NOT_FOUND',       'Auction not found'],
  ['BID.PLACED',              'Bid placed successfully'],
  ['KYC.SUBMITTED',           'KYC documents submitted successfully! Awaiting admin review.'],
  ['COMMON.NOT_AUTHORIZED',   'Not authorized'],
  ['ERRORS.CAST_ERROR',       null], // interpolated — just check it resolves
];

EN_SPOT_CHECKS.forEach(([key, expected]) => {
  const result = i18next.t(key, { lng: 'en' });
  if (result === key) {
    fail(`EN key not resolved: ${key}`);
  } else if (expected && result !== expected) {
    fail(`EN "${key}" → got "${result}", expected "${expected}"`);
  } else {
    pass(`EN "${key}" → "${result}"`);
  }
});

// ─────────────────────────────────────────────────────────────
// 5. Key Resolution Tests (AR)
// ─────────────────────────────────────────────────────────────
header('TEST 5 — Key Resolution: Arabic');

const AR_SPOT_CHECKS = [
  ['AUTH.EMAIL_IN_USE',       'البريد الإلكتروني مستخدم بالفعل'],
  ['AUTH.INVALID_CREDENTIALS','البريد الإلكتروني أو كلمة المرور غير صحيحة'],
  ['PROPERTY.NOT_FOUND',      'العقار غير موجود'],
  ['BOOKING.DATE_CONFLICT',   'العقار محجوز في هذا النطاق الزمني'],
  ['PAYMENT.NOT_FOUND',       'عملية الدفع غير موجودة'],
  ['AUCTION.NOT_FOUND',       'المزاد غير موجود'],
  ['BID.PLACED',              'تم تقديم العطاء بنجاح'],
  ['COMMON.NOT_AUTHORIZED',   'غير مصرح لك'],
];

AR_SPOT_CHECKS.forEach(([key, expected]) => {
  const result = i18next.t(key, { lng: 'ar' });
  if (result === key) {
    fail(`AR key not resolved: ${key}`);
  } else if (expected && result !== expected) {
    fail(`AR "${key}" → got "${result}", expected "${expected}"`);
  } else {
    pass(`AR "${key}" → "${result}"`);
  }
});

// ─────────────────────────────────────────────────────────────
// 6. Interpolation Tests
// ─────────────────────────────────────────────────────────────
header('TEST 6 — Interpolation ({{variable}} substitution)');

const interpTests = [
  { key: 'BID.MINIMUM_BID',        lng: 'en', vars: { minimum: 5000, current: 4500, increment: 500 }, contains: '5000' },
  { key: 'BID.MINIMUM_BID',        lng: 'ar', vars: { minimum: 5000, current: 4500, increment: 500 }, contains: '5000' },
  { key: 'AUCTION.CLOSED_WITH_WINNER', lng: 'en', vars: { winner: 'Ahmed', amount: 100000 }, contains: 'Ahmed' },
  { key: 'AUCTION.CLOSED_WITH_WINNER', lng: 'ar', vars: { winner: 'Ahmed', amount: 100000 }, contains: 'Ahmed' },
  { key: 'ERRORS.CAST_ERROR',      lng: 'en', vars: { path: '_id' },   contains: '_id' },
  { key: 'ERRORS.DUPLICATE_KEY',   lng: 'ar', vars: { field: 'email' }, contains: 'email' },
  { key: 'NOTIFICATION.NEW_BID_MSG',lng:'ar', vars: { name: 'Sara', amount: 2000 }, contains: 'Sara' },
  { key: 'COMMON.PATH_NOT_FOUND',  lng: 'en', vars: { path: '/api/v1/test' }, contains: '/api/v1/test' },
];

interpTests.forEach(({ key, lng, vars, contains }) => {
  const result = i18next.t(key, { lng, ...vars });
  if (result === key) {
    fail(`[${lng.toUpperCase()}] "${key}" not resolved`);
  } else if (!result.includes(contains)) {
    fail(`[${lng.toUpperCase()}] "${key}" missing interpolated value "${contains}" → got: "${result}"`);
  } else {
    pass(`[${lng.toUpperCase()}] "${key}" → "${result}"`);
  }
});

// ─────────────────────────────────────────────────────────────
// 7. Fallback to English
// ─────────────────────────────────────────────────────────────
header('TEST 7 — Fallback to English for Unsupported Language');

const fallbackResult = i18next.t('AUTH.EMAIL_IN_USE', { lng: 'fr' });
if (fallbackResult === 'Email already in use') {
  pass(`Unsupported "fr" → fell back to EN: "${fallbackResult}"`);
} else {
  warn(`Fallback result: "${fallbackResult}" (expected EN value)`);
}

// ─────────────────────────────────────────────────────────────
// 8. No Untranslated Keys (keys that return themselves)
// ─────────────────────────────────────────────────────────────
header('TEST 8 — No Untranslated Keys in Either Locale');

let untranslatedEN = 0;
let untranslatedAR = 0;

enKeys.forEach(key => {
  // Convert dot-notation back to i18next format
  const result = i18next.t(key, { lng: 'en' });
  if (result === key) { untranslatedEN++; fail(`EN untranslated: ${key}`); }
});

arKeys.forEach(key => {
  const result = i18next.t(key, { lng: 'ar' });
  if (result === key) { untranslatedAR++; fail(`AR untranslated: ${key}`); }
});

if (untranslatedEN === 0) pass(`All ${enKeys.length} EN keys are translated`);
if (untranslatedAR === 0) pass(`All ${arKeys.length} AR keys are translated`);

// ─────────────────────────────────────────────────────────────
// 9. Critical Runtime Key Coverage
// ─────────────────────────────────────────────────────────────
header('TEST 9 — Critical Runtime Key Coverage');

const CRITICAL_KEYS = [
  // Auth pipeline
  'AUTH.EMAIL_IN_USE', 'AUTH.INVALID_CREDENTIALS', 'AUTH.VERIFY_EMAIL_FIRST',
  'AUTH.ACCOUNT_LOCKED', 'AUTH.INVALID_REFRESH_TOKEN', 'AUTH.LOGOUT_SUCCESS',
  // Property
  'PROPERTY.NOT_FOUND', 'PROPERTY.NOT_AVAILABLE', 'PROPERTY.FOR_SALE_ONLY',
  // Booking
  'BOOKING.NOT_FOUND', 'BOOKING.DATE_CONFLICT', 'BOOKING.APPROVED', 'BOOKING.REJECTED',
  // Payment
  'PAYMENT.NOT_FOUND', 'PAYMENT.ALREADY_VERIFIED', 'PAYMENT.INITIATED',
  // Auction
  'AUCTION.NOT_FOUND', 'AUCTION.CLOSED_WITH_WINNER', 'AUCTION.CLOSED_NO_BIDS',
  // Bid
  'BID.MINIMUM_BID', 'BID.OWN_AUCTION', 'BID.PLACED',
  // KYC
  'KYC.REQUIRED', 'KYC.SUBMITTED', 'KYC.APPROVED', 'KYC.REJECTED',
  // Common
  'COMMON.NOT_AUTHORIZED', 'COMMON.ACCOUNT_SUSPENDED',
  // Errors
  'ERRORS.CAST_ERROR', 'ERRORS.DUPLICATE_KEY',
  // Validation
  'VALIDATION.EMAIL_INVALID', 'VALIDATION.PASSWORD_MIN',
];

let critMissing = 0;
CRITICAL_KEYS.forEach(key => {
  const enVal = i18next.t(key, { lng: 'en' });
  const arVal = i18next.t(key, { lng: 'ar' });
  if (enVal === key || arVal === key) {
    fail(`CRITICAL key missing or unresolved: ${key}`);
    critMissing++;
  }
});

if (critMissing === 0) {
  pass(`All ${CRITICAL_KEYS.length} critical keys resolved in both locales`);
}

// ─────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────
function printSummary() {
  console.log('\n' + '─'.repeat(55));
  console.log(`\x1b[32m  PASSED : ${passed}\x1b[0m`);
  if (warned) console.log(`\x1b[33m  WARNED : ${warned}\x1b[0m`);
  if (failed) console.log(`\x1b[31m  FAILED : ${failed}\x1b[0m`);
  console.log('─'.repeat(55));

  if (failed > 0) {
    console.log('\n\x1b[31m✗ i18n Test Suite FAILED\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\n\x1b[32m✓ i18n Test Suite PASSED — Localization system is production-ready!\x1b[0m\n');
    process.exit(0);
  }
} // close runEngineTests
}
