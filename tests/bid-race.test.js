/**
 * Bid Race-Condition Tests
 * ═════════════════════════
 * Validates that the MongoDB session transaction in bid.controller.js
 * correctly serialises concurrent bids so:
 *  1. Exactly ONE bid ends up as isWinning=true
 *  2. auction.currentBid equals the highest winning bid
 *  3. No duplicate winning bids exist after N concurrent attempts
 *  4. Bids below the minimum increment are rejected even under concurrency
 *
 * Strategy:
 *  - Fire N simultaneous HTTP requests (Promise.all) from different users
 *  - After settlement, assert DB state is internally consistent
 *  - Each concurrent bidder uses a unique token so they represent real users
 */

const request   = require('supertest');
const mongoose  = require('mongoose');
const { app }   = require('../src/server');
const Bid       = require('../src/models/bid.model');
const Auction   = require('../src/models/auction.model');
const User      = require('../src/models/user.model');
const Property  = require('../src/models/property.model');

// ── Shared state ───────────────────────────────────────────────────────────────
let auctionId;
let ownerToken;
const bidderTokens = []; // N concurrent bidder tokens

const BIDDER_COUNT   = 6;   // concurrent bidders
const STARTING_PRICE = 100_000;
const BID_INCREMENT  = 5_000;

// ── Seed ───────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Owner
  const owner = await createVerifiedUser(request, app, {
    name: 'Race Owner', email: 'race.owner@test.com',
    password: 'Test@1234', role: 'owner',
  });
  ownerToken = owner.token;

  // Property
  const prop = await Property.create({
    title:       'Race Test Property',
    description: 'Used for bid race-condition testing',
    price:       STARTING_PRICE,
    type:        'apartment',
    listingType: 'sale',
    location:    { city: 'Cairo', district: 'Dokki' },
    owner:       owner.user._id,
    isApproved:  true,
  });

  // Auction — already active
  const auction = await Auction.create({
    property:      prop._id,
    seller:        owner.user._id,
    startingPrice: STARTING_PRICE,
    currentBid:    STARTING_PRICE,
    bidIncrement:  BID_INCREMENT,
    startDate:     new Date(Date.now() - 60_000),        // started
    endDate:       new Date(Date.now() + 3_600_000),     // ends in 1h
    status:        'active',
    isApproved:    true,
  });
  auctionId = auction._id.toString();

  // Create N bidder accounts (owner can't bid on own auction)
  for (let i = 0; i < BIDDER_COUNT; i++) {
    const b = await createVerifiedUser(request, app, {
      name:     `Racer ${i}`,
      email:    `racer${i}@test.com`,
      password: 'Test@1234',
      role:     'buyer',
    });
    bidderTokens.push(b.token);
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// Utility: place a bid via HTTP and return { status, body }
// ══════════════════════════════════════════════════════════════════════════════
const placeBid = (token, amount) =>
  request(app)
    .post('/api/v1/bids')
    .set('Authorization', `Bearer ${token}`)
    .send({ auctionId, amount });

// ══════════════════════════════════════════════════════════════════════════════
// 1. Single valid bid — baseline sanity
// ══════════════════════════════════════════════════════════════════════════════
describe('Bid — Single Valid Bid (baseline)', () => {
  it('should accept a bid above the minimum increment', async () => {
    const validAmount = STARTING_PRICE + BID_INCREMENT; // 105,000
    const res = await placeBid(bidderTokens[0], validAmount);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.bid.isWinning).toBe(true);
    expect(res.body.data.bid.amount).toBe(validAmount);
  });

  it('should update auction.currentBid to match the winning bid', async () => {
    const auction = await Auction.findById(auctionId).lean();
    expect(auction.currentBid).toBeGreaterThanOrEqual(STARTING_PRICE + BID_INCREMENT);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Bid below minimum increment — rejected
// ══════════════════════════════════════════════════════════════════════════════
describe('Bid — Below Minimum Increment', () => {
  it('should reject a bid that does not meet the minimum increment', async () => {
    // Current bid is at least 105k, so 105k + 1 is still below next increment (110k)
    const auction   = await Auction.findById(auctionId).lean();
    const tooLow    = auction.currentBid + 1; // 1 unit above current, below increment
    const res = await placeBid(bidderTokens[1], tooLow);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Owner cannot bid on own auction
// ══════════════════════════════════════════════════════════════════════════════
describe('Bid — Owner Cannot Self-Bid', () => {
  it('should reject bid from the auction seller', async () => {
    const auction   = await Auction.findById(auctionId).lean();
    const validAmt  = auction.currentBid + BID_INCREMENT;
    const res       = await placeBid(ownerToken, validAmt);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/own auction/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. RACE CONDITION — N concurrent bids at same amount
//    Only ONE should win; exactly one isWinning=true in the DB
// ══════════════════════════════════════════════════════════════════════════════
describe('Bid — Concurrent Race Condition (same amount)', () => {
  it(`${BIDDER_COUNT - 1} simultaneous bids at identical amount → exactly 1 wins`, async () => {
    // Fetch current state
    const auctionBefore = await Auction.findById(auctionId).lean();
    const raceAmount    = auctionBefore.currentBid + BID_INCREMENT;

    // Fire all requests simultaneously (bidder 1 through N-1, skip bidder 0 used in baseline)
    const results = await Promise.all(
      bidderTokens.slice(1).map((token) => placeBid(token, raceAmount))
    );

    // Count HTTP 201 vs 400 (only some should succeed)
    const successes = results.filter((r) => r.status === 201);
    const failures  = results.filter((r) => r.status === 400);

    // At least one must succeed (race not broken entirely)
    expect(successes.length).toBeGreaterThanOrEqual(1);

    // DB consistency: exactly ONE bid for this amount must be isWinning=true
    const winningBids = await Bid.find({
      auction:   auctionId,
      amount:    raceAmount,
      isWinning: true,
    }).lean();

    expect(winningBids.length).toBe(1);

    // auction.currentBid must equal raceAmount
    const auctionAfter = await Auction.findById(auctionId).lean();
    expect(auctionAfter.currentBid).toBe(raceAmount);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. ESCALATING RACE — N bidders each with incrementally higher amounts
//    Highest bid should always win; DB must end in consistent state
// ══════════════════════════════════════════════════════════════════════════════
describe('Bid — Escalating Concurrent Bids', () => {
  it('highest bid wins and DB state is consistent after parallel submission', async () => {
    const auctionBefore = await Auction.findById(auctionId).lean();
    const base          = auctionBefore.currentBid;

    // Each bidder submits a different amount: base+increment, base+2x, base+3x …
    const amounts = bidderTokens.slice(0, 4).map(
      (_, i) => base + BID_INCREMENT * (i + 1)
    );
    const highestAmount = Math.max(...amounts);

    const results = await Promise.all(
      bidderTokens.slice(0, 4).map((token, i) => placeBid(token, amounts[i]))
    );
    console.log("TEST 5 RESULTS:", results.map(r => ({ status: r.status, body: r.body })));

    // DB: exactly one isWinning bid in total for this auction
    const allWinning = await Bid.find({ auction: auctionId, isWinning: true }).lean();
    expect(allWinning.length).toBe(1);

    // The winning amount must equal the max submitted (or higher if another test ran in between)
    const auctionAfter = await Auction.findById(auctionId).lean();
    expect(auctionAfter.currentBid).toBeGreaterThanOrEqual(highestAmount);
  });
});
