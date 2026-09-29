const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

let mongod = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const isPlaceholder =
    !uri ||
    uri.includes("<db_password>") ||
    uri.includes("<your_") ||
    uri.includes("<password>");

  if (!isPlaceholder) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      console.warn(
        `Could not connect to configured MONGO_URI (${err.message}). Falling back to in-memory MongoDB...`
      );
    }
  } else {
    console.log(
      "MONGO_URI contains placeholder credentials. Initializing in-memory MongoDB..."
    );
  }

  try {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    const memoryUri = mongod.getUri();
    const conn = await mongoose.connect(memoryUri);
    console.log(`In-memory MongoDB connected successfully: ${conn.connection.host}`);
  } catch (memErr) {
    console.error("Failed to start MongoDB connection:", memErr.message);
    throw memErr;
  }
};

module.exports = connectDB;
