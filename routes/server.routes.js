const express = require("express");
const router = express.Router();
const authenticateToken = require("../utils/auth.middleware");
const { requireSalesOpen } = require("../utils/platformSettings");
const {
    getCatalog,
    deployServer,
    getUserServers,
    manageServer,
    deleteServer,
    keepServer,
} = require("../controllers/server.controllers");

// All routes require authentication
router.use(authenticateToken);

// Server management routes
router.get("/catalog", getCatalog);
router.post("/deploy", requireSalesOpen, deployServer);
router.get("/", getUserServers);
router.post("/manage", manageServer);
router.delete("/:serverId", deleteServer);
router.post("/:serverId/keep", keepServer);

module.exports = router;
