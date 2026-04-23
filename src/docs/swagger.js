const swaggerJsdoc  = require('swagger-jsdoc');
const swaggerUi     = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Real Estate Backend API',
      version:     '3.0.0',
      description: 'Professional Real Estate Management System — Full Backend API Documentation',
      contact:     { name: 'API Support', email: 'support@realestate.com' },
      license:     { name: 'ISC' },
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: 'Development' },
      { url: 'https://your-domain.railway.app/api/v1', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
          description: 'Enter JWT token from /auth/login',
        },
      },
      schemas: {
        User: { type: 'object', properties: {
          _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
          name: { type: 'string', example: 'Ahmed Ali' },
          email: { type: 'string', format: 'email', example: 'ahmed@example.com' },
          role: { type: 'string', enum: ['buyer','owner','agent','admin'] },
          photo: { type: 'string' }, isActive: { type: 'boolean' },
          isBanned: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' },
        }},
        Property: { type: 'object', properties: {
          _id: { type: 'string' }, title: { type: 'string', example: 'Luxury apartment in New Cairo' },
          description: { type: 'string' }, price: { type: 'number', example: 1500000 },
          type: { type: 'string', enum: ['apartment','villa','house','studio','office','shop','land','commercial'] },
          listingType: { type: 'string', enum: ['sale','rent'] },
          status: { type: 'string', enum: ['available','reserved','sold'] },
          location: { type: 'object', properties: { city: { type: 'string' }, district: { type: 'string' }, street: { type: 'string' } } },
          area: { type: 'number' }, bedrooms: { type: 'integer' }, bathrooms: { type: 'integer' },
          images: { type: 'array', items: { type: 'string' } }, avgRating: { type: 'number' }, reviewCount: { type: 'integer' },
        }},
        Booking: { type: 'object', properties: {
          _id: { type: 'string' }, user_id: { $ref: '#/components/schemas/User' },
          property_id: { $ref: '#/components/schemas/Property' }, amount: { type: 'number' },
          start_date: { type: 'string', format: 'date' }, end_date: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['pending','approved','rejected','cancelled'] },
        }},
        Payment: { type: 'object', properties: {
          _id: { type: 'string' }, amount: { type: 'number' },
          method: { type: 'string', enum: ['cash','credit_card','debit_card','bank_transfer','paypal'] },
          status: { type: 'string', enum: ['pending','paid','refunded','failed'] },
          transactionId: { type: 'string' }, currency: { type: 'string', default: 'USD' },
        }},
        Auction: { type: 'object', properties: {
          _id: { type: 'string' }, startingPrice: { type: 'number' }, currentBid: { type: 'number' },
          bidIncrement: { type: 'number' }, startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['upcoming','active','closed','cancelled'] }, isApproved: { type: 'boolean' },
        }},
        Notification: { type: 'object', properties: {
          _id: { type: 'string' },
          type: { type: 'string', enum: ['booking','payment','inquiry','viewing','auction','review','system'] },
          title: { type: 'string' }, message: { type: 'string' }, isRead: { type: 'boolean' }, link: { type: 'string' },
        }},
        ApiError: { type: 'object', properties: {
          status: { type: 'string', example: 'fail' }, message: { type: 'string', example: 'Resource not found' },
          requestId: { type: 'string' },
        }},
        PaginatedResponse: { type: 'object', properties: {
          status: { type: 'string', example: 'success' }, total: { type: 'integer' },
          page: { type: 'integer' }, pages: { type: 'integer' }, count: { type: 'integer' }, data: { type: 'object' },
        }},
      },
      responses: {
        400: { description: 'Bad Request / Validation Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        404: { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        429: { description: 'Too Many Requests', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        500: { description: 'Internal Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: '🔐 Auth',             description: 'Authentication & Authorization' },
      { name: '👤 Users',            description: 'User profile management' },
      { name: '🏠 Properties',       description: 'Property listings CRUD' },
      { name: '🔍 Search',           description: 'Advanced search & saved searches' },
      { name: '📅 Bookings',         description: 'Property booking management and reservation system' },
      { name: '💳 Payments',         description: 'Payment processing' },
      { name: '🏆 Auctions',         description: 'Property auction creation and management' },
      { name: '💰 Bids',             description: 'Auction bidding and bid history' },
      { name: '⭐ Reviews',          description: 'Property reviews & ratings' },
      { name: '❤️ Favorites',        description: 'Saved properties' },
      { name: '💬 Inquiries',        description: 'Property inquiries & replies' },
      { name: '👁️ ViewingRequests',  description: 'Property viewing scheduling' },
      { name: '🔔 Notifications',    description: 'User notifications and alerts' },
      { name: '🚨 Reports',          description: 'Content reporting & moderation' },
      { name: '📊 Dashboard',        description: 'Analytics dashboards' },
      { name: '❤️‍🔥 Health',         description: 'Server health & status' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

// ── Custom CSS for professional dark theme matching the target design ──
const customCss = `
  /* ── Base & Font ───────────────────────────────────────────── */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  * { box-sizing: border-box; }

  body, .swagger-ui {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    background: #0f1117 !important;
    color: #e2e8f0 !important;
  }

  /* ── Top Bar ────────────────────────────────────────────────── */
  .swagger-ui .topbar {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
    border-bottom: 1px solid #334155 !important;
    padding: 12px 24px !important;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
  }
  .swagger-ui .topbar .download-url-wrapper { display: none !important; }
  .swagger-ui .topbar-wrapper .link { display: flex; align-items: center; gap: 10px; }
  .swagger-ui .topbar-wrapper .link::before {
    content: '🏠';
    font-size: 24px;
  }
  .swagger-ui .topbar-wrapper .link span {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: #f1f5f9 !important;
    letter-spacing: -0.3px;
  }
  .swagger-ui .topbar-wrapper img { display: none !important; }

  /* ── Info Section ───────────────────────────────────────────── */
  .swagger-ui .information-container {
    background: linear-gradient(135deg, #0f172a 0%, #1a2744 100%) !important;
    border-bottom: 1px solid #1e3a5f !important;
    padding: 32px 24px !important;
  }
  .swagger-ui .info .title {
    color: #f1f5f9 !important;
    font-size: 28px !important;
    font-weight: 700 !important;
    letter-spacing: -0.5px !important;
  }
  .swagger-ui .info .description p {
    color: #94a3b8 !important;
    font-size: 14px !important;
  }
  .swagger-ui .info .base-url {
    color: #60a5fa !important;
    font-size: 13px !important;
  }
  .swagger-ui .scheme-container {
    background: #0f1117 !important;
    border: none !important;
    padding: 16px 24px !important;
  }

  /* ── Main wrapper ───────────────────────────────────────────── */
  .swagger-ui .wrapper {
    background: #0f1117 !important;
    max-width: 1200px !important;
    padding: 0 24px !important;
  }

  /* ── Tag Groups ─────────────────────────────────────────────── */
  .swagger-ui .opblock-tag {
    background: #161b2e !important;
    border: 1px solid #1e3a5f !important;
    border-radius: 12px !important;
    margin-bottom: 12px !important;
    padding: 4px 8px !important;
    transition: all 0.2s ease !important;
  }
  .swagger-ui .opblock-tag:hover {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 1px #3b82f620 !important;
  }
  .swagger-ui .opblock-tag h3 {
    color: #e2e8f0 !important;
    font-size: 16px !important;
    font-weight: 600 !important;
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
  }
  .swagger-ui .opblock-tag small {
    color: #64748b !important;
    font-size: 13px !important;
    font-weight: 400 !important;
  }
  .swagger-ui .opblock-tag svg { fill: #60a5fa !important; }

  /* ── Operation Blocks ───────────────────────────────────────── */
  .swagger-ui .opblock {
    border-radius: 10px !important;
    margin: 6px 0 !important;
    border: 1px solid transparent !important;
    box-shadow: none !important;
    transition: all 0.15s ease !important;
    overflow: hidden !important;
  }
  .swagger-ui .opblock:hover { transform: translateX(2px) !important; }

  /* GET */
  .swagger-ui .opblock.opblock-get {
    background: #0c1f3d !important;
    border-color: #1d4ed8 !important;
  }
  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #1d4ed8 !important;
  }
  /* POST */
  .swagger-ui .opblock.opblock-post {
    background: #0c2d1a !important;
    border-color: #16a34a !important;
  }
  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #16a34a !important;
  }
  /* PUT */
  .swagger-ui .opblock.opblock-put {
    background: #2d1f0c !important;
    border-color: #d97706 !important;
  }
  .swagger-ui .opblock.opblock-put .opblock-summary-method {
    background: #d97706 !important;
  }
  /* PATCH */
  .swagger-ui .opblock.opblock-patch {
    background: #1a1f2d !important;
    border-color: #7c3aed !important;
  }
  .swagger-ui .opblock.opblock-patch .opblock-summary-method {
    background: #7c3aed !important;
  }
  /* DELETE */
  .swagger-ui .opblock.opblock-delete {
    background: #2d0c0c !important;
    border-color: #dc2626 !important;
  }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: #dc2626 !important;
  }

  /* Method badge */
  .swagger-ui .opblock-summary-method {
    border-radius: 6px !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    min-width: 80px !important;
    padding: 6px 14px !important;
    letter-spacing: 0.5px !important;
    color: #fff !important;
  }

  /* Path */
  .swagger-ui .opblock-summary-path {
    color: #e2e8f0 !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
  }
  .swagger-ui .opblock-summary-path span {
    color: #60a5fa !important;
  }
  .swagger-ui .opblock-summary-description {
    color: #64748b !important;
    font-size: 13px !important;
  }

  /* Lock icon (auth required) */
  .swagger-ui .authorization__btn svg { fill: #fbbf24 !important; }
  .swagger-ui .authorization__btn.unlocked svg { fill: #64748b !important; }

  /* ── Expanded block ─────────────────────────────────────────── */
  .swagger-ui .opblock-body {
    background: #0a0f1e !important;
  }
  .swagger-ui .opblock-description-wrapper p,
  .swagger-ui .opblock-external-docs-wrapper p,
  .swagger-ui .opblock-section-header h4,
  .swagger-ui .tab-header .tab-item.active h4,
  .swagger-ui label {
    color: #94a3b8 !important;
  }
  .swagger-ui .opblock-section-header {
    background: #0f172a !important;
    border-bottom: 1px solid #1e293b !important;
    padding: 12px 20px !important;
  }
  .swagger-ui .opblock-section-header h4 {
    font-size: 13px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    color: #60a5fa !important;
  }

  /* ── Tables & Parameters ─────────────────────────────────────── */
  .swagger-ui table thead tr th,
  .swagger-ui .parameters-col_name,
  .swagger-ui .col_header {
    color: #60a5fa !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    border-bottom: 1px solid #1e293b !important;
    background: transparent !important;
  }
  .swagger-ui table tbody tr td {
    border-bottom: 1px solid #1e293b20 !important;
    color: #cbd5e1 !important;
    font-size: 13px !important;
  }
  .swagger-ui .parameter__name {
    color: #e2e8f0 !important;
    font-weight: 500 !important;
    font-family: 'JetBrains Mono', monospace !important;
  }
  .swagger-ui .parameter__type {
    color: #a78bfa !important;
    font-size: 12px !important;
  }
  .swagger-ui .parameter__in {
    color: #6b7280 !important;
    font-size: 11px !important;
  }
  .swagger-ui .required { color: #f87171 !important; }

  /* ── Inputs ─────────────────────────────────────────────────── */
  .swagger-ui input[type=text],
  .swagger-ui input[type=password],
  .swagger-ui input[type=email],
  .swagger-ui select,
  .swagger-ui textarea {
    background: #0f172a !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    color: #e2e8f0 !important;
    font-size: 13px !important;
    padding: 8px 12px !important;
  }
  .swagger-ui input:focus, .swagger-ui select:focus, .swagger-ui textarea:focus {
    border-color: #3b82f6 !important;
    outline: none !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
  }

  /* ── Buttons ─────────────────────────────────────────────────── */
  .swagger-ui .btn {
    border-radius: 8px !important;
    font-weight: 600 !important;
    font-size: 13px !important;
    transition: all 0.15s ease !important;
  }
  .swagger-ui .btn.execute {
    background: #2563eb !important;
    border-color: #2563eb !important;
    color: #fff !important;
    padding: 8px 20px !important;
  }
  .swagger-ui .btn.execute:hover {
    background: #1d4ed8 !important;
    transform: translateY(-1px) !important;
  }
  .swagger-ui .btn.cancel {
    background: transparent !important;
    border-color: #475569 !important;
    color: #94a3b8 !important;
  }
  .swagger-ui .btn.authorize {
    background: linear-gradient(135deg, #1d4ed8, #7c3aed) !important;
    border: none !important;
    color: #fff !important;
    padding: 8px 20px !important;
  }
  .swagger-ui .btn.authorize svg { fill: #fff !important; }

  /* ── Response ─────────────────────────────────────────────────── */
  .swagger-ui .responses-wrapper { background: transparent !important; }
  .swagger-ui .response-col_status { color: #60a5fa !important; font-weight: 600 !important; }
  .swagger-ui .response-col_description { color: #94a3b8 !important; }
  .swagger-ui .highlight-code {
    background: #020817 !important;
    border-radius: 8px !important;
    border: 1px solid #1e293b !important;
  }
  .swagger-ui .microlight { color: #e2e8f0 !important; }

  /* ── Models ─────────────────────────────────────────────────── */
  .swagger-ui section.models {
    background: #161b2e !important;
    border: 1px solid #1e3a5f !important;
    border-radius: 12px !important;
    margin: 20px 0 !important;
  }
  .swagger-ui section.models h4 {
    color: #e2e8f0 !important;
    font-size: 16px !important;
    font-weight: 600 !important;
  }
  .swagger-ui .model-title { color: #60a5fa !important; }
  .swagger-ui .model { color: #94a3b8 !important; }
  .swagger-ui .model-box { background: #0f172a !important; }
  .swagger-ui table.model tr.property-row td { color: #cbd5e1 !important; }
  .swagger-ui .prop-type { color: #a78bfa !important; }
  .swagger-ui .prop-format { color: #34d399 !important; }

  /* ── Scrollbar ───────────────────────────────────────────────── */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: #0f1117; }
  ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #475569; }

  /* ── Misc ────────────────────────────────────────────────────── */
  .swagger-ui .servers > label select {
    background: #0f172a !important;
    color: #e2e8f0 !important;
    border-color: #334155 !important;
  }
  .swagger-ui .filter-container { background: #161b2e !important; border-bottom: 1px solid #1e293b !important; }
  .swagger-ui input.operation-filter-input {
    background: #0f172a !important;
    border-color: #334155 !important;
    color: #e2e8f0 !important;
    border-radius: 8px !important;
  }
  .swagger-ui a.nostyle, .swagger-ui a.nostyle:visited { color: #60a5fa !important; }
  .swagger-ui svg.arrow { fill: #60a5fa !important; }

  /* Tag expand chevron */
  .swagger-ui .expand-operation svg { fill: #64748b !important; }

  /* Status codes */
  .swagger-ui .response-col_status .response-undocumented { color: #475569 !important; }
`;

const setupSwagger = (app) => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss,
    customSiteTitle: '🏠 Real Estate API Docs',
    customfavIcon:   'https://fav.farm/🏠',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      syntaxHighlight: { activate: true, theme: 'monokai' },
      tryItOutEnabled: true,
      requestSnippetsEnabled: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      docExpansion: 'list',
    },
  }));

  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

module.exports = { setupSwagger, swaggerSpec };
