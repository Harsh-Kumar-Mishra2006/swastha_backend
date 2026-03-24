const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  username: { 
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
  role: { 
    type: String, 
    enum: ['patient', 'doctor', 'admin', 'MLT'], 
    default: 'patient' 
  },
  profile: {
    age: { 
      type: String, 
      default: '' 
    },
    gender: { 
      type: String, 
      default: '' 
    },
    dob: { 
      type: String, 
      default: '' 
    },
    address: { 
      type: String, 
      default: '' 
    },
    // Doctor-specific fields
    bio: { 
      type: String, 
      default: '' 
    },
    specialization: {
      type: String,
      default: ''
    },
    qualifications: {
      type: String,
      default: ''
    },
    experience: {
      type: String,
      default: ''
    },
    // Patient-specific fields
    diseases: [{
      name: { type: String },
      diagnosedDate: { type: Date },
      status: { 
        type: String,
        enum: ['ongoing', 'recovered', 'managed'],
        default: 'ongoing'
      },
      notes: { type: String }
    }],
    currentMedications: [{
      name: { type: String },
      dosage: { type: String },
      frequency: { type: String },
      prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' }
    }],
    allergies: [{
      type: String
    }],
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
      default: ''
    },
    pulseRate: {
      type: String,
      default: '80 bpm'
    },
    emergencyContact: {
      name: { type: String, default: '' },
      relationship: { type: String, default: '' },
      phone: { type: String, default: '' }
    }
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Virtual to get relevant data based on role
authSchema.virtual('roleSpecificData').get(function() {
  if (this.role === 'doctor') {
    return {
      bio: this.profile.bio,
      specialization: this.profile.specialization,
      qualifications: this.profile.qualifications,
      experience: this.profile.experience
    };
  } else if (this.role === 'patient') {
    return {
      diseases: this.profile.diseases,
      currentMedications: this.profile.currentMedications,
      allergies: this.profile.allergies,
      bloodGroup: this.profile.bloodGroup,
      pulseRate: this.profile.pulseRate,
      emergencyContact: this.profile.emergencyContact
    };
  }
   else if (this.role === 'MLT') {
    return {
      specialization: this.profile.specialization,
      qualifications: this.profile.qualifications,
      experience: this.profile.experience,
      licenseNumber: this.profile.licenseNumber,
      department: this.profile.department,
      bio: this.profile.bio
    };
   }
  return {};
});

// Method to update role-specific data
authSchema.methods.updateRoleSpecificData = function(data) {
  if (this.role === 'doctor') {
    this.profile.bio = data.bio || this.profile.bio;
    this.profile.specialization = data.specialization || this.profile.specialization;
    this.profile.qualifications = data.qualifications || this.profile.qualifications;
    this.profile.experience = data.experience || this.profile.experience;
  } else if (this.role === 'patient') {
    if (data.diseases) this.profile.diseases = data.diseases;
    if (data.currentMedications) this.profile.currentMedications = data.currentMedications;
    if (data.allergies) this.profile.allergies = data.allergies;
    if (data.bloodGroup) this.profile.bloodGroup = data.bloodGroup;
    if (data.emergencyContact) this.profile.emergencyContact = data.emergencyContact;
  }
  return this;
};

module.exports = mongoose.model('Auth', authSchema);