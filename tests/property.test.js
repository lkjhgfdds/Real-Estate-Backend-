/**
 * Property & Search Tests
 * Covers: CRUD for properties, search, filtering.
 *
 * Owners need role='owner' + isVerified=true (handled by createVerifiedUser helper).
 */

const request  = require('supertest');
const { app }  = require('../src/server');

let ownerToken, buyerToken, propertyId;

beforeEach(async () => {
  const owner = await createVerifiedUser(request, app, {
    name: 'Owner User', email: 'owner@test.com', password: 'pass123', role: 'owner',
  });
  const buyer = await createVerifiedUser(request, app, {
    name: 'Buyer User', email: 'buyer@test.com', password: 'pass123', role: 'buyer',
  });

  ownerToken = owner.token;
  buyerToken = buyer.token;
});

describe('Property Routes', () => {

  // ── List Properties ───────────────────────────────────────────
  describe('GET /api/v1/properties', () => {
    it('should return a list (array) of properties', async () => {
      const res = await request(app).get('/api/v1/properties');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data.properties)).toBe(true);
    });

    it('should support pagination via page & limit query params', async () => {
      const res = await request(app).get('/api/v1/properties?page=1&limit=5');
      expect(res.status).toBe(200);
    });
  });

  // ── Create Property ───────────────────────────────────────────
  describe('POST /api/v1/properties', () => {
    it('should allow an owner to create a property (201)', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title:       'Luxury apartment for sale in New Cairo',
          description: 'Distinctive apartment with an excellent strategic location',
          price:       1_500_000,
          type:        'apartment',
          listingType: 'sale',
          location:    { city: 'Cairo', district: 'Nasr City' },
          bedrooms:    3,
          bathrooms:   2,
          area:        150,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.property).toHaveProperty('_id');
      propertyId = res.body.data.property._id;
    });

    it('should reject unauthenticated property creation with 401', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .send({ title: 'No Auth', price: 1000, type: 'apartment', listingType: 'sale' });

      expect(res.status).toBe(401);
    });

    it('should reject property creation by a buyer (403)', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          title:       'Buyer Property',
          description: 'Test',
          price:       1000,
          type:        'apartment',
          listingType: 'sale',
          location:    { city: 'Cairo', district: 'Nasr' },
        });

      expect(res.status).toBe(403);
    });
  });

  // ── Get / Update / Delete ─────────────────────────────────────
  describe('Property CRUD (owner-specific)', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title:       'CRUD Test Property',
          description: 'For testing CRUD operations',
          price:       500_000,
          type:        'villa',
          listingType: 'sale',
          location:    { city: 'Alexandria', district: 'Smouha' },
          bedrooms:    4,
          bathrooms:   3,
          area:        300,
        });
      propertyId = res.body.data.property._id;
    });

    it('should return property details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/properties/${propertyId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.property.title).toBe('CRUD Test Property');
    });

    it('should allow owner to update their property', async () => {
      const res = await request(app)
        .patch(`/api/v1/properties/${propertyId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ price: 550_000 });

      expect(res.status).toBe(200);
      expect(res.body.data.property.price).toBe(550_000);
    });

    it('should return 404 for non-existent property ID', async () => {
      const res = await request(app)
        .get('/api/v1/properties/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject update by a non-owner (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/properties/${propertyId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ price: 1 });

      expect(res.status).toBe(403);
    });
  });

  // ── Search ────────────────────────────────────────────────────
  describe('GET /api/v1/search', () => {
    it('should return properties array (even when empty)', async () => {
      const res = await request(app).get('/api/v1/search?city=Cairo');
      expect(res.status).toBe(200);
      expect(res.body.data.properties).toBeDefined();
      expect(Array.isArray(res.body.data.properties)).toBe(true);
    });

    it('should support price range filter (minPrice / maxPrice)', async () => {
      const res = await request(app)
        .get('/api/v1/search?minPrice=100000&maxPrice=2000000');

      expect(res.status).toBe(200);
    });

    it('should support type filter', async () => {
      const res = await request(app).get('/api/v1/search?type=apartment');
      expect(res.status).toBe(200);
    });
  });

});
