const express = require("express");
const connection = require("./config/db");
const path = require("path");
const app = express();
const port = process.env.PORT || 3001;
const bodyParser = require("body-parser");
const cors = require("cors");

// Initialize billing service
require("./services/billingServices");
const { verifyEmailTransport } = require("./utils/sendEmail");
if (process.env.DISABLE_BILLING !== "true") console.log("💰 Billing service initialized");

// Basic hardening: no framework banner, no framing by other sites (clickjacking
// on the console and admin panel), no MIME sniffing.
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ✅ Step 1: Proper CORS setup (for frontend on localhost:3000)
app.use(
  cors({
    origin: ["http://localhost:3000", "https://walras.net", "https://www.walras.net"],
    credentials: true,
    // PATCH: Admin → Administrators edits an admin with it.
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "X-Requested-With",
      "X-Walras-Account",
    ],
  })
);

// Support tickets carry attachments, so they get their own larger body limit;
// mounted before the global parser (100kb) so that one never sees them.
app.use("/api/support", require("./routes/support.routes"));
// Payments: the Razorpay webhook needs the raw body to check its signature,
// so this router parses its own bodies too.
app.use("/api/payment", require("./routes/payment.routes"));

// ✅ Step 2: Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Step 3: Import routes
const userRouter = require("./routes/user.route");
const adminRouter = require("./routes/admin.routes");
const walletRouter = require("./routes/wallet.routes");
const serverRouter = require("./routes/server.routes");
const authRouter = require("./routes/auth.routes");

// ✅ Step 4: Use routes
// What the website and console need to know about the platform's state:
// maintenance, paused payments and which plans are on sale. No secrets here.
const { getPlatform } = require("./utils/platformSettings");
// Virtual Machine plans for the Pricing page (active plans only).
app.get("/api/plans/vm", require("./controllers/vmPlans.controllers").publicList);
// Server locations shown on the site (active ones).
app.get("/api/locations", require("./controllers/serverLocations.controllers").publicList);

app.get("/api/settings/public", async (req, res) => {
  try {
    const { maintenanceMode, paymentsPaused, topUpsPaused, autoTopupEnabled, autoTopupReady, planAvailability } = await getPlatform();
    // "All plans out of stock" (stored as paymentsPaused) overrides every plan.
    const effective = paymentsPaused
      ? Object.fromEntries(Object.entries(planAvailability).map(([family, plans]) =>
          [family, Object.fromEntries(Object.keys(plans).map((name) => [name, false]))]))
      : planAvailability;
    // Cheapest active VM plan, for "from ₹…/mo" labels.
    const vmPlans = await require("./utils/computeStock").getPlans().catch(() => []);
    const vmFromPrice = vmPlans.length ? Math.min(...vmPlans.map((p) => p.monthly)) : null;
    res.json({ maintenanceMode, allOutOfStock: paymentsPaused, paymentsPaused, topUpsPaused, autoTopup: autoTopupEnabled && autoTopupReady && !topUpsPaused, planAvailability: effective, vmFromPrice });
  } catch (err) {
    console.error("Public settings failed:", err.message);
    res.json({ maintenanceMode: false, paymentsPaused: false, topUpsPaused: true, planAvailability: null });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/team", require("./routes/team.routes"));
// Unsubscribe link in "News & offers" bulk emails (GET from the link, POST for one-click).
const { unsubscribe } = require("./controllers/bulkEmail.controllers");
app.get("/api/email/unsubscribe", unsubscribe);
app.post("/api/email/unsubscribe", unsubscribe);
// A bulk email left "sending" by a restart is marked interrupted, to resume from admin.
setTimeout(() => require("./services/bulkEmail").markInterrupted(), 15000);
app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/servers", serverRouter);
app.use("/api/invoices", require("./routes/invoices.routes"));
// An API path nothing handles is a 404 in JSON, not the React app's HTML.
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// ✅ Step 5: Test DB connection
connection.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to PostgreSQL database");
  }
});

// ✅ Step 6: Serve static files from React build
// ✅ FIXED
app.use(express.static(path.join(process.cwd(), "client/build")));
app.use((req, res) => {
  res.sendFile(path.join(process.cwd(), "client/build", "index.html"));
});


// ✅ Step 8: Start the server
// Check the mail relay once at boot rather than finding out on the first
// customer email.
// Integration settings from Admin → Integrations (env as fallback): load
// them, then check email with whatever SMTP settings are in effect.
const integrations = require("./utils/integrations");
integrations.start();
integrations.refresh().then(() => verifyEmailTransport());

app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
