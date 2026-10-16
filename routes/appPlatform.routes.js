const express = require('express');
const router = express.Router();
const authenticateToken = require('../utils/auth.middleware');
const { requireSalesOpen } = require('../utils/platformSettings');
const { requireKyc } = require('../utils/kyc');
const Apps = require('../controllers/appPlatform.controllers');

// App Platform (controllers/appPlatform.controllers.js). Team members need Servers access (utils/team.js).
router.use(authenticateToken);

router.get('/catalog', Apps.getCatalog);
router.get('/', Apps.listApps);
router.post('/', requireSalesOpen, requireKyc('apps'), Apps.createApp);
router.delete('/:id', Apps.cancelApp);
router.post('/:id/keep', Apps.keepApp);

module.exports = router;
