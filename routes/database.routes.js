const express = require('express');
const router = express.Router();
const authenticateToken = require('../utils/auth.middleware');
const { requireSalesOpen } = require('../utils/platformSettings');
const Databases = require('../controllers/database.controllers');

// Managed Databases (controllers/database.controllers.js). Team members need Servers access (utils/team.js).
router.use(authenticateToken);

router.get('/catalog', Databases.getCatalog);
router.get('/', Databases.listDatabases);
router.post('/', requireSalesOpen, Databases.createDatabase);
router.get('/:id/password', Databases.getPassword);
router.delete('/:id', Databases.cancelDatabase);
router.post('/:id/keep', Databases.keepDatabase);

module.exports = router;
