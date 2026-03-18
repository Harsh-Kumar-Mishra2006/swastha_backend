// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const {
  createPaymentOrder,
  getPaymentStatus,
  verifyPayment,
  paymentWebhook,
  generatePaymentSlip,
  getMyPayments
} = require('../controllers/paymentController');

// Public/Callback routes (NO AUTH)
router.post('/webhook', paymentWebhook);
router.get('/verify', verifyPayment);

// Protected routes - Require authentication AND patient role
router.use(authenticateToken);
router.use(authorizeRoles(['patient'])); // This replaces patientOnly

router.post('/create-order', createPaymentOrder);
router.get('/status/:orderId', getPaymentStatus);
router.get('/my-payments', getMyPayments);
router.get('/receipt/:appointmentId', generatePaymentSlip);

module.exports = router;