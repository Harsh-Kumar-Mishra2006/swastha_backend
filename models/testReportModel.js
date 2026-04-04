// models/testReportModel.js
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  testName: {
    type: String,
    required: true
  },
  testDescription: String,
  referenceRange: String,
  unit: String,
  result: {
    type: String,
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'reviewed'],
    default: 'pending'
  }
});

const testReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    unique: true
  },
  
  // Patient Info (flexible - works for both online and offline)
  patient: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: String,
    age: Number,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'not_specified'],
      default: 'not_specified'
    },
    // Optional: if patient is registered in system
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    }
  },
  
  // Doctor Info (who created the report)
  doctor: {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: String,
    specialization: String
  },
  
  // MLT Info (who will process)
  mlt: {
    mltId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MLT'
    },
    name: String,
    email: String,
    assignedAt: Date,
    acceptedAt: Date
  },
  
  // Medical Details
  condition: {
    type: String,
    required: true
  },
  disease: {
    type: String,
    required: true
  },
  reportDescription: {
    type: String,
    required: true
  },
  doctorNotes: String,
  additionalNotes: String,
  
  // Tests
  tests: [testSchema],
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

// Generate unique report ID
testReportSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  if (!this.reportId) {
    const date = new Date();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.reportId = `REP${Date.now().toString().slice(-8)}${random}`;
  }
  
  next();
});

module.exports = mongoose.model('TestReport', testReportSchema);