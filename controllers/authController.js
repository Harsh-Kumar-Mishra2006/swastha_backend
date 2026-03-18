const auth = require('../models/authModel');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const Doctor = require('../models/doctorModel.js');

const checkDoctorAuthorization = async (req, res) => {
  try {
    console.log('🔵 [1] /check-doctor endpoint called');
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No token provided"
      });
    }

    const decoded = jwt.verify(token, 'mypassword');
    
    const user = await auth.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found"
      });
    }

    if (user.role !== 'doctor') {
      return res.json({
        success: true,
        isAuthorized: false,
        message: 'User is not a doctor'
      });
    }

    // Find doctor in Doctor collection (without password)
    const doctor = await Doctor.findOne({ 
      email: user.email
    }).select('-password');

    if (!doctor) {
      return res.json({
        success: true,
        isAuthorized: false,
        message: 'Doctor profile not found'
      });
    }

    if (doctor.status !== 'active') {
      return res.json({
        success: true,
        isAuthorized: false,
        message: `Doctor account is ${doctor.status}`
      });
    }

    res.json({
      success: true,
      isAuthorized: true,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        qualifications: doctor.qualifications,
        experience: doctor.experience,
        consultationFee: doctor.consultationFee,
        availableDays: doctor.availableDays,
        availableTime: doctor.availableTime,
        status: doctor.status
      }
    });

  } catch (error) {
    console.error('❌ [ERROR] Doctor auth check error:', error.message);
    res.status(500).json({
      success: false,
      error: "Error checking doctor authorization: " + error.message
    });
  }
};

// Update signup controller to save profile data
const signup = async (req, res) => {
  let { name, email, username, phone, password, role = 'patient', profile = {} } = req.body;

  // Extract additional profile fields
  const { age, gender, dob } = req.body;

  if (!name || !email || !password || !username || !phone) {
    return res.status(400).json({ 
      success: false,
      error: 'Name, email, username, phone number and password are required' 
    });
  }

  // Validate role
  const validRoles = ['patient', 'doctor', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid role. Must be patient, doctor, or admin'
    });
  }

  try {
    // Check if user already exists
    const existingUser = await auth.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Email or username already registered' 
      });
    }

    // Hash password and create user
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(password, salt);
    
    // Prepare profile data for patients
    const patientProfile = role === 'patient' ? {
      ...profile,
      age: age || '',
      gender: gender || '',
      dob: dob || ''
    } : profile;

    // In signup function, add this after validation but before creating user
