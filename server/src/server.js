const path = require("path");
const express = require("express");
const connectDB = require("./db");
const voucherRoutes = require("./routes/voucherRoutes");
const { port } = require("./config");

const app = express();

app.use(express.json());

// Serve the front-end (client/) directly from this server so the
// browser calls /api/vouchers on the same origin — no CORS needed.
const clientDir = path.join(__dirname, "..", "..", "client");
app.use(express.static(clientDir));

app.use("/api/vouchers", voucherRoutes);

app.get("*", (req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

connectDB();

app.listen(port, () => {
  console.log(`Gen-Vocher server running at http://localhost:${port}`);
});
