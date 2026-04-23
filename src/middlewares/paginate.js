/**
 * Pagination Middleware
 * @param {MongooseModel} model
 */

const paginate = (model) => {
  return async (req, res, next) => {
    try {
      // 1️⃣ Read query params
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit) || 10, 100);

      // 2️⃣ Calculate skip
      const skip = (page - 1) * limit;

      // 3️⃣ Apply filter if provided
      const filter = res.locals.filter || {};

      // 4️⃣ Count total documents
      const total = await model.countDocuments(filter);

      // 5️⃣ Calculate pages
      const totalPages = Math.ceil(total / limit) || 1;

      // 6️⃣ Store pagination in res.locals
      res.locals.pagination = {
        page,
        limit,
        skip,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };

      next();

    } catch (error) {
      next(error);
    }
  };
};

module.exports = paginate;