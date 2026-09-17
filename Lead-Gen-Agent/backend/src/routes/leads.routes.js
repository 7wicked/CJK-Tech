'use strict';

const { Router } = require('express');
const c = require('../controllers/leads.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(c.list));
router.post('/', asyncHandler(c.create));
router.post('/import', asyncHandler(c.bulkImport));        // CSV upload + n8n bulk push
router.post('/ingest', asyncHandler(c.ingestFromN8n));     // n8n single-lead webhook
router.get('/:id', asyncHandler(c.get));
router.patch('/:id', asyncHandler(c.update));
router.delete('/:id', asyncHandler(c.remove));
router.post('/:id/messages', asyncHandler(c.sendMessage));

module.exports = router;
