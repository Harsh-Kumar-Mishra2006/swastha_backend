const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true,
    required: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  patient: {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auth',
      required: true
    },
    name: String,
    email: String,
    phone: String
  },
  doctor: {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    name: String,
    specialization: String
  },
  amount: {
    type: Number,
    required: true
  },
  consultationFee: Number,
  convenienceFee: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'wallet'],
    default: 'upi'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    enum: ['created', 'pending', 'success', 'failure'],
    default: 'created'
  },
  // Cashfree specific fields
  cashfree: {
    orderId: String,
    orderToken: String,
    paymentLink: String,
    paymentSessionId: String,
    qrCode: String,
    upiIntent: String
  },
  transactionDetails: {
    transactionId: String,
    bankReference: String,
    paymentTime: Date,
    paymentMode: String,
    upiId: String
  },
  // For refunds
  refund: {
    status: {
      type: String,
      enum: ['none', 'initiated', 'processed', 'failed']
    },
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique payment ID and order ID
paymentSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  if (!this.paymentId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.paymentId = `PAY${year}${month}${day}${random}`;
  }
  
  if (!this.orderId) {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderId = `ORDER_${timestamp}${random}`;
  }
  
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);