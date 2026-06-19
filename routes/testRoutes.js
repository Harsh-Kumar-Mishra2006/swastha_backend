// routes/testRoutes.js
const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinaryConfig');
const cloudinary = require('cloudinary').v2;

// ✅ Test 1: Check Cloudinary configuration
router.get('/cloudinary-config', (req, res) => {
  try {
    const config = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'Not set',
      api_key: process.env.CLOUDINARY_API_KEY ? 'Set (hidden)' : 'Not set',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set (hidden)' : 'Not set',
      configured: !!(process.env.CLOUDINARY_CLOUD_NAME && 
                     process.env.CLOUDINARY_API_KEY && 
                     process.env.CLOUDINARY_API_SECRET)
    };
    
    res.json({
      success: true,
      message: 'Cloudinary configuration status',
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ Test 2: Upload a test file to Cloudinary
router.post('/cloudinary-upload', upload.single('testFile'), async (req, res) => {
  console.log('🧪 TEST: Cloudinary Upload');
  console.log('📁 File received:', req.file ? 'Yes' : 'No');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please select a file to test.'
      });
    }

    // Get the uploaded file details
    const fileDetails = {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      filename: req.file.filename,
      url: req.file.path // Cloudinary URL
    };

    console.log('✅ File uploaded successfully to Cloudinary:');
    console.log('   URL:', fileDetails.url);
    console.log('   Public ID:', fileDetails.filename);

    res.json({
      success: true,
      message: 'File uploaded to Cloudinary successfully!',
      data: {
        file: fileDetails,
        cloudinary_url: fileDetails.url,
        public_id: fileDetails.filename
      }
    });

  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload to Cloudinary',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ✅ Test 3: Check if Cloudinary API is accessible
router.get('/cloudinary-test', async (req, res) => {
  try {
    // Try to ping Cloudinary
    const result = await cloudinary.api.ping();
    
    res.json({
      success: true,
      message: 'Cloudinary API is accessible',
      data: {
        status: result.status,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_accessible: true
      }
    });
  } catch (error) {
    console.error('❌ Cloudinary API test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Cloudinary API is not accessible',
      details: error.message,
      possible_reasons: [
        'Invalid cloud_name',
        'Invalid API key or secret',
        'Network connectivity issue',
        'Cloudinary service is down'
      ]
    });
  }
});

// ✅ Test 4: Delete test file from Cloudinary
router.delete('/cloudinary-delete/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        error: 'Public ID is required'
      });
    }

    const result = await cloudinary.uploader.destroy(publicId);
    
    res.json({
      success: true,
      message: 'File deleted from Cloudinary',
      data: result
    });
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete from Cloudinary',
      details: error.message
    });
  }
});

module.exports = router;