const express = require("express");
const router = express.Router();
const authenticateToken = require("../utils/auth.middleware");
const {
    getUserHosting,
    buyHosting,
    getCpanelLogin,
    getHostingCredentials
} = require("../controllers/hosting.controllers");

// All routes require user authentication
router.use(authenticateToken);

router.get("/", getUserHosting);
router.post("/buy", buyHosting);
router.get("/:id/login", getCpanelLogin);
router.get("/:id/credentials", getHostingCredentials);

module.exports = router;
