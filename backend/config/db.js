import mongoose from "mongoose";

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error(
      "❌ MONGO_URI is not set. Copy backend/.env.example to backend/.env and fill in your MongoDB connection string."
    );
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Deliberately NOT calling process.exit() here: if the DB is unreachable
    // (bad password, IP not whitelisted in Atlas, etc.) the server should
    // stay up and keep saying so clearly, instead of disappearing entirely
    // and making every request fail with a confusing connection error.
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    console.error(
      "   Check: (1) MONGO_URI in backend/.env is correct, (2) your MongoDB Atlas cluster's Network Access list allows your current IP (or 0.0.0.0/0), (3) the database user/password are correct."
    );
  }
};

export default connectDB;
