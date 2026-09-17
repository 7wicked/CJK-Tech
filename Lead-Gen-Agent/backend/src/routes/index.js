'use strict';

const { Router } = require('express');
const leadsRoutes = require('./leads.routes');
const campaignsRoutes = require('./campaigns.routes');
const channelsRoutes = require('./channels.routes');
const dashboardRoutes = require('./dashboard.routes');

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true, service: 'lead-gen-agent', time: new Date().toISOString() }));

router.use('/leads', leadsRoutes);
router.use('/campaigns', campaignsRoutes);
router.use('/channels', channelsRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
