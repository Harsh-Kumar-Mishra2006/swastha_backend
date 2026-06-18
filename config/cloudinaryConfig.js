// config/cloudinaryConfig.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

/**
 * Configure Cloudinary with environment variables
 * Make sure to set these in your .env file:
 * CLOUDINARY_CLOUD_NAME=your-cloud-name
 * CLOUDINARY_API_KEY=your-api-key
 * CLOUDINARY_API_SECRET=your-api-secret
 */
const configureCloudinary = () => {
  // Check if Cloudinary credentials exist
  if (!process.env.CLOUDINARY_CLOUD_NAME || 
      !process.env.CLOUDINARY_API_KEY || 
      !process.env.CLOUDINARY_API_SECRET) {
    console.warn('⚠️ Cloudinary credentials not found in environment variables');
    console.warn('Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Use HTTPS
  });

  console.log('✅ Cloudinary configured successfully');
  return cloudinary;
};

/**
 * Create Multer storage with Cloudinary
 */
const createCloudinaryStorage = (options = {}) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: options.folder || 'appointment_payments',
      allowed_formats: options.allowed_formats || ['jpg', 'jpeg', 'png', 'pdf'],
      transformation: options.transformation || [
        { width: 1000, height: 1000, crop: 'limit', quality: 'auto' }
      ],
      // Add timestamp to filename to avoid duplicates
      public_id: (req, file) => {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const originalName = file.originalname.split('.')[0].replace(/\s+/g, '_');
        return `appointment_${originalName}_${timestamp}_${random}`;
      }
    }
  });
};

/**
 * Configure multer for file uploads
 */
const configureUpload = (options = {}) => {
  const storage = createCloudinaryStorage(options);
  
  const multer = require('multer');
  return multer({
    storage: storage,
    limits: {
      fileSize: options.fileSize || 5 * 1024 * 1024 // 5MB default
    },
    fileFilter: (req, file, cb) => {
      // Allow only images and PDFs
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
      }
    }
  });
};

// Initialize Cloudinary
const cloudinaryInstance = configureCloudinary();

module.exports = {
  cloudinary: cloudinaryInstance,
  configureUpload,
  createCloudinaryStorage,
  configureCloudinary
};