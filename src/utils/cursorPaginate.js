/**
 * Cursor-based Pagination Utility
 * ════════════════════════════════
 * Replaces skip/limit for high-volume list endpoints.
 *
 * HOW IT WORKS
 * ─────────────
 * Instead of SKIP (which forces MongoDB to scan and discard N documents),
 * we use the _id field as a cursor. Since ObjectIds are monotonically
 * increasing, paging forward is a simple range query:
 *
 *   First page : find({ ...filter })          .sort({ _id: -1 }).limit(N)
 *   Next page  : find({ ...filter, _id: { $lt: lastId } }).sort({ _id: -1 }).limit(N)
 *
 * This is O(1) per page (uses the _id index) regardless of dataset size.
 *
 * USAGE IN A CONTROLLER
 * ──────────────────────
 * const { cursorPaginate } = require('../utils/cursorPaginate');
 *
 * const { data, nextCursor, hasMore } = await cursorPaginate(Bid, {
 *   filter:     { auction: auctionId },
 *   select:     'amount bidder isWinning createdAt',
 *   populate:   { path: 'bidder', select: 'name email' },
 *   sort:       'desc',       // default: 'desc' (newest first)
 *   limit:      20,
 *   afterCursor: req.query.cursor,   // undefined on first page
 * });
 *
 * res.json({ status: 'success', data, nextCursor, hasMore });
 *
 * FIELDS RETURNED
 * ───────────────
 * data       — array of lean documents
 * nextCursor — base64-encoded _id of the last item (pass as ?cursor= next call)
 *              null when there are no more pages
 * hasMore    — boolean (convenience flag)
 * count      — number of items in this page
 */

'use strict';

const mongoose = require('mongoose');

/**
 * Encode a MongoDB ObjectId (or string) into a URL-safe cursor string.
 */
const encodeCursor = (id) =>
  Buffer.from(id.toString()).toString('base64url');

/**
 * Decode a cursor string back to a string ObjectId.
 * Returns null on invalid input so callers can ignore bad cursors gracefully.
 */
const decodeCursor = (cursor) => {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    // Validate it looks like a 24-hex ObjectId
    if (/^[a-f0-9]{24}$/i.test(raw)) return raw;
    return null;
  } catch {
    return null;
  }
};

/**
 * cursorPaginate
 *
 * @param {mongoose.Model} Model
 * @param {object} opts
 * @param {object}   opts.filter       - Mongoose filter (required)
 * @param {string}   [opts.select]     - Field projection string
 * @param {object|string} [opts.populate] - Mongoose populate option
 * @param {'asc'|'desc'} [opts.sort]   - Sort direction by _id (default: 'desc')
 * @param {number}   [opts.limit]      - Page size (default: 20, max: 100)
 * @param {string}   [opts.afterCursor]- Encoded cursor from previous response
 *
 * @returns {{ data, nextCursor, hasMore, count }}
 */
const cursorPaginate = async (Model, opts = {}) => {
  const {
    filter      = {},
    select      = '',
    populate    = null,
    sort        = 'desc',
    afterCursor = null,
  } = opts;

  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 20, 1), 100);
  const dir   = sort === 'asc' ? 1 : -1;
  const op    = dir === -1 ? '$lt' : '$gt'; // navigate forward in chosen direction

  // Build the paged filter
  const pagedFilter = { ...filter };
  if (afterCursor) {
    const decodedId = decodeCursor(afterCursor);
    if (decodedId) {
      pagedFilter._id = { [op]: new mongoose.Types.ObjectId(decodedId) };
    }
    // If cursor is invalid, just return first page (fail open, not hard 400)
  }

  // Execute query — fetch limit+1 to detect hasMore without an extra COUNT
  let query = Model.find(pagedFilter)
    .sort({ _id: dir })
    .limit(limit + 1)
    .lean();

  if (select)   query = query.select(select);
  if (populate) query = query.populate(populate);

  const docs    = await query;
  const hasMore = docs.length > limit;
  const data    = hasMore ? docs.slice(0, limit) : docs;

  const nextCursor = hasMore
    ? encodeCursor(data[data.length - 1]._id)
    : null;

  return { data, nextCursor, hasMore, count: data.length };
};

module.exports = { cursorPaginate, encodeCursor, decodeCursor };
