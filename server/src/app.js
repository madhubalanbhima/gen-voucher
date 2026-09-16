const path = require("path");
const express = require("express");
const connectDB = require("./db");
const voucherRoutes = require("./routes/voucherRoutes");

const app = express();

app.use(express.json());

const clientDir = path.join(__dirname, "..", "..", "client");
app.use(express.static(clientDir));
app.use("/api/vouchers", voucherRoutes);
app.use("/vouchers", voucherRoutes);

app.get("*", (req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

connectDB();

module.exports = app;