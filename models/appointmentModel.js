const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
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

// ✅ NO pre-save middleware - we'll handle updates in the controller
// This avoids the "next is not a function" error completely

// Indexes for faster queries
appointmentSchema.index({ patientId: 1, appointment_status: 1 });
appointmentSchema.index({ patient_email: 1, appointment_status: 1 });
appointmentSchema.index({ doctor_email: 1, appointment_status: 1 });
appointmentSchema.index({ appointment_date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);