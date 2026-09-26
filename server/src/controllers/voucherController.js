const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Voucher = require("../models/Voucher");
const { fetchSchemeRecordsByMobile, findMatchingRecord } = require("../services/schemeApi");
const { fetchPurchaseDetails } = require("../services/purchaseApi");
const { sendVoucherMessage } = require("../services/whatsappApi");
const { publicAppUrl } = require("../config");

const NAME_RE = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const MOBILE_RE = /^[0-9]{10}$/;
const PASSBOOK_RE = /^[A-Za-z0-9-]+$/;
const CATEGORY_RE = /^(antique|gold|diamond)$/i;
const NUMBER_RE = /^\d+(?:\.\d{1,2})?$/;
const VOUCHER_CUTOFF = Date.UTC(2026, 8, 14);
const PURCHASE_BRANCH = "Thanjavur";

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

function getPurchaseVoucherAmount(purchase) {
  const category = String(purchase?.metalDetails?.Category ?? "").toLowerCase();
  const vaAmount = Number(purchase?.metalDetails?.vaAmount);
  if (!Number.isFinite(vaAmount) || vaAmount < 0) return null;
  if (category === "antique") return vaAmount * 0.2;
  if (category === "gold" || category === "diamond") return vaAmount * 0.25;
  return null;
}

async function getEligiblePurchase() {
  const purchase = await fetchPurchaseDetails();
  if (purchase?.branchName !== PURCHASE_BRANCH) {
    return { error: "The branch not applicable for voucher" };
  }

  const amount = getPurchaseVoucherAmount(purchase);
  if (amount === null) {
    return { error: "This jewellery category or variant is not applicable for voucher." };
  }

  return { purchase, amount, voucherAmount: amount / 2 };
}

async function purchaseVoucher(req, res) {
  let step = "validation";
  try {
    const payload = req.body || {};
    const category = String(payload.category || "").trim().toLowerCase();
    const vaAmount = String(payload.vaAmount || "").trim();
    const errors = {};
    if (!String(payload.branchName || "").trim()) errors.branchName = "Branch is required.";
    if (!String(payload.customerName || "").trim()) errors.customerName = "Customer name is required.";
    if (!MOBILE_RE.test(String(payload.mobile || "").trim())) errors.mobile = "Enter exactly 10 digits.";
    if (!String(payload.invoiceNumber || "").trim()) errors.invoiceNumber = "Invoice number is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.purchaseDate || ""))) errors.purchaseDate = "Enter a valid purchase date.";
    if (!CATEGORY_RE.test(category)) errors.category = "Choose Gold, Diamond or Antique.";
    if (!NUMBER_RE.test(vaAmount) || Number(vaAmount) < 0) errors.vaAmount = "Enter a valid VA amount.";
    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ status: "invalid", errors });
    }

    step = "purchase lookup";
    const purchase = await fetchPurchaseDetails({
      branchName: String(payload.branchName).trim(),
      metalDetails: { Category: category, vaAmount: Number(vaAmount) },
      customerDetails: { customerName: String(payload.customerName).trim(), mobileNumber: String(payload.mobile).trim() },
      invoiceNumber: String(payload.invoiceNumber).trim(),
      Date: String(payload.purchaseDate),
    });
    if (purchase?.branchName !== PURCHASE_BRANCH) {
      return res.status(200).json({ status: "ineligible", message: "The branch not applicable for voucher" });
    }

    const amount = getPurchaseVoucherAmount(purchase);
    if (amount === null) {
      return res.status(200).json({
        status: "ineligible",
        message: "This jewellery category or variant is not applicable for voucher.",
      });
    }

    const customer = purchase.customerDetails || {};
    const mobile = String(customer.mobileNumber || "").trim();
    const invoiceNumber = String(purchase.invoiceNumber || "").trim();
    if (!mobile || !invoiceNumber) {
      return res.status(200).json({ status: "ineligible", message: "Purchase response is missing customer or invoice details." });
    }

    const voucherAmount = amount / 2;
    step = "checking duplicate invoice";
    const existingVoucher = await Voucher.exists({ invoiceNumber });
    if (existingVoucher) {
      return res.status(409).json({ status: "duplicate", message: "This invoice already has a voucher." });
    }

    step = "saving voucher";
    const voucher = await Voucher.create({
      voucherId: makeVoucherId(),
      name: customer.customerName || "Customer",
      mobile,
      voucherNo: invoiceNumber,
      passbookNo: invoiceNumber,
      orderDate: parsePurchaseDate(purchase.Date),
      amount,
      voucherAmount,
      invoiceNumber,
      voucherType: "purchase",
      status: "issued",
      category: purchase.metalDetails.Category,
      variant: purchase.metalDetails.Variant ?? purchase.metalDetails.Varient,
      branch: purchase.branchName,
    });

    await deliverVoucherCopies(req, voucher, mobile);

    return res.status(201).json({ status: "issued", voucher });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ status: "duplicate", message: "This invoice already has a voucher." });
    }
    console.error(`Purchase voucher generation failed during ${step}:`, err.stack || err.message);
    if (step === "checking duplicate invoice" || step === "saving voucher") {
      return res.status(503).json({ status: "error", message: "Voucher storage is unavailable. Please try again shortly." });
    }
    return res.status(500).json({ status: "error", message: "Could not generate the purchase voucher." });
  }
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

  let purchaseResult;
  try {
    purchaseResult = await getEligiblePurchase();
  } catch (err) {
    console.error("Purchase API request failed:", err.message);
    return res.status(502).json({ status: "error", message: "Could not retrieve purchase details right now." });
  }
  if (purchaseResult.error) {
    return res.status(200).json({ status: "ineligible", message: purchaseResult.error });
  }

  const { purchase } = purchaseResult;
  const advance = Number(
    match?.matchingOrderDetail?.advance
      ?? match?.schemeDataViewModel?.totalAdvance
      ?? 0
  );
  if (!Number.isFinite(advance) || advance < 0) {
    return res.status(200).json({
      status: "ineligible",
      message: "The scheme record does not contain a valid advance amount.",
    });
  }

  const amount = advance * 0.5;
  const voucherAmount = amount / 2;
  const schemeOwnCode = Number(match.ownCode);
  const hasNumericSchemeOwnCode = match.ownCode != null
    && String(match.ownCode).trim() !== ""
    && Number.isFinite(schemeOwnCode);

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
      mobile: String(purchase.customerDetails?.mobileNumber || cleanMobile),
      voucherNo: cleanPassbookNo,
      passbookNo: cleanPassbookNo,
      orderDate: new Date(requestedOrderDate),
      amount,
      voucherAmount,
      invoiceNumber: String(purchase.invoiceNumber),
      voucherType: "scheme",
      status: "issued",
      category: purchase.metalDetails.Category,
      variant: purchase.metalDetails.Variant ?? purchase.metalDetails.Varient,
      ...(hasNumericSchemeOwnCode ? { schemeOwnCode } : {}),
      branch: purchase.branchName,
    });

    await deliverVoucherCopies(req, voucher, String(purchase.customerDetails?.mobileNumber || cleanMobile));

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

