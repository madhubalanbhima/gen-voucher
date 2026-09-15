const mongoose = require("mongoose");
const { mongoUri } = require("./config");

async function connectDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected (${mongoUri})`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.error("The server will keep running, but voucher storage/listing will fail until MongoDB is reachable.");
  }
}

module.exports = connectDB;
