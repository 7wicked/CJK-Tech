'use strict';

const { Router } = require('express');
const c = require('../controllers/channels.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(c.list));
router.get('/n8n/status', asyncHandler(c.n8nStatus));
router.post('/webhooks/n8n/delivery', asyncHandler(c.deliveryWebhook)); // n8n -> us
router.patch('/:key', asyncHandler(c.update));
router.post('/:key/test', asyncHandler(c.test));

module.exports = router;
