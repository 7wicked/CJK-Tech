'use strict';

/** Forwards rejected promises to the error middleware instead of hanging. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
