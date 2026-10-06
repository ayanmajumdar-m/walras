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

// ✅ Step 1: Proper CORS setup (for frontend on localhost:3000)
app.use(
  cors({
    origin: ["http://localhost:3000", "https://walras.net", "https://www.walras.net"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "X-Requested-With",
    ],
  })
);

// Support tickets carry attachments, so they get their own larger body limit;
// mounted before the global parser (100kb) so that one never sees them.
app.use("/api/support", require("./routes/support.routes"));

// ✅ Step 2: Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Step 3: Import routes
const userRouter = require("./routes/user.route");
const adminRouter = require("./routes/admin.routes");
const walletRouter = require("./routes/wallet.routes");
const serverRouter = require("./routes/server.routes");
const authRouter = require("./routes/auth.routes");
const hostingRouter = require("./routes/hosting.routes");
const paymentRouter = require("./routes/payment.routes");

// ✅ Step 4: Use routes
// What the website and console need to know about the platform's state:
// maintenance, paused payments and which plans are on sale. No secrets here.
const { getPlatform } = require("./utils/platformSettings");
app.get("/api/settings/public", async (req, res) => {
  try {
    const { maintenanceMode, paymentsPaused, topUpsPaused, planAvailability } = await getPlatform();
    // "All plans out of stock" (stored as paymentsPaused) overrides every plan.
    const effective = paymentsPaused
      ? Object.fromEntries(Object.entries(planAvailability).map(([family, plans]) =>
          [family, Object.fromEntries(Object.keys(plans).map((name) => [name, false]))]))
      : planAvailability;
    res.json({ maintenanceMode, allOutOfStock: paymentsPaused, paymentsPaused, topUpsPaused, planAvailability: effective });
  } catch (err) {
    console.error("Public settings failed:", err.message);
    res.json({ maintenanceMode: false, paymentsPaused: false, topUpsPaused: true, planAvailability: null });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/servers", serverRouter);
app.use("/api/hosting", hostingRouter);
app.use("/api/payment", paymentRouter);

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
void verifyEmailTransport();

app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
