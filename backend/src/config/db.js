// MongoDB connection using Mongoose (ES Modules)
import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('\n❌ MONGO_URI is not set in environment variables');
    console.error('   Please add MONGO_URI to your .env file');
    console.error('   Example: MONGO_URI=mongodb://127.0.0.1:27017/study-ai');
    console.error('   Make sure MongoDB is running on your system');
    throw new Error('MONGO_URI is not set in environment variables');
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DB || undefined,
    });
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('MongoDB connection error ❌:', err?.message || err);
    throw err;
  }
};

export default connectDB;


