'use strict';

const { Router } = require('express');
const c = require('../controllers/campaigns.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(c.list));
router.post('/', asyncHandler(c.create));
router.get('/:id', asyncHandler(c.get));
router.patch('/:id', asyncHandler(c.update));
router.delete('/:id', asyncHandler(c.remove));
router.get('/:id/preview', asyncHandler(c.preview));
router.post('/:id/audience', asyncHandler(c.syncAudience));
router.post('/:id/run', asyncHandler(c.run));              // also the n8n Cron target
router.post('/:id/status', asyncHandler(c.setStatus));

module.exports = router;
