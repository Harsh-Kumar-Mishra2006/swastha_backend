const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Attempting to connect with URI:', process.env.MONGODB_URI ? 'URI is set' : 'URI is NOT set');
    
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    // Debug: Show first 20 chars of URI to check format (safely)
    const uriPreview = process.env.MONGODB_URI.substring(0, 20);
    console.log('URI starts with:', uriPreview + '...');

    // Remove the options object - they're not needed in Mongoose 6+
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.error('Your MONGODB_URI should start with "mongodb://" or "mongodb+srv://"');
    console.error('Current URI starts with:', process.env.MONGODB_URI?.substring(0, 20));
    process.exit(1);
  }
};

module.exports = connectDB;