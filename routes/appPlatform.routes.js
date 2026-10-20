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
// App Platform is hidden for now (utils/appPlans.js): new apps are refused;
// existing ones can still be listed, cancelled and kept.
const { APP_PLATFORM_ON } = require('../utils/appPlans');
const appsClosed = (req, res, next) => (APP_PLATFORM_ON ? next()
    : res.status(503).json({ error: "App Platform isn't available right now.", comingSoon: true }));
router.post('/', appsClosed, requireSalesOpen, requireKyc('apps'), Apps.createApp);
router.delete('/:id', Apps.cancelApp);
router.post('/:id/keep', Apps.keepApp);

module.exports = router;
