const crypto = require("crypto");
const Voucher = require("../models/Voucher");
const { fetchSchemeRecordsByMobile, findMatchingRecord } = require("../services/schemeApi");
const { sendVoucherMessage } = require("../services/whatsappApi");

const NAME_RE = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const MOBILE_RE = /^[0-9]{10}$/;
const PASSBOOK_RE = /^[A-Za-z0-9-]+$/;
const VOUCHER_SHARE = 0.5; // voucher = half of the scheme's totalAdvance
const VOUCHER_CUTOFF = Date.UTC(2026, 8, 14);

function validatePayload({ name, mobile, passbookNo, orderDate, address }) {
  const errors = {};

  if (!name || !name.trim()) {
    errors.name = "Name is required.";
  } else if (name.trim().length > 35 || !NAME_RE.test(name.trim())) {
    errors.name = "Enter a valid name — letters and single spaces only, up to 35 characters.";
  }

  if (!mobile) {
    errors.mobile = "Mobile number is required.";
  } else if (!MOBILE_RE.test(mobile)) {
    errors.mobile = "Enter exactly 10 digits.";
  }

  if (!passbookNo) {
    errors.passbookNo = "Passbook number is required.";
  } else if (!PASSBOOK_RE.test(passbookNo.trim())) {
    errors.passbookNo = "Use letters, numbers and hyphens only.";
  }

  if (!orderDate || !/^\d{4}-\d{2}-\d{2}$/.test(orderDate) || Number.isNaN(Date.parse(`${orderDate}T00:00:00Z`))) {
    errors.orderDate = "Enter a valid scheme order date.";
  }

  if (!address || !address.trim()) {
    errors.address = "Address is required.";
  }

  return errors;
}

function makeVoucherId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `GV-${stamp}-${rand}`;
}

async function generateVoucher(req, res) {
  const { name, mobile, passbookNo, orderDate, address } = req.body || {};

  const errors = validatePayload({ name, mobile, passbookNo, orderDate, address });
  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ status: "invalid", errors });
  }

  const cleanMobile = String(mobile).trim();
  const cleanPassbookNo = String(passbookNo).trim().toUpperCase();
  const cleanVoucherNo = cleanPassbookNo;

  let apiResponse;
  try {
    apiResponse = await fetchSchemeRecordsByMobile(cleanMobile);
  } catch (err) {
    console.error("Scheme API request failed:", err.message);
    return res.status(502).json({
      status: "error",
      message: "Could not reach scheme records right now. Please try again shortly.",
    });
  }

  const match = findMatchingRecord(apiResponse, cleanMobile, cleanVoucherNo);
  if (!match) {
    return res.status(200).json({
      status: "pending",
      message: "wait 24 hours for receiving voucher",
    });
  }

  const matchingOrderDate = parseApiDate(match?.matchingOrderDetail?.date);
  const requestedOrderDate = Date.parse(`${orderDate}T00:00:00Z`);
  if (!matchingOrderDate || matchingOrderDate !== requestedOrderDate) {
    return res.status(200).json({
      status: "ineligible",
      message: "The entered order date does not match the scheme record.",
    });
  }

  if (matchingOrderDate < VOUCHER_CUTOFF) {
    return res.status(200).json({
      status: "ineligible",
      message: "Vouchers are not generated for scheme orders dated before 20 September 2026.",
    });
  }

  const advance = Number(
    match?.matchingOrderDetail?.advance
      ?? match?.schemeDataViewModel?.totalAdvance
      ?? 0
  );
  const amount = advance * VOUCHER_SHARE;

  try {
    const existingPassbook = await Voucher.exists({ passbookNo: cleanPassbookNo });
    if (existingPassbook) {
      return res.status(409).json({
        status: "duplicate",
        message: "This passbook number has already been used.",
      });
    }

    const voucher = await Voucher.create({
      voucherId: makeVoucherId(),
      name: name.trim(),
      mobile: cleanMobile,
      voucherNo: cleanPassbookNo,
      passbookNo: cleanPassbookNo,
      orderDate: new Date(requestedOrderDate),
      amount,
      schemeOwnCode: match.ownCode,
      branch: match.branch,
    });

    try {
      await sendVoucherMessage({ mobile: cleanMobile, amount });
    } catch (err) {
      console.error("WhatsApp voucher delivery failed:", err.message);
    }

    return res.status(201).json({ status: "issued", voucher });
  } catch (err) {
    console.error("Saving voucher failed:", err.message);
    if (err.code === 11000 && err.keyPattern?.passbookNo) {
      return res.status(409).json({
        status: "duplicate",
        message: "This passbook number has already been used.",
      });
    }
    return res.status(500).json({
      status: "error",
      message: "Your details matched, but we couldn't save the voucher. Please try again.",
    });
  }
}

function parseApiDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? ""));
  if (!match) return null;
  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

async function listVouchers(req, res) {
  try {
    const vouchers = await Voucher.find().sort({ issuedAt: -1 }).limit(50);
    res.json({ vouchers });
  } catch (err) {
    console.error("Listing vouchers failed:", err.message);
    res.status(500).json({ status: "error", message: "Could not load voucher records." });
  }
}

module.exports = { generateVoucher, listVouchers };
