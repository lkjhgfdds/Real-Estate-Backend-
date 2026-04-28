const i18next    = require('i18next');
const Backend    = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path       = require('path');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // ── Supported languages ────────────────────────────────
    supportedLngs: ['en', 'ar'],
    fallbackLng:   'en',
    preload:       ['en', 'ar'],

    // ── Namespace ──────────────────────────────────────────
    ns:        ['translation'],
    defaultNS: 'translation',

    // ── Backend: load JSON from disk (cached after first load) ─
    backend: {
      loadPath: path.join(__dirname, '..', 'locales', '{{lng}}', '{{ns}}.json'),
    },

    // ── Language detection (Accept-Language header only) ───
    detection: {
      order:  ['header'],          // Only Accept-Language header
      lookupHeader: 'accept-language',
      caches: false,               // Don't persist — stateless API
    },

    // ── Interpolation ──────────────────────────────────────
    interpolation: {
      escapeValue: true,           // Prevent XSS in translated content
    },

    // ── Misc ───────────────────────────────────────────────
    cleanCode: true,               // 'en-US' → 'en'
    debug:     false,
  });

module.exports = { i18next, i18nMiddleware: middleware };
