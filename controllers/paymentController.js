// controllers/paymentController.js
const Payment = require('../models/paymentModel');
const Appointment = require('../models/appointmentModel');
const Patient = require('../models/patientModel');
const Doctor = require('../models/doctorModel');
const mongoose = require('mongoose');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

// Cashfree configuration from .env
const CASHFREE_APP_ID = process.env.SECRET_APP_ID_CASHFREE;
const CASHFREE_SECRET_KEY = process.env.SECRET_API_KEY_CASHFREE;
const CASHFREE_API_URL = 'https://sandbox.cashfree.com/pg'; // Sandbox for testing

// Headers for Cashfree API
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-api-version': '2022-09-01',
  'x-client-id': CASHFREE_APP_ID,
  'x-client-secret': CASHFREE_SECRET_KEY
});

// @desc    Create payment order after appointment booking
// @route   POST /api/payments/create-order
const createPaymentOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.userId;
    const { appointmentId } = req.body;

    // Get appointment details with proper validation
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      'patient.userId': userId,
      status: 'pending'
    }).session(session);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Pending appointment not found'
      });
    }

    // Check if appointment expired (if you added expiresAt field)
    if (appointment.expiresAt && new Date() > appointment.expiresAt) {
      appointment.status = 'expired';
      await appointment.save({ session });
      
      return res.status(400).json({
        success: false,
        error: 'Appointment request expired. Please book again.'
      });
    }

    // Check if payment already exists and is not failed
    const existingPayment = await Payment.findOne({ 
      appointmentId: appointment._id,
      paymentStatus: { $ne: 'failed' }
    }).session(session);

    if (existingPayment) {
      if (existingPayment.paymentStatus === 'paid') {
        return res.status(400).json({
          success: false,
          error: 'Payment already completed for this appointment'
        });
      }
      
      // Return existing pending payment details
      return res.json({
        success: true,
        message: 'Existing payment found',
        data: {
          paymentId: existingPayment.paymentId,
          orderId: existingPayment.orderId,
          amount: existingPayment.totalAmount,
          consultationFee: existingPayment.amount,
          convenienceFee: existingPayment.convenienceFee,
          patientName: existingPayment.patient.name,
          doctorName: existingPayment.doctor.name,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime.slot,
          cashfree: existingPayment.cashfree
        }
      });
    }

    // Calculate fees
    const consultationFee = appointment.doctor.consultationFee || 500;
    const convenienceFee = Math.round(consultationFee * 0.02); // 2% convenience fee
    const totalAmount = consultationFee + convenienceFee;

    // Create order ID
    const orderId = `ORD_${appointment.appointmentId}_${Date.now().toString().slice(-6)}`;

    // Prepare Cashfree order
    const cashfreeOrder = {
      order_id: orderId,
      order_amount: totalAmount,
      order_currency: 'INR',
      customer_details: {
        customer_id: userId.toString(),
        customer_name: appointment.patient.name,
        customer_email: appointment.patient.email,
        customer_phone: appointment.patient.phone
      },
      order_meta: {
        return_url: `${process.env.BASE_URL}/api/payments/verify?order_id={order_id}`,
        notify_url: `${process.env.BASE_URL}/api/payments/webhook`
      },
      order_note: `Consultation fee for Dr. ${appointment.doctor.name} on ${new Date(appointment.appointmentDate).toLocaleDateString()}`
    };

    // Call Cashfree API to create order
    let cashfreeResponse;
    try {
      const response = await axios.post(
        `${CASHFREE_API_URL}/orders`,
        cashfreeOrder,
        { headers: getHeaders() }
      );
      cashfreeResponse = response.data;
    } catch (apiError) {
      console.error('Cashfree API Error:', apiError.response?.data || apiError.message);
      
      // For development/testing only - REMOVE IN PRODUCTION
      if (process.env.NODE_ENV === 'development') {
        cashfreeResponse = {
          order_id: orderId,
          order_token: `mock_token_${Date.now()}`,
          payment_link: `https://test.cashfree.com/pay/${orderId}`,
          payment_session_id: `session_${Date.now()}`
        };
      } else {
        throw new Error('Payment gateway error. Please try again.');
      }
    }

    // Create payment record
    const payment = await Payment.create([{
      appointmentId: appointment._id,
      patient: {
        patientId: appointment.patient.patientId,
        userId: appointment.patient.userId,
        name: appointment.patient.name,
        email: appointment.patient.email,
        phone: appointment.patient.phone
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
      orderId,
      cashfree: {
        orderId: cashfreeResponse.order_id,
        orderToken: cashfreeResponse.order_token,
        paymentLink: cashfreeResponse.payment_link,
        paymentSessionId: cashfreeResponse.payment_session_id
      }
    }], { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Payment order created',
      data: {
        paymentId: payment[0].paymentId,
        orderId: payment[0].orderId,
        amount: payment[0].totalAmount,
        consultationFee: payment[0].amount,
        convenienceFee: payment[0].convenienceFee,
        patientName: payment[0].patient.name,
        doctorName: payment[0].doctor.name,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime.slot,
        cashfree: {
          orderToken: payment[0].cashfree.orderToken,
          paymentLink: payment[0].cashfree.paymentLink,
          paymentSessionId: payment[0].cashfree.paymentSessionId
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// @desc    Verify payment (callback from Cashfree)
// @route   GET /api/payments/verify
const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { order_id } = req.query;

    // Get payment from database
    const payment = await Payment.findOne({ orderId: order_id }).session(session);
    
    if (!payment) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=Payment not found`);
    }

    // Get appointment
    const appointment = await Appointment.findById(payment.appointmentId).session(session);
    
    if (!appointment || appointment.status !== 'pending') {
      return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=Appointment expired or invalid`);
    }

    // Verify with Cashfree API
    try {
      const response = await axios.get(
        `${CASHFREE_API_URL}/orders/${order_id}/payments`,
        { headers: getHeaders() }
      );
      
      const payments = response.data;
      if (payments && payments.length > 0) {
        const paymentData = payments[0];
        
        if (paymentData.payment_status === 'SUCCESS') {
          // Update payment record
          payment.paymentStatus = 'paid';
          payment.orderStatus = 'success';
          payment.paymentMethod = paymentData.payment_method || 'upi';
          payment.transactionDetails = {
            transactionId: paymentData.payment_id,
            bankReference: paymentData.bank_reference,
            paymentTime: new Date(),
            paymentMode: paymentData.payment_method,
            upiId: paymentData.payment_method?.upi?.upi_id
          };
          payment.paymentDate = new Date();
          await payment.save({ session });

          // Update appointment status to confirmed
          appointment.status = 'confirmed';
          appointment.bookingType = 'paid';
          appointment.payment = {
            amount: payment.totalAmount,
            status: 'paid',
            method: payment.paymentMethod,
            transactionId: paymentData.payment_id,
            paidAt: new Date()
          };
          await appointment.save({ session });

          await session.commitTransaction();

          // Redirect to success page
          return res.redirect(
            `${process.env.FRONTEND_URL}/payment/success?` +
            `order_id=${order_id}&appointment_id=${payment.appointmentId}`
          );
        }
      }
    } catch (error) {
      console.error('Payment verification error:', error);
    }

    // Payment failed
    payment.paymentStatus = 'failed';
    payment.orderStatus = 'failure';
    await payment.save({ session });
    
    await session.commitTransaction();
    
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed?order_id=${order_id}`);

  } catch (error) {
    await session.abortTransaction();
    console.error('Error verifying payment:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed?error=Verification failed`);
  } finally {
    session.endSession();
  }
};

