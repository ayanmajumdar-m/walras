const express = require("express");
const connection = require("./config/db");
const path = require("path");
const app = express();
const port = process.env.PORT || 3001;
const bodyParser = require("body-parser");
const cors = require("cors");

// Initialize billing service
require("./services/billingServices");
console.log("💰 Billing service initialized");

// ✅ Step 1: Proper CORS setup (for frontend on localhost:3000)
app.use(
  cors({
    origin: ["http://localhost:3000", "https://dujdidnis.buttr.cloud", "https://buttr.cloud", "https://www.buttr.cloud"],
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

// ✅ Step 2: Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Step 3: Import routes
const userRouter = require("./routes/user.route");
const adminRouter = require("./routes/admin.routes");
const walletRouter = require("./routes/wallet.routes");
const serverRouter = require("./routes/server.routes");
const authRouter = require("./routes/auth.routes");
const bolddesktest = require("./bolddesktest");

// ✅ Step 4: Use routes
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/servers", serverRouter);

// ✅ Step 5: Test DB connection
connection.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to MySQL database");
  }
});

// ✅ Step 6: Serve static files from React build
// ✅ FIXED
app.use(express.static(path.join(process.cwd(), "client/build")));
app.use((req, res) => {
  res.sendFile(path.join(process.cwd(), "client/build", "index.html"));
});


// ✅ Step 8: Start the server
app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
