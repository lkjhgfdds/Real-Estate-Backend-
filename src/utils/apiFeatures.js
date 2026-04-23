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

  // FIX — Search was only working on title
  // Now includes: title + description + location.city + location.district
  search() {
    if (!this.queryString.search) return this;

    const s = this.queryString.search.trim();

    // Use $text index if available (faster and more accurate)
    // Otherwise use $or with $regex
    const keyword = {
      $or: [
        { title:               { $regex: s, $options: 'i' } },
        { description:         { $regex: s, $options: 'i' } },
        { 'location.city':     { $regex: s, $options: 'i' } },
        { 'location.district': { $regex: s, $options: 'i' } },
      ],
    };

    // FIX — Add search conditions to filterQuery so countDocuments returns correct count
    this.filterQuery = { ...this.filterQuery, ...keyword };
    this.query = this.query.find(keyword);
    return this;
  }

  sort() {
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
