const { voucherImage } = require("../../../server/src/controllers/voucherController");
const connectDB = require("../../../server/src/db");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    await connectDB();
  } catch (err) {
    res.status(503).send("Database is unavailable");
    return;
  }

  req.params = { voucherId: req.query.voucherId };
  return voucherImage(req, res);
};
