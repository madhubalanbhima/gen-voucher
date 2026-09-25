const mongoose = require("mongoose");
const { mongoUri } = require("./config");

let connectionPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) return;
  if (connectionPromise) return connectionPromise;
  if (!mongoUri) throw new Error("MONGODB_URI is not configured.");

  connectionPromise = mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  }).then(() => {
    console.log("MongoDB connected");
  }).catch((err) => {
    connectionPromise = undefined;
    console.error("MongoDB connection failed:", err.message);
    throw new Error("Database is unavailable.");
  });

  return connectionPromise;
}

module.exports = connectDB;
