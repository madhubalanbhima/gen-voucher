const { voucherImage } = require("../../../server/src/controllers/voucherController");

module.exports = (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  req.params = { voucherId: req.query.voucherId };
  voucherImage(req, res);
};
