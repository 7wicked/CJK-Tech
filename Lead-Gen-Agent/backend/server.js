'use strict';

const path = require('node:path');
const express = require('express');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { db } = require('../database');

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Open CORS: n8n calls in from wherever it happens to be running.
// Lock this down to your n8n host before this leaves your machine.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`));
  next();
});

app.use('/api', routes);

// The frontend is plain files — Express serves them, so there's nothing else to run.
app.use(express.static(path.join(__dirname, '../frontend')));

app.use(notFoundHandler);
app.use(errorHandler);

function start() {
  db.connect(env.dbFile);
  logger.info(`Database ready at ${env.dbFile}`);

  const server = app.listen(env.port, () => {
    logger.info(`Lead gen agent on http://localhost:${env.port}`);
    if (env.dryRun) logger.warn('DRY_RUN is on — nothing actually sends. Flip DRY_RUN=false in .env when n8n is ready.');
  });

  const shutdown = () => {
    logger.info('Shutting down');
    server.close(() => { db.close(); process.exit(0); });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

if (require.main === module) start();

module.exports = { app, start };
