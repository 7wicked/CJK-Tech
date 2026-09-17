'use strict';

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Missing or invalid credentials') => new HttpError(401, msg);
const notFound = (msg = 'Not found') => new HttpError(404, msg);

module.exports = { HttpError, badRequest, unauthorized, notFound };
