const express = require("express");
const { generateVoucher, listVouchers, purchaseVoucher, voucherImage } = require("../controllers/voucherController");

const router = express.Router();

router.post("/generate", generateVoucher);
router.post("/purchase", purchaseVoucher);
router.get("/:voucherId/image", voucherImage);
router.get("/", listVouchers);

module.exports = router;
