'use strict';

const { Router } = require('express');
const c = require('../controllers/dashboard.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(c.summary));

module.exports = router;
