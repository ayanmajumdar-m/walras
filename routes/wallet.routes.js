// routes/wallet.routes.js
const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const authenticateToken = require("../utils/auth.middleware");
const { requireTopUpsOpen } = require("../utils/platformSettings");
const {
  getWallet,
  getTransactions,
  applyPromoCode,
} = require("../controllers/wallet.controllers");

// Parse JSON for normal routes
router.use(bodyParser.json());

// Protected routes
router.get("/", authenticateToken, getWallet);
router.get("/transactions", authenticateToken, getTransactions);
router.post("/apply-promo", authenticateToken, applyPromoCode);

// Auto top-up (CCAvenue standing instructions)
const AutoTopup = require("../controllers/autoTopup.controllers");
router.get("/auto-topup", authenticateToken, AutoTopup.get);
router.put("/auto-topup", authenticateToken, AutoTopup.update);
router.post("/auto-topup/setup", authenticateToken, requireTopUpsOpen, AutoTopup.setup);
router.delete("/auto-topup", authenticateToken, AutoTopup.cancel);

module.exports = router;
