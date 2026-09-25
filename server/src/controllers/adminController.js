const crypto = require("crypto");
const Voucher = require("../models/Voucher");
const { adminPassword, adminSessionSecret } = require("../config");

const SESSION_COOKIE = "genvoucher_admin";
const SESSION_MAX_AGE = 8 * 60 * 60;

function adminLogin(req, res) {
  const password = String(req.body?.password || "");
  if (!adminPassword || !adminSessionSecret || !safeEqual(password, adminPassword)) {
    return res.status(401).json({ status: "error", message: "Invalid admin password." });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = String(expiresAt);
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE}; Path=/api/admin; HttpOnly; SameSite=Lax${secure}`);
  return res.json({ status: "ok" });
}

async function adminExport(req, res) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ status: "error", message: "Admin login required." });
  }

  try {
    const vouchers = await Voucher.find().sort({ issuedAt: -1 }).lean();
    const format = String(req.query?.format || "json").toLowerCase();
    if (format === "csv") {
      const fields = ["voucherId", "voucherType", "name", "mobile", "voucherNo", "invoiceNumber", "category", "branch", "amount", "voucherAmount", "status", "whatsappStatus", "issuedAt"];
      const rows = [fields.join(",")];
      vouchers.forEach((voucher) => {
        rows.push(fields.map((field) => csvValue(voucher[field])).join(","));
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="vouchers.csv"');
      return res.send(rows.join("\n"));
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="vouchers.json"');
    return res.json({ exportedAt: new Date().toISOString(), count: vouchers.length, vouchers });
  } catch (error) {
    console.error("Admin voucher export failed:", error.message);
    return res.status(500).json({ status: "error", message: "Could not export voucher data." });
  }
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers?.cookie || "");
  const token = cookies[SESSION_COOKIE] || "";
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || Number(expiresAt) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(expiresAt));
}

function sign(value) {
  return crypto.createHmac("sha256", adminSessionSecret || "missing-secret").update(value).digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header) {
  return header.split(";").reduce((cookies, pair) => {
    const separator = pair.indexOf("=");
    if (separator < 0) return cookies;
    const key = pair.slice(0, separator).trim();
    cookies[key] = decodeURIComponent(pair.slice(separator + 1).trim());
    return cookies;
  }, {});
}

function csvValue(value) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

module.exports = { adminLogin, adminExport };
