// models/doctorModel.js - Async/Await Version
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const doctorSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  phone: { 
    type: String, 
    required: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  specialization: {
    type: String,
    required: true
  },
  qualifications: {
    type: String,
    required: true
  },
  experience: {
    type: String,
    required: true
  },
  bio: {
    type: String,
    default: ''
  },
  consultationFee: {
    type: Number,
    default: 0
  },
  availableDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  availableTime: {
    start: { type: String, default: '09:00' },
    end: { type: String, default: '17:00' }
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'active'
  },
  authId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

// ✅ FIXED: Hash password before saving - Async/Await version
doctorSchema.pre('save', async function(next) {
  try {
    // Only hash if password is modified
    if (!this.isModified('password')) {
      return ;
    }
    
    console.log('🔐 Hashing password for doctor:', this.email);
    
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(this.password, salt);
    
    this.password = hashedPassword;
    console.log('✅ Password hashed successfully');
    
  } catch (error) {
    console.error('❌ Error hashing password:', error);
    throw error;
  }
});

// Method to compare password
doctorSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcryptjs.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model('Doctor', doctorSchema);