// @desc    Webhook for payment updates
// @route   POST /api/payments/webhook
const paymentWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const webhookData = req.body;
    
    // Verify webhook signature (implement Cashfree signature verification)
    const signature = req.headers['x-webhook-signature'];
    // Add signature verification logic here
    
    const { order_id, payment_status } = webhookData.data || webhookData;

    if (!order_id) {
      return res.status(400).json({ error: 'Order ID missing' });
    }

    const payment = await Payment.findOne({ orderId: order_id }).session(session);
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment_status === 'SUCCESS') {
      payment.paymentStatus = 'paid';
      payment.orderStatus = 'success';
      
      const appointment = await Appointment.findById(payment.appointmentId).session(session);
      if (appointment && appointment.status === 'pending') {
        appointment.status = 'confirmed';
        appointment.bookingType = 'paid';
        appointment.payment = {
          amount: payment.totalAmount,
          status: 'paid',
          method: payment.paymentMethod,
          transactionId: webhookData.data?.payment_id,
          paidAt: new Date()
        };
        await appointment.save({ session });
      }
    } else if (payment_status === 'FAILED') {
      payment.paymentStatus = 'failed';
      payment.orderStatus = 'failure';
    }

    payment.updatedAt = new Date();
    await payment.save({ session });

    await session.commitTransaction();

    res.json({ 
      success: true,
      message: 'Webhook processed' 
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Get payment status
// @route   GET /api/payments/status/:orderId
const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const payment = await Payment.findOne({ 
      orderId,
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
        orderId: payment.orderId,
        amount: payment.totalAmount,
        paymentStatus: payment.paymentStatus,
        orderStatus: payment.orderStatus,
        appointmentId: payment.appointmentId,
        appointmentStatus: appointment?.status,
        doctorName: payment.doctor.name,
        patientName: payment.patient.name,
        transactionDetails: payment.transactionDetails,
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

// @desc    Generate payment receipt/slip PDF
// @route   GET /api/payments/receipt/:appointmentId
const generatePaymentSlip = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.userId;

    const payment = await Payment.findOne({ 
      appointmentId,
      'patient.userId': userId,
      paymentStatus: 'paid'
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Paid payment not found'
      });
    }

    const appointment = await Appointment.findById(appointmentId);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payment_receipt_${payment.paymentId}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('HEALTH APP', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Your Trusted Healthcare Partner', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown();

    // Line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Receipt details
    const startY = doc.y;
    
    doc.font('Helvetica-Bold');
    doc.text(`Receipt No:`, 50, startY);
    doc.text(`Date:`, 50, startY + 20);
    doc.text(`Payment ID:`, 50, startY + 40);
    doc.text(`Order ID:`, 50, startY + 60);
    
    doc.font('Helvetica');
    doc.text(`${payment.paymentId}`, 200, startY);
    doc.text(`${new Date(payment.paymentDate).toLocaleDateString()}`, 200, startY + 20);
    doc.text(`${payment.paymentId}`, 200, startY + 40);
    doc.text(`${payment.orderId}`, 200, startY + 60);

    doc.moveDown(5);

    // Appointment Details
    doc.font('Helvetica-Bold').fontSize(14).text('Appointment Details', 50, doc.y);
    doc.moveDown();

    const detailsY = doc.y;
    doc.fontSize(12);
    
    doc.font('Helvetica-Bold');
    doc.text(`Patient Name:`, 50, detailsY);
    doc.text(`Doctor:`, 50, detailsY + 20);
    doc.text(`Specialization:`, 50, detailsY + 40);
    doc.text(`Appointment Date:`, 50, detailsY + 60);
    doc.text(`Appointment Time:`, 50, detailsY + 80);
    
    doc.font('Helvetica');
    doc.text(`${payment.patient.name}`, 200, detailsY);
    doc.text(`Dr. ${payment.doctor.name}`, 200, detailsY + 20);
    doc.text(`${payment.doctor.specialization || 'General'}`, 200, detailsY + 40);
    doc.text(`${new Date(appointment.appointmentDate).toLocaleDateString()}`, 200, detailsY + 60);
    doc.text(`${appointment.appointmentTime.slot}`, 200, detailsY + 80);

    doc.moveDown(7);

    // Payment Breakdown
    doc.font('Helvetica-Bold').fontSize(14).text('Payment Breakdown', 50, doc.y);
    doc.moveDown();

    const paymentY = doc.y;
    doc.fontSize(12);
    
    doc.font('Helvetica-Bold');
    doc.text(`Consultation Fee:`, 50, paymentY);
    doc.text(`Convenience Fee (2%):`, 50, paymentY + 20);
    doc.text(`Total Amount:`, 50, paymentY + 40);
    
    doc.font('Helvetica');
    doc.text(`₹ ${payment.amount}`, 200, paymentY);
    doc.text(`₹ ${payment.convenienceFee}`, 200, paymentY + 20);
    
    doc.font('Helvetica-Bold');
    doc.text(`₹ ${payment.totalAmount}`, 200, paymentY + 40);

    doc.moveDown(4);

    // Payment Status
    const statusY = doc.y;
    doc.text(`Payment Status:`, 50, statusY);
    doc.font('Helvetica-Bold').fillColor('green');
    doc.text(`PAID`, 200, statusY);
    
    doc.fillColor('black');
    doc.font('Helvetica');
    doc.text(`Payment Method:`, 50, statusY + 20);
    doc.text(`${payment.paymentMethod?.toUpperCase() || 'UPI'}`, 200, statusY + 20);
    
    if (payment.transactionDetails?.transactionId) {
      doc.text(`Transaction ID:`, 50, statusY + 40);
      doc.text(`${payment.transactionDetails.transactionId}`, 200, statusY + 40);
    }

    doc.moveDown(4);

    // Footer
    doc.moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).stroke();
    doc.moveDown(2);

    doc.fontSize(10).font('Helvetica-Oblique').text(
      'This is a computer generated receipt. No signature required.',
      50, doc.y + 20,
      { align: 'center', width: 500 }
    );

    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
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
        orderId: p.orderId,
        amount: p.totalAmount,
        paymentStatus: p.paymentStatus,
        doctorName: p.doctor.name,
        paymentDate: p.paymentDate,
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

module.exports = {
  createPaymentOrder,
  getPaymentStatus,
  verifyPayment,
  paymentWebhook,
  generatePaymentSlip,
  getMyPayments
};