class APIFeatures {
  constructor(mongooseQuery, queryString) {
    this.query       = mongooseQuery;
    this.queryString = queryString;
    this.filterQuery = {};
  }

  // Advanced Filtering (?price[gte]=100&type=villa)
  filter() {
    const queryObj = { ...this.queryString };
    const excluded = ['page', 'sort', 'limit', 'fields', 'search'];
    excluded.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (m) => `$${m}`);

    this.filterQuery = JSON.parse(queryStr);
    this.query = this.query.find(this.filterQuery);
    return this;
  }

  // Uses the full-text index (title ×10, description ×5, city ×5, district ×1).
  // Falls back to $or/$regex only when the search term is absent/empty.
  // countDocuments uses this.filterQuery which is kept in sync.
  search() {
    if (!this.queryString.search) return this;

    const s = this.queryString.search.trim();
    if (!s) return this;

    // $text leverages MongoDB's weighted full-text index — no collection scan.
    const textQuery = { $text: { $search: s } };

    // Keep filterQuery in sync so countDocuments() returns the correct total.
    this.filterQuery    = { ...this.filterQuery, ...textQuery };
    this.query          = this.query.find(textQuery);
    this._textSearch    = true; // tell sort() to rank by relevance
    return this;
  }

  sort() {
    // When text search is active and no explicit sort requested,
    // rank results by MongoDB textScore (relevance).
    if (this._textSearch && !this.queryString.sort) {
      this.query = this.query
        .select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
      return this;
    }

    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page  = this.queryString.page  * 1 || 1;
    const limit = this.queryString.limit * 1 || 10;
    const skip  = (page - 1) * limit;
    this.query  = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
