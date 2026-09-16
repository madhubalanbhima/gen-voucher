const { generateVoucher } = require("../../server/src/controllers/voucherController");

module.exports = (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  generateVoucher(req, res);
};