async function deliverVoucherCopies(req, voucher, mobile) {
  try {
    const requestProtocol = req.protocol || req.headers["x-forwarded-proto"] || "https";
    const requestHost = typeof req.get === "function" ? req.get("host") : req.headers.host;
    const appUrl = publicAppUrl || `${requestProtocol}://${requestHost}`;
    if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/i.test(appUrl)) {
      throw new Error("PUBLIC_APP_URL must be a public URL so WhatsApp can fetch the voucher image.");
    }
    const imageBaseUrl = `${appUrl.replace(/\/$/, "")}/api/vouchers/${encodeURIComponent(voucher.voucherId)}/image`;
    const templateNamesByCategory = {
      diamond: ["tnj_diamond_voucher_1", "tnj_diamond_voucher_2"],
      antique: ["tnj_gold_voucher_01", "tnj_gold_voucher_2"],
      gold: ["tnj_gold_voucher_01", "tnj_gold_voucher_2"],
    };
    const category = voucher.voucherType === "scheme"
      ? "gold"
      : String(voucher.category || "").toLowerCase();
    const templateNames = templateNamesByCategory[category];
    const responses = await Promise.all([1, 2].map((copy) => sendVoucherMessage({
      mobile,
      amount: voucher.voucherAmount,
      imageUrl: `${imageBaseUrl}?copy=${copy}`,
      templateName: templateNames?.[copy - 1],
    })));
    const messageIds = responses.map((response) => getWhatsappMessageId(response?.data)).filter(Boolean);
    await Voucher.updateOne(
      { _id: voucher._id },
      { $set: { whatsappStatus: "sent", ...(messageIds[0] ? { whatsappMessageId: messageIds[0] } : {}) }, $addToSet: { whatsappMessageIds: { $each: messageIds } } }
    );
    voucher.whatsappStatus = "sent";
    voucher.whatsappMessageIds = messageIds;
    if (messageIds[0]) voucher.whatsappMessageId = messageIds[0];
  } catch (err) {
    console.error("WhatsApp voucher delivery failed:", err.message);
    try {
      await Voucher.updateOne({ _id: voucher._id }, { $set: { whatsappStatus: "failed" } });
    } catch (updateError) {
      console.error("Could not record WhatsApp delivery failure:", updateError.message);
    }
    voucher.whatsappStatus = "failed";
  }
}

async function voucherImage(req, res) {
  try {
    const voucher = await Voucher.findOne({ voucherId: req.params.voucherId }).lean();
    if (!voucher) return res.status(404).send("Voucher not found");
    const imageName = voucher.voucherType === "scheme"
      ? "passbook.jpeg"
      : {
          gold: "Gold.jpeg",
          diamond: "Diamond.jpeg",
          antique: "Antique.jpeg",
        }[String(voucher.category || "").toLowerCase()];
    if (!imageName) return res.status(404).send("Voucher image not found");
    const imagePath = path.join(__dirname, "..", "..", "..", "client", "assets", imageName);
    const image = fs.readFileSync(imagePath);
    res.setHeader("Content-Type", "image/jpeg");
    res.send(image);
  } catch (err) {
    console.error("Voucher image generation failed:", err.message);
    res.status(500).send("Could not generate voucher image");
  }
}

function getWhatsappMessageId(responseData) {
  return responseData?.message_id
    || responseData?.messageId
    || responseData?.data?.message_id
    || responseData?.data?.messageId
    || null;
}

function parseApiDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? ""));
  if (!match) return null;
  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function parsePurchaseDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    return new Date(`${value}T00:00:00Z`);
  }
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value ?? ""));
  if (!match) return new Date();
  return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
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

module.exports = { generateVoucher, listVouchers, purchaseVoucher, voucherImage, getPurchaseVoucherAmount, getEligiblePurchase };
