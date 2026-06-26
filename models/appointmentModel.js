const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // ✅ Add appointmentId field with proper indexing
  appointmentId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
    default: null
  },
  
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true,
    index: true
  },
  
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    default: null
  },
  
  patient_email: {
    type: String,
    required: true,
    index: true
  },
  
  patient_name: {
    type: String,
    required: true
  },
  
  patient_phone: {
    type: String,
    required: true
  },
  
  doctor_email: {
    type: String,
    required: true,
    index: true
  },
  
  doctor_name: {
    type: String,
    required: true
  },
  
  doctor_specialization: {
    type: String,
    required: true
  },
  
  appointment_date: {
    type: Date,
    required: true
  },
  
  appointment_time: {
    type: String,
    required: true
  },
  
  symptoms: {
    type: String,
    default: ''
  },
  
  notes: {
    type: String,
    default: ''
  },
  
  amount: {
    type: Number,
    required: true,
    default: 500
  },
  
  screenshot_url: {
    type: String,
    required: true
  },
  
  screenshot_public_id: {
    type: String
  },
  
  payment_status: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },
  
  appointment_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  
  doctor_notes: {
    type: String,
    default: ''
  },
  
  rejection_reason: {
    type: String,
    default: ''
  },
  
  approval_date: {
    type: Date
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

// ✅ FIXED: Pre-save middleware with next parameter
appointmentSchema.pre('save', function(next) {
  console.log('📝 Pre-save middleware triggered');
  
  // Generate appointmentId if not provided
  if (!this.appointmentId) {
    const prefix = 'APP';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.appointmentId = `${prefix}-${timestamp}-${random}`;
    console.log('✅ Generated appointmentId:', this.appointmentId);
  }
  
  // Update timestamp
  this.updatedAt = new Date();
  
  // ✅ MUST call next() to continue
  next();
});

// Indexes for faster queries
appointmentSchema.index({ patientId: 1, appointment_status: 1 });
appointmentSchema.index({ patient_email: 1, appointment_status: 1 });
appointmentSchema.index({ doctor_email: 1, appointment_status: 1 });
appointmentSchema.index({ appointmentId: 1 }); // Index for appointmentId

module.exports = mongoose.model('Appointment', appointmentSchema);