const express = require("express");
const connectDB = require("../db");
const { adminLogin, adminExport } = require("../controllers/adminController");

const router = express.Router();

router.post("/login", adminLogin);
router.get("/export", async (req, res) => {
  try {
    await connectDB();
  } catch (error) {
    return res.status(503).json({ status: "error", message: "Database is unavailable." });
  }
  return adminExport(req, res);
});

module.exports = router;