// models/prescriptionModel.js
const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  // ✅ Appointment Reference (Important)
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    sparse: true,
    required: true,
    index: true
  },
  
  // ✅ Patient Details (Denormalized for quick access)
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true,
    index: true
  },
  patient_name: {
    type: String,
    required: true
  },
  patient_email: {
    type: String,
    required: true,
    index: true
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
    enum: ['Male', 'Female', 'Other', ''],
    default: ''
  },
  patient_bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
    default: ''
  },
  
  // ✅ Doctor Details
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
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
  
  // ✅ Diagnosis & Disease
  diagnosis: {
    type: String,
    required: true,
    trim: true
  },
  disease: {
    type: String,
    required: true,
    trim: true
  },
  disease_code: {
    type: String, // ICD-10 code optional
    default: ''
  },
  
  // ✅ Prescription Date
  prescription_date: {
    type: Date,
    required: true,
    default: Date.now
  },
  valid_until: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
  },
  
  // ✅ INSCRIPTION (Medications) - Array format
  medications: [{
    medicine_name: {
      type: String,
      required: true
    },
    strength: {
      type: String,
      required: true,
      default: '' // e.g., "500mg", "10mg/5ml"
    },
    form: {
      type: String,
      enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Other'],
      default: 'Tablet'
    },
    quantity: {
      type: String, // e.g., "10 tablets", "1 bottle"
      required: true
    },
    dosage: {
      type: String,
      required: true // e.g., "1 tablet", "5ml"
    },
    frequency: {
      type: String,
      required: true // e.g., "Twice daily", "Every 6 hours", "Once daily"
    },
    duration: {
      type: String,
      required: true // e.g., "5 days", "7 days", "1 month"
    },
    timing: {
      type: String,
      enum: ['Before meal', 'After meal', 'With meal', 'Empty stomach', 'Any time', ''],
      default: 'Any time'
    },
    special_instructions: {
      type: String,
      default: '' // e.g., "Swallow whole, don't crush"
    },
    is_controlled: {
      type: Boolean,
      default: false
    }
  }],
  
  // ✅ SUBSCRIPTION (Dispensing instructions)
  dispensing_instructions: {
    type: String,
    default: 'Take as directed by the physician'
  },
  refills_allowed: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  refills_remaining: {
    type: Number,
    default: 0
  },
  
  // ✅ SIG (Patient Instructions) - Array format
  patient_instructions: [{
    type: String,
    required: true,
    trim: true
  }],
  // Example: ["Take medication with food", "Avoid alcohol", "Complete full course"]
  
  // ✅ Non-Medication / Vocal Advice - Complete field
  non_medication_advice: {
    type: String,
    default: '',
    trim: true
  },
  // Example: "Drink 2-3 liters of water daily. Get plenty of rest. Use a humidifier at night."
  
  // ✅ Lifestyle & Dietary Advice
  lifestyle_advice: {
    type: String,
    default: ''
  },
  dietary_restrictions: {
    type: String,
    default: ''
  },
  
  // ✅ Follow-up Instructions
  follow_up_required: {
    type: Boolean,
    default: false
  },
  follow_up_date: {
    type: Date
  },
  follow_up_notes: {
    type: String,
    default: ''
  },
  
  // ✅ Warnings & Precautions
  warnings: [{
    type: String,
    default: ''
  }],
  allergies_checked: {
    type: Boolean,
    default: false
  },
  drug_interactions_checked: {
    type: Boolean,
    default: false
  },
  
  // ✅ Prescription Status
  prescription_status: {
    type: String,
    enum: ['draft', 'active', 'dispensed', 'expired', 'cancelled'],
    default: 'active'
  },
  
  // ✅ Digital Signature & Meta
  is_digital_signed: {
    type: Boolean,
    default: false
  },
  digital_signature: {
    type: String,
    default: ''
  },
  doctor_notes: {
    type: String,
    default: ''
  },
  
  // ✅ Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  dispensed_at: {
    type: Date
  },
  cancelled_at: {
    type: Date
  }
}, {
  // ✅ Virtual fields for computed properties
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ Virtual: Get medication count
prescriptionSchema.virtual('medication_count').get(function() {
  return this.medications ? this.medications.length : 0;
});

// ✅ Virtual: Check if prescription is expired
prescriptionSchema.virtual('is_expired').get(function() {
  return this.valid_until && new Date() > this.valid_until;
});

// ✅ Virtual: Get prescription age in days
prescriptionSchema.virtual('age_in_days').get(function() {
  if (!this.createdAt) return 0;
  const diff = Date.now() - this.createdAt.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// ✅ Pre-save middleware to update timestamps
prescriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-populate patient data if not already filled
  if (!this.patient_name && this.patientId) {
    const Auth = require('./authModel');
    Auth.findById(this.patientId).then(patient => {
      if (patient) {
        this.patient_name = patient.name;
        this.patient_email = patient.email;
        this.patient_phone = patient.phone;
        this.patient_age = patient.profile?.age || '';
        this.patient_gender = patient.profile?.gender || '';
        this.patient_bloodGroup = patient.profile?.bloodGroup || '';
      }
    }).catch(err => console.error('Error auto-populating patient data:', err));
  }
  
  next();
});

// ✅ Indexes for faster queries
prescriptionSchema.index({ patient_email: 1, prescription_status: 1 });
prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctor_email: 1, prescription_status: 1 });
prescriptionSchema.index({ appointmentId: 1 }, { unique: true }); // One prescription per appointment
prescriptionSchema.index({ valid_until: 1 }, { expireAfterSeconds: 0 }); // Auto expire

module.exports = mongoose.model('Prescription', prescriptionSchema);