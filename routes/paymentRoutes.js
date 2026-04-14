const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
  getQRPaymentDetails,
  uploadPaymentScreenshot,
  verifyPaymentAndConfirmAppointment,
  getPaymentStatus,
  getPendingPayments,
  getMyPayments
} = require('../controllers/paymentController');

// Patient routes
router.get('/qr-details', authenticateToken, authorizeRoles(['patient']), getQRPaymentDetails);
router.post('/upload-screenshot', 
  authenticateToken, 
  authorizeRoles(['patient']),
  upload.single('screenshot'),
  uploadPaymentScreenshot
);
router.get('/status/:appointmentId', authenticateToken, authorizeRoles(['patient']), getPaymentStatus);
router.get('/my-payments', authenticateToken, authorizeRoles(['patient']), getMyPayments);

// Admin routes
router.get('/admin/pending', authenticateToken, authorizeRoles(['admin']), getPendingPayments);
router.put('/admin/verify-payment/:paymentId', authenticateToken, authorizeRoles(['admin']), verifyPaymentAndConfirmAppointment);

module.exports = router;