const mongoose = require("mongoose");
const { mongoUri } = require("./config");

let connectionPromise;

async function connectDB() {
  try {
    if (mongoose.connection.readyState === 1) return;
    if (!connectionPromise) connectionPromise = mongoose.connect(mongoUri);
    await connectionPromise;
    console.log(`MongoDB connected (${mongoUri})`);
  } catch (err) {
    connectionPromise = undefined;
    console.error("MongoDB connection failed:", err.message);
    throw new Error("Database is unavailable.");
  }
}

module.exports = connectDB;
