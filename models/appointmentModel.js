// models/appointmentModel.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentId: {
    type: String,
    unique: true,
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
    phone: String,
    age: Number,
    gender: String
  },
  doctor: {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true
    },
    name: String,
    specialization: String,
    consultationFee: Number
  },
  appointmentType: {
    type: String,
    enum: ['visit', 'online'],
    required: true
  },
  bookingType: {
    type: String,
    enum: ['direct', 'paid'],
    default: 'direct'
  },
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    slot: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      default: 30
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'expired'],
    default: 'pending'
  },
  // ADD THIS - expiresAt field for pending appointments
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from creation
    }
  },
  reasonForVisit: {
    type: String,
    required: true
  },
  symptoms: [{
    type: String
  }],
  diseaseDetails: {
    primaryDisease: String,
    duration: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    }
  },
  reports: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  payment: {
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending'
    },
    method: String,
    transactionId: String,
    paidAt: Date
  },
  additionalNotes: String,
  isFirstVisit: {
    type: Boolean,
    default: true
  },
  followUpFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
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

// Generate unique appointment ID
appointmentSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  if (!this.appointmentId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.appointmentId = `APT${year}${month}${day}${random}`;
  }
  
  // Set expiresAt for pending appointments if not set
  if (this.status === 'pending' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  }
  
  next();
});

// Create TTL index to automatically expire pending appointments
appointmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Appointment', appointmentSchema);