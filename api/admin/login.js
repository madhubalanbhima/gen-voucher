const { adminLogin } = require("../../server/src/controllers/adminController");

module.exports = (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }
  return adminLogin(req, res);
};