if (role === 'doctor') {
  // Check if doctor was added by admin
  const doctorRecord = await Doctor.findOne({ email });
  
  if (!doctorRecord) {
    return res.status(403).json({
      success: false,
      error: 'You cannot register as a doctor. Please contact admin to add you first.'
    });
  }
  
  // If doctor record exists but is not active
  if (doctorRecord.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'Your doctor account is pending approval. Please contact admin.'
    });
  }
}
    
    const createuser = await auth.create({ 
      name,
      email, 
      username, 
      phone,
      password: hash,
      role,
      profile: patientProfile
    });

    res.status(201).json({
      success: true,
      data: {
        id: createuser._id,
        name: createuser.name,
        email: createuser.email,
        username: createuser.username,
        phone: createuser.phone,
        role: createuser.role,
        profile: createuser.profile
      },
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully,`
    });

  } catch (err) {
    console.log("Error occurred: ", err);
    res.status(400).json({
      success: false,
      error: "Failed to create profile: " + err.message
    });
  }
};

// controllers/authController.js - Updated login for doctor
const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if ((!email && !username) || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email/username and password are required'
      });
    }

    // Find user in Auth collection
    let user = await auth.findOne({
      $or: [
        { email: email || '' },
        { username: username || '' }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email/username or password'
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact admin.'
      });
    }

    // For doctors: Verify password against Doctor collection
    if (user.role === 'doctor') {
      const doctor = await Doctor.findOne({ email: user.email });
      
      if (!doctor) {
        return res.status(403).json({
          success: false,
          error: 'Doctor profile not found. Please contact admin.'
        });
      }

      // Check doctor status
      if (doctor.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: `Your account is ${doctor.status}. Please contact admin.`
        });
      }

      // Compare password with doctor's password
      const isPasswordValid = await doctor.comparePassword(password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      // If password is valid but Auth password might be out of sync, update it
      const isAuthPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isAuthPasswordValid) {
        // Sync passwords
        const salt = await bcryptjs.genSalt(10);
        const hash = await bcryptjs.hash(password, salt);
        user.password = hash;
        await user.save();
      }
    } else {
      // For non-doctors, use Auth password
      const isMatch = await bcryptjs.compare(password, user.password);
      
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email/username or password'
        });
      }
    }

    // Generate token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        username: user.username,
        role: user.role,
        name: user.name
      }, 
      'mypassword', 
      { expiresIn: '30d' }
    );

    // Set cookie
    res.cookie('token', token, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Get doctor info if applicable
    let doctorInfo = null;
    if (user.role === 'doctor') {
      doctorInfo = await Doctor.findOne({ email: user.email }).select('-password');
    }

    res.json({
      success: true,
      data: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
        isVerified: user.isVerified,
        doctorProfile: doctorInfo
      },
      message: `Welcome back, ${user.name}!`,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const getProfile = async (req, res) => {
  try {
    console.log('GET PROFILE');
    console.log('Headers:', req.headers);
    
    // Try multiple ways to get token
    let token = req.header('Authorization') || req.headers.authorization;
    
    if (token) {
      token = token.replace('Bearer ', '');
      console.log('Token from Authorization header:', token.substring(0, 50) + '...');
    } else {
      token = req.cookies?.token;
      console.log('Token from cookie:', token ? 'Yes' : 'No');
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    
    console.log('Token length:', token.length);
    
    // Clean token - remove quotes and whitespace
    token = token.trim().replace(/^["']|["']$/g, '');
    console.log('Cleaned token (first 50):', token.substring(0, 50) + '...');
    
    try {
      // Try to verify
      const decoded = jwt.verify(token, 'mypassword');
      console.log('✅ Token verified for user:', decoded.userId);
      
      const user = await auth.findById(decoded.userId).select('-password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      console.log('✅ User found:', user.email);
      
      return res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          username: user.username,
          phone: user.phone,
          role: user.role,
          profile: user.profile,
          isVerified: user.isVerified
        }
      });
      
    } catch (jwtError) {
      console.log('❌ JWT Error:', jwtError.message);
      
      // Try to decode without verification to see what's wrong
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          console.log('JWT payload (without verification):', payload);
          
          // Maybe the token is expired or has wrong signature
          return res.status(401).json({
            success: false,
            error: `Token error: ${jwtError.message}`,
            decodedPayload: payload
          });
        } else {
          console.log('Token is not a JWT format');
          return res.status(401).json({
            success: false,
            error: 'Token is not a valid JWT format'
          });
        }
      } catch (decodeError) {
        console.log('Cannot decode token at all:', decodeError.message);
        return res.status(401).json({
          success: false,
          error: `Invalid token: ${decodeError.message}`
        });
      }
    }
    
  } catch (err) {
    console.log('Server error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// In authController.js - debugToken function
const debugToken = async (req, res) => {
  try {
    console.log('=== DEBUG TOKEN ENDPOINT HIT ===');
    
    let token = req.header('Authorization') || req.headers.authorization;
    
    if (token) {
      token = token.replace('Bearer ', '');
    } else {
      token = req.cookies?.token;
    }
    
    if (!token) {
      return res.json({
        success: false,
        error: 'No token provided',
        message: 'Please send token in Authorization header'
      });
    }
    
    // Clean token
    token = token.trim().replace(/^["']|["']$/g, '');
    
    const result = {
      success: true,
      tokenInfo: {
        length: token.length,
        first50Chars: token.substring(0, 50),
        last50Chars: token.substring(token.length - 50),
        isJWTFormat: token.split('.').length === 3
      }
    };
    
    // Try to decode
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        result.tokenInfo.decoded = {
          header,
          payload
        };
        
        // Try to verify
        try {
          const verified = jwt.verify(token, 'mypassword');
          result.tokenInfo.verified = true;
          result.tokenInfo.verificationResult = verified;
        } catch (verifyError) {
          result.tokenInfo.verified = false;
          result.tokenInfo.verificationError = verifyError.message;
        }
        
      } catch (decodeError) {
        result.tokenInfo.decodeError = decodeError.message;
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update updateProfile controller
const updateProfile = async (req, res) => {
  try {
    const { name, profile, age, gender, dob, phone } = req.body;
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const user = await auth.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update basic fields
    if (name) user.name = name;
    if (phone) user.phone = phone;

    // Update profile fields (especially for students)
    const updatedProfile = { ...user.profile };
    
    if (profile) {
      Object.assign(updatedProfile, profile);
    }
    
    // Update specific student profile fields
    if (user.role === 'student') {
      if (age !== undefined) updatedProfile.age = age;
      if (gender) updatedProfile.gender = gender;
      if (dob) updatedProfile.dob = dob;
    }

    user.profile = updatedProfile;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role,
        profile: user.profile
      }
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};


// Logout controller
const logout = async (req, res) => {
  try {
    res.cookie('token', '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
    
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Error during logout"
    });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getProfile,
  debugToken,
  updateProfile,
  checkDoctorAuthorization
};