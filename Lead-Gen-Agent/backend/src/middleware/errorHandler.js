'use strict';

const logger = require('../utils/logger');
const env = require('../config/env');

/** 404 for anything that fell through the router. */
function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ ok: false, error: `No route for ${req.method} ${req.path}` });
  }
  return next();
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) logger.error(`${req.method} ${req.path} failed`, err.stack || err.message);
  else logger.warn(`${req.method} ${req.path} -> ${status}`, err.message);

  res.status(status).json({
    ok: false,
    error: status >= 500 && env.nodeEnv === 'production' ? 'Something broke on our side' : err.message,
    details: err.details,
  });
}

module.exports = { errorHandler, notFoundHandler };
