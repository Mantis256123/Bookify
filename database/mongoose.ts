import mongoose from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL;

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const cached =
  global.mongooseCache ||
  (global.mongooseCache = { conn: null, promise: null });

export const connectToDatabase = async () => {
  if (!MONGODB_URL) {
    throw new Error(
      "MONGODB_URL is not configured. Add it to the deployment environment variables.",
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URL, { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }

  console.info("Connected to MongoDB");
  return cached.conn;
};
