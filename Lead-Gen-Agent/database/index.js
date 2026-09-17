'use strict';

/**
 * Single entry point for the data layer.
 *   const { db, leads, campaigns } = require('../../database');
 */
const db = require('./db');
const leads = require('./repositories/leadsRepository');
const campaigns = require('./repositories/campaignsRepository');
const channels = require('./repositories/channelsRepository');
const messages = require('./repositories/messagesRepository');

module.exports = { db, leads, campaigns, channels, messages };
