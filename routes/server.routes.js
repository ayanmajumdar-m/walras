const express = require("express");
const router = express.Router();
const authenticateToken = require("../utils/auth.middleware");
const {
    deployServer,
    getUserServers,
    manageServer,
    deleteServer
} = require("../controllers/server.controllers");

// All routes require authentication
router.use(authenticateToken);

// Server management routes
router.post("/deploy", deployServer);
router.get("/", getUserServers);
router.post("/manage", manageServer);
router.delete("/:serverId", deleteServer);

module.exports = router;
