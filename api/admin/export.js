const connectDB = require("../../server/src/db");
const { adminExport } = require("../../server/src/controllers/adminController");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }
  try {
    await connectDB();
  } catch (error) {
    res.status(503).json({ status: "error", message: "Database is unavailable." });
    return;
  }
  return adminExport(req, res);
};