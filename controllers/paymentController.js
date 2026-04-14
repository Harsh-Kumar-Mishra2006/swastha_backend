const Payment = require('../models/paymentModel');
const Appointment = require('../models/appointmentModel');
const Patient = require('../models/patientModel');
const Doctor = require('../models/doctorModel');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// @desc    Get QR Code details for payment
// @route   GET /api/payments/qr-details
const getQRPaymentDetails = async (req, res) => {
  try {
    const { appointmentId } = req.query;
    
    // Get appointment to fetch amount
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    const consultationFee = appointment.doctor.consultationFee || 500;
    const convenienceFee = Math.round(consultationFee * 0.02);
    const totalAmount = consultationFee + convenienceFee;

    res.json({
      success: true,
      data: {
        upiId: 'yourbusiness@upi', // Replace with your actual UPI ID
        upiName: 'Your Business Name',
        amount: totalAmount,
        consultationFee,
        convenienceFee,
        qrCodeUrl: '/images/payment-qr.png', // Path to your QR code image in public folder
        instructions: [
          '1. Scan the QR code using any UPI app (Google Pay, PhonePe, Paytm, etc.)',
          '2. Verify the payee name and amount',
          '3. Complete the payment',
          '4. Take a screenshot of the payment success screen',
          '5. Upload the screenshot below'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Upload payment screenshot and create payment record
// @route   POST /api/payments/upload-screenshot
const uploadPaymentScreenshot = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.userId;
    const { appointmentId, transactionId, transactionReference, paymentTime } = req.body;
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Payment screenshot is required'
      });
    }

    // Get appointment details
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      'patient.userId': userId,
      status: 'pending'
    }).session(session);

    if (!appointment) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Pending appointment not found'
      });
    }

    // Check if appointment expired
    if (appointment.expiresAt && new Date() > appointment.expiresAt) {
      appointment.status = 'expired';
      await appointment.save({ session });
      fs.unlinkSync(req.file.path);
      
      return res.status(400).json({
        success: false,
        error: 'Appointment request expired. Please book again.'
      });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ 
      appointmentId: appointment._id,
      paymentStatus: { $in: ['pending', 'paid'] }
    }).session(session);

    if (existingPayment) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Payment already submitted for this appointment'
      });
    }

    // Calculate fees
    const consultationFee = appointment.doctor.consultationFee || 500;
    const convenienceFee = Math.round(consultationFee * 0.02);
    const totalAmount = consultationFee + convenienceFee;

    // Get patient details
    const patient = await Patient.findOne({ userId }).session(session);

    // Create payment record with pending status
    const payment = await Payment.create([{
      appointmentId: appointment._id,
      patient: {
        patientId: patient._id,
        userId: patient.userId,
        name: patient.name,
        email: patient.email,
        phone: patient.phone
      },
      doctor: {
        doctorId: appointment.doctor.doctorId,
        name: appointment.doctor.name,
        specialization: appointment.doctor.specialization
      },
      amount: consultationFee,
      consultationFee,
      convenienceFee,
      totalAmount,
      paymentStatus: 'pending',
      qrPayment: {
        upiId: 'yourbusiness@upi',
        upiName: 'Your Business Name',
        transactionId: transactionId || `TXN_${Date.now()}`,
        transactionReference: transactionReference || '',
        paymentTime: paymentTime ? new Date(paymentTime) : new Date(),
        uploadedScreenshot: {
          fileName: req.file.originalname,
          fileUrl: `/uploads/payments/${req.file.filename}`,
          uploadedAt: new Date()
        }
      }
    }], { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Payment screenshot uploaded successfully. Your payment is pending verification.',
      data: {
        paymentId: payment[0].paymentId,
        paymentStatus: 'pending_verification',
        message: 'Our team will verify your payment within 24 hours. You will receive a confirmation once verified.'
      }
    });

  } catch (error) {
    await session.abortTransaction();
    // Clean up uploaded file if there was an error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    console.error('Error uploading payment screenshot:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// @desc    Admin: Verify payment and confirm appointment
// @route   PUT /api/payments/verify-payment/:paymentId
const verifyPaymentAndConfirmAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { paymentId } = req.params;
    const { action, notes } = req.body; // action: 'approve' or 'reject'
    const adminUserId = req.user.userId;

    const payment = await Payment.findById(paymentId).session(session);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.paymentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Payment already ${payment.paymentStatus}`
      });
    }

    const appointment = await Appointment.findById(payment.appointmentId).session(session);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    if (action === 'approve') {
      // Update payment status
      payment.paymentStatus = 'paid';
      payment.qrPayment.verifiedBy = adminUserId;
      payment.qrPayment.verifiedAt = new Date();
      payment.qrPayment.verificationNotes = notes || 'Payment verified';
      await payment.save({ session });

      // Update appointment status to confirmed
      appointment.status = 'confirmed';
      appointment.bookingType = 'paid';
      appointment.payment = {
        amount: payment.totalAmount,
        status: 'paid',
        method: 'QR Code Payment',
        transactionId: payment.qrPayment.transactionId,
        paidAt: new Date()
      };
      await appointment.save({ session });

      await session.commitTransaction();

      res.json({
        success: true,
        message: 'Payment verified and appointment confirmed successfully',
        data: {
          appointmentId: appointment.appointmentId,
          paymentId: payment.paymentId,
          patientName: payment.patient.name,
          doctorName: payment.doctor.name
        }
      });
    } 
    else if (action === 'reject') {
      // Update payment status to rejected
      payment.paymentStatus = 'rejected';
      payment.qrPayment.verifiedBy = adminUserId;
      payment.qrPayment.verifiedAt = new Date();
      payment.qrPayment.verificationNotes = notes || 'Payment verification failed - please contact support';
      await payment.save({ session });

      // Optionally cancel the appointment
      appointment.status = 'cancelled';
      appointment.additionalNotes = `Payment rejected: ${notes || 'Verification failed'}`;
      await appointment.save({ session });

      await session.commitTransaction();

      res.json({
        success: true,
        message: 'Payment rejected and appointment cancelled',
        data: {
          paymentId: payment.paymentId,
          patientName: payment.patient.name
        }
      });
    }
    else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "approve" or "reject"'
      });
    }

  } catch (error) {
    await session.abortTransaction();
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// @desc    Get payment status
// @route   GET /api/payments/status/:appointmentId
const getPaymentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.userId;

    const payment = await Payment.findOne({ 
      appointmentId,
      'patient.userId': userId 
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    const appointment = await Appointment.findById(payment.appointmentId);

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        amount: payment.totalAmount,
        paymentStatus: payment.paymentStatus,
        appointmentId: payment.appointmentId,
        appointmentStatus: appointment?.status,
        doctorName: payment.doctor.name,
        patientName: payment.patient.name,
        uploadedScreenshot: payment.qrPayment.uploadedScreenshot,
        verificationStatus: payment.paymentStatus === 'pending' ? 'under_review' : 
                           payment.paymentStatus === 'paid' ? 'verified' : 'rejected',
        verificationNotes: payment.qrPayment.verificationNotes,
        paymentDate: payment.paymentDate
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all pending payments (Admin)
// @route   GET /api/payments/admin/pending
const getPendingPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find({ paymentStatus: 'pending' })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('qrPayment.verifiedBy', 'name email');

    const total = await Payment.countDocuments({ paymentStatus: 'pending' });

    res.json({
      success: true,
      data: payments.map(p => ({
        paymentId: p.paymentId,
        patientName: p.patient.name,
        patientPhone: p.patient.phone,
        doctorName: p.doctor.name,
        amount: p.totalAmount,
        transactionId: p.qrPayment.transactionId,
        screenshotUrl: p.qrPayment.uploadedScreenshot?.fileUrl,
        uploadedAt: p.qrPayment.uploadedScreenshot?.uploadedAt,
        appointmentId: p.appointmentId
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all payments for patient
// @route   GET /api/payments/my-payments
const getMyPayments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find({ 'patient.userId': userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments({ 'patient.userId': userId });

    res.json({
      success: true,
      data: payments.map(p => ({
        paymentId: p.paymentId,
        amount: p.totalAmount,
        paymentStatus: p.paymentStatus,
        doctorName: p.doctor.name,
        paymentDate: p.paymentDate,
        appointmentId: p.appointmentId,
        verificationStatus: p.paymentStatus === 'pending' ? 'Awaiting Verification' :
                           p.paymentStatus === 'paid' ? 'Verified ✓' : 'Rejected ✗'
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  getQRPaymentDetails,
  uploadPaymentScreenshot,
  verifyPaymentAndConfirmAppointment,
  getPaymentStatus,
  getPendingPayments,
  getMyPayments
};