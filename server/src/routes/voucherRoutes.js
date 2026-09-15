const express = require("express");
const { generateVoucher, listVouchers } = require("../controllers/voucherController");

const router = express.Router();

router.post("/generate", generateVoucher);
router.get("/", listVouchers);

module.exports = router;
