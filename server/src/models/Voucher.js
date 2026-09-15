const mongoose = require("mongoose");

const voucherSchema = new mongoose.Schema({
  voucherId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  voucherNo: { type: String, required: true },
  passbookNo: { type: String, required: true, unique: true },
  orderDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  schemeOwnCode: { type: Number },
  branch: { type: String },
  issuedAt: { type: Date, default: Date.now },
});

// Speeds up "did this mobile/voucherNo already get a voucher" checks.
voucherSchema.index({ mobile: 1, voucherNo: 1 });

module.exports = mongoose.model("Voucher", voucherSchema);
