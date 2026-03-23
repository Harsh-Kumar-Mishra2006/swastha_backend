// controllers/adminController.js
const Auth = require('../models/authModel');
const Doctor = require('../models/doctorModel');
const bcryptjs = require('bcryptjs');
const MLT = require('../models/mltModel');

// Admin adds a new doctor (creates both Auth and Doctor records)
const addDoctor = async (req, res) => {
  try {
    const { 
      name, email, phone, username, password, // password from form
      specialization, qualifications, experience, bio,
      consultationFee, availableDays, availableTime 
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !username || !password || 
        !specialization || !qualifications || !experience) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided'
      });
    }

    // Check if user already exists
    const existingUser = await Auth.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email or username already registered'
      });
    }

    // Hash password for Auth
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(password, salt);

    // Create auth user for doctor
    const newDoctor = await Auth.create({
      name,
      email,
      username,
      phone,
      password: hash,
      role: 'doctor',
      isVerified: true,
      profile: {
        specialization,
        qualifications,
        experience,
        bio
      }
    });

    // Create doctor profile in Doctor collection (password will be hashed by pre-save hook)
    const doctorProfile = await Doctor.create({
      name,
      email,
      phone,
      password, // This will be hashed automatically by the pre-save hook
      specialization,
      qualifications,
      experience,
      bio,
      consultationFee: consultationFee || 0,
      availableDays: availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: availableTime || { start: '09:00', end: '17:00' },
      status: 'active',
      addedBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      message: 'Doctor added successfully. They can now login with the provided password.',
      data: {
        auth: {
          id: newDoctor._id,
          name: newDoctor.name,
          email: newDoctor.email,
          username: newDoctor.username
        },
        profile: {
          id: doctorProfile._id,
          name: doctorProfile.name,
          email: doctorProfile.email,
          specialization: doctorProfile.specialization
        }
      }
    });

  } catch (error) {
    console.error('Error adding doctor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add doctor: ' + error.message
    });
  }
};

// Get all doctors (without passwords)
const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .populate('addedBy', 'name email')
      .select('-password') // Exclude password from results
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get single doctor by ID (without password)
const getDoctorById = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    const doctor = await Doctor.findById(doctorId)
      .populate('addedBy', 'name email')
      .select('-password');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update doctor status
const updateDoctorStatus = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { status },
      { new: true }
    ).select('-password');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Also update Auth isActive based on status
    await Auth.findOneAndUpdate(
      { email: doctor.email },
      { isActive: status === 'active' }
    );

    res.json({
      success: true,
      message: 'Doctor status updated',
      data: doctor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Reset doctor password
// controllers/adminController.js - Fixed resetDoctorPassword
const resetDoctorPassword = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Find doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Hash new password for Auth
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(newPassword, salt);

    // Update doctor password (pre-save hook will hash it)
    doctor.password = newPassword; // This will trigger the pre-save hook
    await doctor.save();

    // Update auth user password
    await Auth.findOneAndUpdate(
      { email: doctor.email },
      { password: hash }
    );

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
// Delete doctor
const deleteDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { permanent } = req.query;

    const doctor = await Doctor.findById(doctorId);
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    if (permanent === 'true') {
      // Hard delete
      await Auth.findOneAndDelete({ email: doctor.email });
      await Doctor.findByIdAndDelete(doctorId);
      
      res.json({
        success: true,
        message: 'Doctor permanently deleted'
      });
    } else {
      // Soft delete
      doctor.status = 'inactive';
      await doctor.save();
      
      await Auth.findOneAndUpdate(
        { email: doctor.email },
        { isActive: false }
      );
      
      res.json({
        success: true,
        message: 'Doctor deactivated successfully'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get pending doctors
const getPendingDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ status: 'pending' })
      .populate('addedBy', 'name email')
      .select('-password');

    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get doctor statistics
const getDoctorStats = async (req, res) => {
  try {
    const totalDoctors = await Doctor.countDocuments();
    const activeDoctors = await Doctor.countDocuments({ status: 'active' });
    const pendingDoctors = await Doctor.countDocuments({ status: 'pending' });
    const inactiveDoctors = await Doctor.countDocuments({ status: 'inactive' });
    
    const doctorsBySpecialization = await Doctor.aggregate([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        total: totalDoctors,
        active: activeDoctors,
        pending: pendingDoctors,
        inactive: inactiveDoctors,
        bySpecialization: doctorsBySpecialization
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// In adminController.js - add this function
const updateDoctorProfile = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const updates = req.body;

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      updates,
      { new: true }
    ).select('-password');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Update Auth profile
    await Auth.findOneAndUpdate(
      { email: doctor.email },
      { 
        name: doctor.name,
        phone: doctor.phone,
        'profile.specialization': doctor.specialization,
        'profile.qualifications': doctor.qualifications,
        'profile.experience': doctor.experience,
        'profile.bio': doctor.bio
      }
    );

    res.json({
      success: true,
      message: 'Doctor updated successfully',
      data: doctor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Add MLT (Medical Laboratory Technician)
const addMLT = async (req, res) => {
  try {
    const { 
      name, email, phone, username, password,
      specialization, qualifications, experience,
      licenseNumber, department, bio
    } = req.body;

    // Validate required fields
    const requiredFields = ['name', 'email', 'phone', 'username', 'password', 
                           'specialization', 'qualifications', 'experience', 
                           'licenseNumber', 'department'];
    
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          error: `${field} is required`
        });
      }
    }

    // Check if user already exists in Auth
    const existingUser = await Auth.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email or username already registered'
      });
    }

    // Check if MLT already exists with same license number
    const existingMLT = await MLT.findOne({ licenseNumber });
    if (existingMLT) {
      return res.status(400).json({
        success: false,
        error: 'License number already registered'
      });
    }

    // Hash password for Auth
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(password, salt);

    // Create auth user for MLT
    const newMLTUser = await Auth.create({
      name,
      email,
      username,
      phone,
      password: hash,
      role: 'MLT',
      isVerified: true,
      profile: {
        specialization,
        qualifications,
        experience,
        bio: bio || '',
        licenseNumber,
        department
      }
    });

    // Create MLT profile
    const mltProfile = await MLT.create({
      name,
      email,
      phone,
      password, // Will be hashed by pre-save hook
      specialization,
      qualifications,
      experience,
      licenseNumber,
      department,
      bio: bio || '',
      status: 'active',
      addedBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      message: 'MLT added successfully. They can now login with the provided password.',
      data: {
        auth: {
          id: newMLTUser._id,
          name: newMLTUser.name,
          email: newMLTUser.email,
          username: newMLTUser.username,
          role: newMLTUser.role
        },
        profile: {
          id: mltProfile._id,
          name: mltProfile.name,
          email: mltProfile.email,
          specialization: mltProfile.specialization,
          licenseNumber: mltProfile.licenseNumber,
          department: mltProfile.department
        }
      }
    });

  } catch (error) {
    console.error('Error adding MLT:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add MLT: ' + error.message
    });
  }
};

