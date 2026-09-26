const { generateVoucher } = require("../../server/src/controllers/voucherController");
const connectDB = require("../../server/src/db");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  try {
    await connectDB();
  } catch (err) {
    res.status(503).json({ status: "error", message: "Database is unavailable." });
    return;
  }

  return generateVoucher(req, res);
};