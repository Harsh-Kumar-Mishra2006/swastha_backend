const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true,
    required: true
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
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'rejected'],
    default: 'pending'
  },
  // QR Code payment specific fields
  qrPayment: {
    upiId: {
      type: String,
      default: 'yourbusiness@upi' // Replace with your actual UPI ID
    },
    upiName: {
      type: String,
      default: 'Your Business Name'
    },
    transactionId: String,
    transactionReference: String,
    paymentTime: Date,
    uploadedScreenshot: {
      fileName: String,
      fileUrl: String,
      uploadedAt: Date
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auth'
    },
    verifiedAt: Date,
    verificationNotes: String
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

// Generate unique payment ID
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
  
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);