// Get all MLTs
const getAllMLTs = async (req, res) => {
  try {
    const mlts = await MLT.find()
      .populate('addedBy', 'name email')
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: mlts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get single MLT by ID
const getMLTById = async (req, res) => {
  try {
    const { mltId } = req.params;
    
    const mlt = await MLT.findById(mltId)
      .populate('addedBy', 'name email')
      .select('-password');
    
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    res.json({
      success: true,
      data: mlt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update MLT status
const updateMLTStatus = async (req, res) => {
  try {
    const { mltId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const mlt = await MLT.findByIdAndUpdate(
      mltId,
      { status },
      { new: true }
    ).select('-password');

    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    // Update Auth isActive based on status
    await Auth.findOneAndUpdate(
      { email: mlt.email },
      { isActive: status === 'active' }
    );

    res.json({
      success: true,
      message: 'MLT status updated successfully',
      data: mlt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update MLT profile
const updateMLTProfile = async (req, res) => {
  try {
    const { mltId } = req.params;
    const updates = req.body;

    const mlt = await MLT.findByIdAndUpdate(
      mltId,
      updates,
      { new: true }
    ).select('-password');

    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    // Update Auth profile
    await Auth.findOneAndUpdate(
      { email: mlt.email },
      { 
        name: mlt.name,
        phone: mlt.phone,
        'profile.specialization': mlt.specialization,
        'profile.qualifications': mlt.qualifications,
        'profile.experience': mlt.experience,
        'profile.bio': mlt.bio,
        'profile.licenseNumber': mlt.licenseNumber,
        'profile.department': mlt.department
      }
    );

    res.json({
      success: true,
      message: 'MLT profile updated successfully',
      data: mlt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete MLT
const deleteMLT = async (req, res) => {
  try {
    const { mltId } = req.params;
    const { permanent } = req.query;

    const mlt = await MLT.findById(mltId);
    
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    if (permanent === 'true') {
      // Hard delete
      await Auth.findOneAndDelete({ email: mlt.email });
      await MLT.findByIdAndDelete(mltId);
      
      res.json({
        success: true,
        message: 'MLT permanently deleted'
      });
    } else {
      // Soft delete
      mlt.status = 'inactive';
      await mlt.save();
      
      await Auth.findOneAndUpdate(
        { email: mlt.email },
        { isActive: false }
      );
      
      res.json({
        success: true,
        message: 'MLT deactivated successfully'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Reset MLT password
const resetMLTPassword = async (req, res) => {
  try {
    const { mltId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Find MLT
    const mlt = await MLT.findById(mltId);
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    // Hash new password for Auth
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(newPassword, salt);

    // Update MLT password (pre-save hook will hash it)
    mlt.password = newPassword;
    await mlt.save();

    // Update auth user password
    await Auth.findOneAndUpdate(
      { email: mlt.email },
      { password: hash }
    );

    res.json({
      success: true,
      message: 'MLT password reset successfully'
    });
  } catch (error) {
    console.error('Error resetting MLT password:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get MLT statistics
const getMLTStats = async (req, res) => {
  try {
    const totalMLTs = await MLT.countDocuments();
    const activeMLTs = await MLT.countDocuments({ status: 'active' });
    const pendingMLTs = await MLT.countDocuments({ status: 'pending' });
    const inactiveMLTs = await MLT.countDocuments({ status: 'inactive' });
    
    const mltsBySpecialization = await MLT.aggregate([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const mltsByDepartment = await MLT.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        total: totalMLTs,
        active: activeMLTs,
        pending: pendingMLTs,
        inactive: inactiveMLTs,
        bySpecialization: mltsBySpecialization,
        byDepartment: mltsByDepartment
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  addDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctorStatus,
  getPendingDoctors,
  getDoctorStats,
  deleteDoctor,
  resetDoctorPassword,
  updateDoctorProfile,
  addMLT,
  getAllMLTs,
  getMLTById,
  updateMLTStatus,
  updateMLTProfile,
  deleteMLT,
  resetMLTPassword,
  getMLTStats
};