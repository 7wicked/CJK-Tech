'use strict';

const env = require('../config/env');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const active = LEVELS[env.logLevel] ?? LEVELS.info;

function emit(level, msg, extra) {
  if (LEVELS[level] > active) return;
  const time = new Date().toISOString().slice(11, 19);
  const tail = extra === undefined ? '' : ` ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`;
  console.log(`${time} ${level.padEnd(5)} ${msg}${tail}`);
}

module.exports = {
  error: (m, e) => emit('error', m, e),
  warn:  (m, e) => emit('warn', m, e),
  info:  (m, e) => emit('info', m, e),
  debug: (m, e) => emit('debug', m, e),
};
