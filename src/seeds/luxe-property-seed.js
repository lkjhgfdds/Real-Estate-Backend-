/**
 * LUXE ESTATES — Production Property Seed
 * ─────────────────────────────────────────
 * Run: node src/seeds/luxe-property-seed.js
 *
 * Requirements:
 *  - Backend MONGO_URI in .env must be set
 *  - An 'owner' user must exist in the DB (the seed resolves or creates one)
 *  - All properties are isApproved: true so they show immediately
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Property = require('../models/property.model');
const User     = require('../models/user.model');

const SEED_OWNER_EMAIL = 'owner@luxeestates.com';

const PROPERTIES = [
  {
    title:       'Sky Penthouse — Dubai Marina',
    description: 'Breathtaking penthouse apartment spanning the entire top floor of a prestigious tower in Dubai Marina. Features a private rooftop terrace with 360° panoramic views, a chef\'s kitchen with Gaggenau appliances, and bespoke Italian marble finishes throughout.',
    price:       8_500_000,
    currency:    'AED',
    type:        'apartment',
    listingType: 'sale',
    status:      'available',
    location:    { city: 'Dubai', district: 'Marina', street: 'JBR Walk' },
    area:        450,
    bedrooms:    5,
    bathrooms:   6,
    features:    ['Private Rooftop Pool', 'Gym', '24/7 Concierge', 'Smart Home', 'Covered Parking', 'Sea View'],
    images:      [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
    ],
    isApproved:  true,
    featured:    true,
  },
  {
    title:       'Mayfair Garden Apartment',
    description: 'A stunning lateral apartment in the heart of Mayfair, one of London\'s most prestigious neighbourhoods. Generously proportioned rooms with original period features, a private garden terrace, and dedicated parking.',
    price:       3_200_000,
    currency:    'GBP',
    type:        'apartment',
    listingType: 'sale',
    status:      'available',
    location:    { city: 'London', district: 'Mayfair', street: 'Park Lane' },
    area:        180,
    bedrooms:    3,
    bathrooms:   2,
    features:    ['24/7 Porter', 'Gym', 'Garden Terrace', 'Wine Cellar', 'Parking'],
    images:      [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    ],
    isApproved:  true,
    featured:    false,
  },
  {
    title:       'Manhattan Skyline Loft',
    description: 'Industrial-chic loft in Tribeca with floor-to-ceiling windows showcasing iconic Manhattan views. Features exposed brick, polished concrete floors, and a private rooftop lounge. Doorman building.',
    price:       18_000,
    currency:    'USD',
    type:        'apartment',
    listingType: 'rent',
    status:      'available',
    location:    { city: 'New York', district: 'Tribeca', street: 'Hudson St' },
    area:        220,
    bedrooms:    2,
    bathrooms:   2,
    features:    ['Doorman', 'Gym', 'Rooftop Access', 'Storage', 'City View'],
    images:      [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80',
      'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
    ],
    isApproved:  true,
    featured:    false,
  },
  {
    title:       "Côte d'Azur Beachfront Villa",
    description: 'Exceptional beachfront villa commanding breathtaking views over the Mediterranean. The property features a private beach, heated infinity pool, tennis court, cinema room, and staff quarters on a total plot of 2,500 m².',
    price:       12_800_000,
    currency:    'EUR',
    type:        'villa',
    listingType: 'sale',
    status:      'available',
    location:    { city: 'Nice', district: 'Promenade des Anglais', street: 'Bord de Mer' },
    area:        800,
    bedrooms:    7,
    bathrooms:   8,
    features:    ['Private Beach', 'Infinity Pool', 'Tennis Court', 'Cinema Room', 'Wine Cave', 'Staff Quarters'],
    images:      [
      'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    ],
    isApproved:  true,
    featured:    true,
  },
  {
    title:       'Singapore Marina Bay Residence',
    description: 'Premier waterfront residence in the iconic Marina Bay financial district, offering unobstructed views of Marina Bay Sands and the city skyline. Comes with exclusive residents-only sky garden and infinity pool.',
    price:       22_000,
    currency:    'USD',
    type:        'apartment',
    listingType: 'rent',
    status:      'available',
    location:    { city: 'Singapore', district: 'Marina Bay', street: 'Bayfront Ave' },
    area:        260,
    bedrooms:    3,
    bathrooms:   3,
    features:    ['Infinity Pool', 'Sky Garden', 'Concierge', 'Gym', 'Bay View'],
    images:      [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&q=80',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
    ],
    isApproved:  true,
    featured:    false,
  },
  {
    title:       "Paris 8ème — Haussmann Apartment",
    description: 'Magnificent Haussmann-era apartment in the prestigious 8th arrondissement, steps from the Champs-Élysées. Features original parquet floors, ornate mouldings, two marble fireplaces, and sweeping views of the Eiffel Tower from the wraparound balcony.',
    price:       4_600_000,
    currency:    'EUR',
    type:        'apartment',
    listingType: 'sale',
    status:      'available',
    location:    { city: 'Paris', district: '8ème Arrondissement', street: 'Avenue Montaigne' },
    area:        240,
    bedrooms:    4,
    bathrooms:   3,
    features:    ['Wraparound Balcony', 'Wine Cave', 'Concierge', 'Parking', 'Eiffel Tower View'],
    images:      [
      'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200&q=80',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
    ],
    isApproved:  true,
    featured:    false,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // ── Resolve or create the seed owner user ─────────────────────────────
    let owner = await User.findOne({ email: SEED_OWNER_EMAIL });
    if (!owner) {
      // Create a minimal owner user that satisfies required fields
      owner = await User.create({
        name:       'Luxe Estates',
        email:      SEED_OWNER_EMAIL,
        password:   'LuxeOwner@2025!',
        role:       'owner',
        isVerified: true,
        isActive:   true,
      });
      console.log(`✅ Owner created: ${owner._id}`);
    } else {
      console.log(`✅ Owner found: ${owner._id}`);
    }

    // ── Clear existing seeded properties ──────────────────────────────────
    const deleted = await Property.deleteMany({ isApproved: true });
    console.log(`🗑  Cleared ${deleted.deletedCount} existing properties`);

    // ── Insert with resolved owner ID ─────────────────────────────────────
    const toInsert = PROPERTIES.map(p => ({ ...p, owner: owner._id }));
    const inserted = await Property.insertMany(toInsert);
    console.log(`✅ ${inserted.length} properties seeded successfully!`);

    inserted.forEach(p => {
      console.log(`   • [${p.listingType.toUpperCase()}] ${p.title} — ${p.currency} ${p.price.toLocaleString()}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    if (err.errors) {
      Object.entries(err.errors).forEach(([field, e]) => {
        console.error(`   • ${field}: ${e.message}`);
      });
    }
    process.exit(1);
  }
}

seed();
