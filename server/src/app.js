const path = require("path");
const express = require("express");
const connectDB = require("./db");
const voucherRoutes = require("./routes/voucherRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(express.json());

const clientDir = path.join(__dirname, "..", "..", "client");
app.use(express.static(clientDir));
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ status: "error", message: "Database is unavailable." });
  }
});
app.use("/api/vouchers", voucherRoutes);
app.use("/api/admin", adminRoutes);

app.get("*", (req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

module.exports = app;