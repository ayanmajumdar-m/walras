// routes/wallet.routes.js
const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const authenticateToken = require("../utils/auth.middleware");
const { requireTopUpsOpen } = require("../utils/platformSettings");
const {
  getWallet,
  createOrderController,
  verifyPayment,
  handleWebhook,
  getTransactions,
  applyPromoCode,
} = require("../controllers/wallet.controllers");

// Parse JSON for normal routes
router.use(bodyParser.json());

// Protected routes
router.get("/", authenticateToken, getWallet);
router.post("/create-order", authenticateToken, requireTopUpsOpen, createOrderController);
router.post("/verify", authenticateToken, verifyPayment);
router.get("/transactions", authenticateToken, getTransactions);
router.post("/apply-promo", authenticateToken, applyPromoCode);

// Auto top-up (CCAvenue standing instructions)
const AutoTopup = require("../controllers/autoTopup.controllers");
router.get("/auto-topup", authenticateToken, AutoTopup.get);
router.put("/auto-topup", authenticateToken, AutoTopup.update);
router.post("/auto-topup/setup", authenticateToken, requireTopUpsOpen, AutoTopup.setup);
router.delete("/auto-topup", authenticateToken, AutoTopup.cancel);

// Webhook (no auth, must use raw body)
router.post("/webhooks/razorpay", bodyParser.raw({ type: "*/*" }), handleWebhook);

module.exports = router;
