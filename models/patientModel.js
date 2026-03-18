// models/patientModel.js
const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']
  },
  height: {
    type: Number, // in cm
  },
  weight: {
    type: Number, // in kg
  },
  // Medical Information
  diseases: [{
    name: String,
    diagnosedDate: Date,
    status: {
      type: String,
      enum: ['ongoing', 'recovered', 'managed'],
      default: 'ongoing'
    }
  }],
  currentMedications: [{
    name: String,
    dosage: String,
    frequency: String,
    prescribedBy: String
  }],
  allergies: [{
    type: String
  }],
  chronicConditions: [{
    type: String
  }],
  // Vital Stats
  bloodPressure: {
    systolic: Number,
    diastolic: Number,
    lastChecked: Date
  },
  sugarLevel: {
    fasting: Number,
    postPrandial: Number,
    lastChecked: Date
  },
  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
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

patientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Patient', patientSchema);