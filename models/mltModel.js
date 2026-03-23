// models/mltModel.js
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const mltSchema = new mongoose.Schema({
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
    required: true,
    enum: ['Hematology', 'Microbiology', 'Biochemistry', 'Pathology', 'Radiology', 'Other']
  },
  qualifications: {
    type: String,
    required: true
  },
  experience: {
    type: String,
    required: true
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true
  },
  department: {
    type: String,
    required: true,
    enum: ['Clinical Lab', 'Pathology', 'Radiology', 'Blood Bank', 'Microbiology']
  },
  bio: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'active'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auth',
    required: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Hash password before saving
mltSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  try {
    console.log('🔐 Hashing password for MLT:', this.email);
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    console.log('✅ Password hashed successfully for MLT');
  } catch (error) {
    console.error('❌ Error hashing MLT password:', error);
    throw error;
  }
});

// Method to compare password
mltSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcryptjs.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model('MLT', mltSchema);