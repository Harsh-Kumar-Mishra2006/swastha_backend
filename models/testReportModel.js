const mongoose = require('mongoose');

const testReportSchema = new mongoose.Schema({
  // Doctor who requested the test
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true,
    index: true
  },
  doctor_name: {
    type: String,
    required: true
  },
  doctor_email: {
    type: String,
    required: true
  },
  doctor_specialization: {
    type: String,
    required: true
  },

  // MLT assigned to conduct the test
  mltId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MLT',
    required: false,
    index: true
  },
  mlt_name: {
    type: String,
    required: true
  },
  mlt_email: {
    type: String,
    required: true
  },
  mlt_specialization: {
    type: String,
    required: true
  },

  // Patient details
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: false,
    index: true
  },
  patient_name: {
    type: String,
    required: true
  },
  patient_email: {
    type: String,
    required: true
  },
  patient_phone: {
    type: String,
    required: true
  },
  patient_age: {
    type: String,
    default: ''
  },
  patient_gender: {
    type: String,
    default: ''
  },
  patient_bloodGroup: {
    type: String,
    default: ''
  },

  // Appointment reference (optional)
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  // Test details
  test_name: {
    type: String,
    required: true
  },
  test_category: {
    type: String,
    enum: ['Hematology', 'Microbiology', 'Biochemistry', 'Pathology', 'Radiology', 'Immunology', 'Other'],
    required: true
  },
  test_description: {
    type: String,
    default: ''
  },
  test_priority: {
    type: String,
    enum: ['routine', 'urgent', 'emergency'],
    default: 'routine'
  },
  test_instructions: {
    type: String,
    default: ''
  },

  // Disease/Symptoms details
  suspected_disease: {
    type: String,
    default: ''
  },
  symptoms: {
    type: String,
    default: ''
  },
  clinical_notes: {
    type: String,
    default: ''
  },
  medical_history: {
    type: String,
    default: ''
  },

  // Prescribed medications (if any)
  medications: [{
    name: { type: String },
    dosage: { type: String },
    frequency: { type: String },
    duration: { type: String }
  }],

  // Test status
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },

  // MLT's response/work
  test_results: {
    type: String,
    default: ''
  },
  test_report_url: {
    type: String,
    default: ''
  },
  test_report_public_id: {
    type: String,
    default: ''
  },
  mlt_notes: {
    type: String,
    default: ''
  },

  // Results summary
  results_summary: {
    type: String,
    default: ''
  },
  test_conclusion: {
    type: String,
    default: ''
  },
  recommendations: {
    type: String,
    default: ''
  },

  // Timestamps
  assigned_date: {
    type: Date,
    default: Date.now
  },
  completed_date: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

  test_parameters: [{
    name: { type: String },
    value: { type: String },
    unit: { type: String },
    normal_range: { type: String },
    is_abnormal: { type: Boolean, default: false }
  }],
  normal_ranges: [{
    parameter: { type: String },
    range: { type: String },
    description: { type: String }
  }],
  interpretation: {
    type: String,
    default: ''
  },
  clinical_impression: {
    type: String,
    default: ''
  },
  follow_up_instructions: {
    type: String,
    default: ''
  },
  report_visibility: {
    type: String,
    enum: ['doctor', 'patient', 'both'],
    default: 'both'
  },
  report_version: {
    type: Number,
    default: 1
  },
  previous_versions: [{
    test_results: String,
    results_summary: String,
    test_conclusion: String,
    recommendations: String,
    test_parameters: [{
      name: String,
      value: String,
      unit: String,
      normal_range: String
    }],
    updatedAt: Date,
    updatedBy: String
  }]
});

// ✅ NO pre-save middleware - to avoid errors

// Indexes for faster queries
testReportSchema.index({ doctorId: 1, status: 1 });
testReportSchema.index({ mltId: 1, status: 1 });
testReportSchema.index({ patientId: 1, status: 1 });
testReportSchema.index({ test_category: 1 });
testReportSchema.index({ status: 1 });
// Add indexes for new fields
testReportSchema.index({ patientId: 1, status: 1, completed_date: -1 });
testReportSchema.index({ doctorId: 1, status: 1, completed_date: -1 });
testReportSchema.index({ mltId: 1, status: 1 });

module.exports = mongoose.model('TestReport', testReportSchema);