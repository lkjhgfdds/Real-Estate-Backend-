/**
 * Socket.IO Tests
 * ════════════════
 * Covers:
 *  1. Unauthenticated connection → connect_error
 *  2. Invalid token → connect_error
 *  3. Banned user → connect_error
 *  4. Valid token → connects successfully, joins user room
 *  5. joinAuction → receives auctionJoined with auction state
 *  6. joinAuction with unknown ID → receives error event
 *  7. leaveAuction → no error emitted
 *  8. emitNewBid server utility → newBid broadcast received by room members
 */

const { io: ioClient } = require('socket.io-client');
const http             = require('http');
const mongoose         = require('mongoose');
const { app }          = require('../src/server');
const { signToken }    = require('../src/utils/jwt');
const { emitNewBid }   = require('../src/config/socket');
const User             = require('../src/models/user.model');
const Auction          = require('../src/models/auction.model');
const Property         = require('../src/models/property.model');

// ── Port / server ──────────────────────────────────────────────────────────────
let httpServer;
let serverPort;

// ── Test entities ──────────────────────────────────────────────────────────────
let activeUser;
let activeToken;
let bannedToken;
let auctionId;

// ── Helpers ────────────────────────────────────────────────────────────────────
const makeClient = (token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(`http://localhost:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    const timer = setTimeout(() => {
      s.disconnect();
      reject(new Error('connect timeout'));
    }, 4000);
    s.once('connect',       () => { clearTimeout(timer); resolve(s); });
    s.once('connect_error', (e) => { clearTimeout(timer); reject(e);  });
  });

const waitFor = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${event}`)), ms);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });

// ── Global seed ────────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Active user
  activeUser = await User.create({
    name: 'Sock Active', email: 'sock.active@test.com',
    password: 'Test@1234', role: 'buyer',
    isVerified: true, isActive: true, isBanned: false,
  });
  activeToken = signToken(activeUser._id, activeUser.tokenVersion || 0);

  // Banned user
  const banned = await User.create({
    name: 'Sock Banned', email: 'sock.banned@test.com',
    password: 'Test@1234', role: 'buyer',
    isVerified: true, isActive: true, isBanned: true,
  });
  bannedToken = signToken(banned._id, banned.tokenVersion || 0);

  // Auction
  const owner = await User.create({
    name: 'Sock Owner', email: 'sock.owner@test.com',
    password: 'Test@1234', role: 'owner', isVerified: true,
  });
  const prop = await Property.create({
    title: 'Socket Test Property', description: 'Socket test property description here',
    price: 200_000, type: 'apartment', listingType: 'sale',
    location: { city: 'Cairo', district: 'Heliopolis' },
    owner: owner._id, isApproved: true,
  });
  const auction = await Auction.create({
    property:      prop._id,
    seller:        owner._id,
    startingPrice: 200_000,
    currentBid:    200_000,
    bidIncrement:  5_000,
    startDate:     new Date(Date.now() - 60_000),
    endDate:       new Date(Date.now() + 3_600_000),
    status:        'active',
    isApproved:    true,
  });
  auctionId = auction._id.toString();

  // Spin up server on random port
  httpServer = http.createServer(app);
  require('../src/config/socket')(httpServer);
  await new Promise((r) => httpServer.listen(0, r));
  serverPort = httpServer.address().port;
});

afterAll(async () => {
  if (httpServer) {
    await new Promise((r) => httpServer.close(r));
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Group 1 — Authentication
// ══════════════════════════════════════════════════════════════════════════════
describe('Socket.IO — Auth Middleware', () => {
  it('rejects connection with no token', async () => {
    await expect(makeClient(undefined)).rejects.toThrow(/authentication error/i);
  });

  it('rejects connection with a malformed JWT', async () => {
    await expect(makeClient('bad.token.here')).rejects.toThrow(/authentication error/i);
  });

  it('rejects banned user', async () => {
    await expect(makeClient(bannedToken)).rejects.toThrow(/banned/i);
  });

  it('accepts a valid token and connects', async () => {
    const s = await makeClient(activeToken);
    expect(s.connected).toBe(true);
    s.disconnect();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Group 2 — joinAuction / auctionJoined
// ══════════════════════════════════════════════════════════════════════════════
describe('Socket.IO — joinAuction', () => {
  let socket;
  beforeEach(async () => { socket = await makeClient(activeToken); });
  afterEach(() => { if (socket?.connected) socket.disconnect(); });

  it('receives auctionJoined with full auction state on valid join', async () => {
    socket.emit('joinAuction', auctionId);
    const data = await waitFor(socket, 'auctionJoined');

    expect(data.auctionId).toBe(auctionId);
    expect(typeof data.currentBid).toBe('number');
    expect(typeof data.startingPrice).toBe('number');
    expect(data.status).toBe('active');
  });

  it('receives error event for unknown auction ID', async () => {
    socket.emit('joinAuction', new mongoose.Types.ObjectId().toString());
    const data = await waitFor(socket, 'error');
    expect(data.message).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Group 3 — leaveAuction
// ══════════════════════════════════════════════════════════════════════════════
describe('Socket.IO — leaveAuction', () => {
  it('leaves silently with no error event', async () => {
    const s = await makeClient(activeToken);
    s.emit('joinAuction', auctionId);
    await waitFor(s, 'auctionJoined');

    let gotError = false;
    s.once('error', () => { gotError = true; });
    s.emit('leaveAuction', auctionId);
    await new Promise((r) => setTimeout(r, 300));

    expect(gotError).toBe(false);
    s.disconnect();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Group 4 — newBid broadcast (emitNewBid server utility)
// ══════════════════════════════════════════════════════════════════════════════
describe('Socket.IO — newBid Broadcast', () => {
  it('broadcasts newBid to all clients in the auction room', async () => {
    const c1 = await makeClient(activeToken);
    const c2 = await makeClient(activeToken);

    c1.emit('joinAuction', auctionId);
    c2.emit('joinAuction', auctionId);
    await Promise.all([waitFor(c1, 'auctionJoined'), waitFor(c2, 'auctionJoined')]);

    const bidPayload = {
      _id:       new mongoose.Types.ObjectId(),
      amount:    215_000,
      bidder:    { _id: activeUser._id, name: 'Sock Active' },
      isWinning: true,
      createdAt: new Date(),
    };

    const [ev1, ev2] = await Promise.all([
      waitFor(c1, 'newBid', 2000),
      waitFor(c2, 'newBid', 2000),
      new Promise((r) => setTimeout(() => { emitNewBid(auctionId, bidPayload); r(); }, 50)),
    ]);

    expect(ev1.auctionId).toBe(auctionId);
    expect(ev1.currentBid).toBe(215_000);
    expect(ev2.currentBid).toBe(215_000);

    c1.disconnect();
    c2.disconnect();
  });
});
