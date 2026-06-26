// controllers/testReportController.js
const TestReport = require('../models/testReportModel');
const Auth = require('../models/authModel');
const Doctor = require('../models/doctorModel');
const MLT = require('../models/mltModel');
const Appointment = require('../models/appointmentModel');
const mongoose = require('mongoose');
// controllers/testReportController.js - Updated createTestRequest
const createTestRequest = async (req, res) => {
  console.log('🚀 CREATE TEST REQUEST - START');
  console.log('📦 Request body:', req.body);

  try {
    const {
      // Doctor info (from authenticated user)
      doctorId,
      doctor_name,
      doctor_email,
      doctor_specialization,
      
      // MLT to assign
      mltId, // Now optional
      mlt_name,
      mlt_email,
      mlt_specialization,
      
      // Patient info
      patientId, // Now optional
      patient_name,
      patient_email,
      patient_phone,
      patient_age,
      patient_gender,
      patient_bloodGroup,
      
      // Appointment reference
      appointmentId,
      
      // Test details
      test_name,
      test_category,
      test_description,
      test_priority,
      test_instructions,
      
      // Clinical details
      suspected_disease,
      symptoms,
      clinical_notes,
      medical_history,
      
      // Medications
      medications
    } = req.body;

    // ✅ VALIDATION - Only require email for patient and MLT
    if (!doctorId || !doctor_email) {
      return res.status(400).json({
        success: false,
        error: 'Doctor information is required'
      });
    }

    // MLT validation - require email but ID is optional
    if (!mlt_email || !mlt_name) {
      return res.status(400).json({
        success: false,
        error: 'MLT email and name are required'
      });
    }

    // Patient validation - require email but ID is optional
    if (!patient_email || !patient_name) {
      return res.status(400).json({
        success: false,
        error: 'Patient email and name are required'
      });
    }

    if (!test_name || !test_category) {
      return res.status(400).json({
        success: false,
        error: 'Test name and category are required'
      });
    }

    // ✅ Check if doctor exists and is active
    const doctor = await Doctor.findOne({ 
      email: doctor_email,
      status: 'active'
    });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found or not active'
      });
    }

    // ✅ Check if MLT exists (if ID is provided, verify it; otherwise verify by email)
    let mlt = null;
    if (mltId) {
      mlt = await MLT.findById(mltId);
    }
    if (!mlt && mlt_email) {
      mlt = await MLT.findOne({ 
        email: mlt_email,
        status: 'active'
      });
    }
    
    // If MLT not found, we'll still create the request but without ID
    // This allows manual entry of MLT details

    // ✅ Check if patient exists (if ID is provided, verify it; otherwise verify by email)
    let patient = null;
    if (patientId) {
      patient = await Auth.findById(patientId);
    }
    if (!patient && patient_email) {
      patient = await Auth.findOne({ email: patient_email });
    }
    
    // If patient not found, we'll still create the request but without ID
    // This allows manual entry of patient details

    // ✅ Check if appointment exists (if provided)
    if (appointmentId) {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: 'Appointment not found'
        });
      }
    }

    // ✅ Create test request
    const testData = {
      doctorId,
      doctor_name,
      doctor_email,
      doctor_specialization,
      mltId: mlt?._id || null, // Use found MLT ID or null
      mlt_name,
      mlt_email,
      mlt_specialization,
      patientId: patient?._id || null, // Use found patient ID or null
      patient_name,
      patient_email,
      patient_phone: patient_phone || '',
      patient_age: patient_age || '',
      patient_gender: patient_gender || '',
      patient_bloodGroup: patient_bloodGroup || '',
      appointmentId: appointmentId || null,
      test_name,
      test_category,
      test_description: test_description || '',
      test_priority: test_priority || 'routine',
      test_instructions: test_instructions || '',
      suspected_disease: suspected_disease || '',
      symptoms: symptoms || '',
      clinical_notes: clinical_notes || '',
      medical_history: medical_history || '',
      medications: medications || [],
      status: 'pending'
    };

    const testReport = new TestReport(testData);
    await testReport.save();

    console.log('✅ Test request created:', testReport._id);

    res.status(201).json({
      success: true,
      message: 'Test request created successfully! Assigned to MLT.',
      data: testReport
    });

  } catch (error) {
    console.error('❌ Error creating test request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test request: ' + error.message
    });
  }
};

// 📌 DOCTOR: Get All Test Requests (with filters)
const getDoctorTestRequests = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status, category, patientId } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        error: 'Doctor ID is required'
      });
    }

    let query = { doctorId };

    if (status) {
      query.status = status;
    }

    if (category) {
      query.test_category = category;
    }

    if (patientId) {
      query.patientId = patientId;
    }

    const testRequests = await TestReport.find(query)
      .populate('patientId', 'name email phone profile')
      .populate('mltId', 'name email specialization department')
      .populate('appointmentId', 'appointment_date appointment_time')
      .sort({ createdAt: -1 });

    // Get statistics
    const stats = {
      total: testRequests.length,
      pending: testRequests.filter(t => t.status === 'pending').length,
      assigned: testRequests.filter(t => t.status === 'assigned').length,
      'in-progress': testRequests.filter(t => t.status === 'in-progress').length,
      completed: testRequests.filter(t => t.status === 'completed').length,
      cancelled: testRequests.filter(t => t.status === 'cancelled').length
    };

    res.json({
      success: true,
      statistics: stats,
      data: testRequests
    });

  } catch (error) {
    console.error('❌ Error fetching doctor test requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test requests'
    });
  }
};

// 📌 MLT: Get Assigned Test Requests
const getMLTTestRequests = async (req, res) => {
  try {
    const { mltId } = req.params;
    const { status, category } = req.query;

    if (!mltId) {
      return res.status(400).json({
        success: false,
        error: 'MLT ID is required'
      });
    }

    let query = { mltId };

    if (status) {
      query.status = status;
    }

    if (category) {
      query.test_category = category;
    }

    const testRequests = await TestReport.find(query)
      .populate('patientId', 'name email phone profile')
      .populate('doctorId', 'name email specialization')
      .populate('appointmentId', 'appointment_date appointment_time symptoms')
      .sort({ createdAt: -1 });

    // Get statistics
    const stats = {
      total: testRequests.length,
      pending: testRequests.filter(t => t.status === 'pending').length,
      assigned: testRequests.filter(t => t.status === 'assigned').length,
      'in-progress': testRequests.filter(t => t.status === 'in-progress').length,
      completed: testRequests.filter(t => t.status === 'completed').length,
      cancelled: testRequests.filter(t => t.status === 'cancelled').length
    };

    res.json({
      success: true,
      statistics: stats,
      data: testRequests
    });

  } catch (error) {
    console.error('❌ Error fetching MLT test requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test requests'
    });
  }
};

// 📌 MLT: Accept/Start Test
const startTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const { mlt_notes } = req.body;

    const testReport = await TestReport.findById(testId);

    if (!testReport) {
      return res.status(404).json({
        success: false,
        error: 'Test request not found'
      });
    }

    if (testReport.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Test is already completed'
      });
    }

    if (testReport.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Test has been cancelled'
      });
    }

    testReport.status = 'in-progress';
    testReport.mlt_notes = mlt_notes || 'Started working on test';
    testReport.updatedAt = new Date();

    await testReport.save();

    res.json({
      success: true,
      message: 'Test started successfully',
      data: testReport
    });

  } catch (error) {
    console.error('❌ Error starting test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start test'
    });
  }
};

// 📌 MLT: Submit Test Results
const submitTestResults = async (req, res) => {
  console.log('🚀 SUBMIT TEST RESULTS - START');
  console.log('📦 Request body:', req.body);
  console.log('📁 File received:', req.file ? 'Yes' : 'No');

  try {
    const { testId } = req.params;
    const {
      test_results,
      results_summary,
      test_conclusion,
      recommendations,
      mlt_notes
    } = req.body;

    const testReport = await TestReport.findById(testId);

    if (!testReport) {
      return res.status(404).json({
        success: false,
        error: 'Test request not found'
      });
    }

    if (testReport.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Test is already completed'
      });
    }

    if (testReport.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Test has been cancelled'
      });
    }

    // Update test results
    const updateData = {
      status: 'completed',
      test_results: test_results || '',
      results_summary: results_summary || '',
      test_conclusion: test_conclusion || '',
      recommendations: recommendations || '',
      mlt_notes: mlt_notes || '',
      completed_date: new Date(),
      updatedAt: new Date()
    };

    // If file uploaded (report PDF/Image)
    if (req.file) {
      updateData.test_report_url = req.file.path;
      updateData.test_report_public_id = req.file.filename;
    }

    const updatedTest = await TestReport.findByIdAndUpdate(
      testId,
      updateData,
      { new: true }
    );

    console.log('✅ Test results submitted:', updatedTest._id);

    res.json({
      success: true,
      message: 'Test results submitted successfully',
      data: updatedTest
    });

  } catch (error) {
    console.error('❌ Error submitting test results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit test results'
    });
  }
};

// 📌 MLT: Accept Assignment
const acceptAssignment = async (req, res) => {
  try {
    const { testId } = req.params;
    const { mlt_notes } = req.body;

    const testReport = await TestReport.findById(testId);

    if (!testReport) {
      return res.status(404).json({
        success: false,
        error: 'Test request not found'
      });
    }

    if (testReport.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Test is already ${testReport.status}`
      });
    }

    testReport.status = 'assigned';
    testReport.mlt_notes = mlt_notes || 'Accepted assignment';
    testReport.assigned_date = new Date();
    testReport.updatedAt = new Date();

    await testReport.save();

    res.json({
      success: true,
      message: 'Test assignment accepted',
      data: testReport
    });

  } catch (error) {
    console.error('❌ Error accepting assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept assignment'
    });
  }
};

// 📌 MLT: Reject Assignment
const rejectAssignment = async (req, res) => {
  try {
    const { testId } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const testReport = await TestReport.findById(testId);

    if (!testReport) {
      return res.status(404).json({
        success: false,
        error: 'Test request not found'
      });
    }

    if (testReport.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Test is already ${testReport.status}`
      });
    }

    testReport.status = 'cancelled';
    testReport.mlt_notes = `Rejected: ${rejection_reason}`;
    testReport.updatedAt = new Date();

    await testReport.save();

    res.json({
      success: true,
      message: 'Test assignment rejected',
      data: testReport
    });

  } catch (error) {
    console.error('❌ Error rejecting assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject assignment'
    });
  }
};

// 📌 Get Test Request Details
const getTestRequestDetails = async (req, res) => {
  try {
    const { testId } = req.params;

    const testReport = await TestReport.findById(testId)
      .populate('patientId', 'name email phone profile')
      .populate('doctorId', 'name email specialization')
      .populate('mltId', 'name email specialization department')
      .populate('appointmentId', 'appointment_date appointment_time symptoms');

    if (!testReport) {
      return res.status(404).json({
        success: false,
        error: 'Test request not found'
      });
    }

    res.json({
      success: true,
      data: testReport
    });

  } catch (error) {
    console.error('❌ Error fetching test details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test details'
    });
  }
};

// 📌 DOCTOR: Get Test Statistics
const getTestStatistics = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const total = await TestReport.countDocuments({ doctorId });
    const pending = await TestReport.countDocuments({ doctorId, status: 'pending' });
    const assigned = await TestReport.countDocuments({ doctorId, status: 'assigned' });
    const inProgress = await TestReport.countDocuments({ doctorId, status: 'in-progress' });
    const completed = await TestReport.countDocuments({ doctorId, status: 'completed' });
    const cancelled = await TestReport.countDocuments({ doctorId, status: 'cancelled' });

    // Tests by category
    const byCategory = await TestReport.aggregate([
      { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
      {
        $group: {
          _id: '$test_category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Tests by MLT
    const byMLT = await TestReport.aggregate([
      { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
      {
        $group: {
          _id: '$mlt_name',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        assigned,
        inProgress,
        completed,
        cancelled,
        byCategory,
        byMLT
      }
    });

  } catch (error) {
    console.error('❌ Error fetching test statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

// 📌 Get All Patients (for doctor dropdown)
const getPatientsForDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    // Get all patients who have appointments with this doctor
    const appointments = await Appointment.find({ 
      doctor_email: req.user?.email,
      appointment_status: 'approved'
    }).populate('patientId', 'name email phone profile');

    // Get unique patients
    const uniquePatients = [];
    const seen = new Set();
    
    appointments.forEach(app => {
      if (app.patientId && !seen.has(app.patientId._id.toString())) {
        seen.add(app.patientId._id.toString());
        uniquePatients.push({
          _id: app.patientId._id,
          name: app.patientId.name,
          email: app.patientId.email,
          phone: app.patientId.phone,
          profile: app.patientId.profile
        });
      }
    });

    res.json({
      success: true,
      data: uniquePatients
    });

  } catch (error) {
    console.error('❌ Error fetching patients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patients'
    });
  }
};

// controllers/testReportController.js - Add this new function at the end

// 📌 PUBLIC: Get All Test Reports (No authentication required)
const getAllTestReports = async (req, res) => {
  try {
    const { status, category, search } = req.query;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (category) {
      query.test_category = category;
    }
    
    // Search by patient name, doctor name, or test name
    if (search) {
      query.$or = [
        { patient_name: { $regex: search, $options: 'i' } },
        { doctor_name: { $regex: search, $options: 'i' } },
        { test_name: { $regex: search, $options: 'i' } },
        { mlt_name: { $regex: search, $options: 'i' } }
      ];
    }

    const testReports = await TestReport.find(query)
      .populate('patientId', 'name email phone profile')
      .populate('doctorId', 'name email specialization')
      .populate('mltId', 'name email specialization department')
      .populate('appointmentId', 'appointment_date appointment_time')
      .sort({ createdAt: -1 });

    // Get statistics
    const stats = {
      total: testReports.length,
      pending: testReports.filter(t => t.status === 'pending').length,
      assigned: testReports.filter(t => t.status === 'assigned').length,
      'in-progress': testReports.filter(t => t.status === 'in-progress').length,
      completed: testReports.filter(t => t.status === 'completed').length,
      cancelled: testReports.filter(t => t.status === 'cancelled').length
    };

    res.json({
      success: true,
      statistics: stats,
      data: testReports
    });

  } catch (error) {
    console.error('❌ Error fetching test reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test reports'
    });
  }
};

// 📌 PUBLIC: Get Single Test Report by ID (No authentication required)
const getPublicTestReport = async (req, res) => {
  try {
    const { testId } = req.params;

    const testReport = await TestReport.findById(testId)
      .populate('patientId', 'name email phone profile')
      .populate('doctorId', 'name email specialization')
      .populate('mltId', 'name email specialization department')
      .populate('appointmentId', 'appointment_date appointment_time symptoms');

    if (!testReport) {
      return res.status(404).json({
        success: false,
        error: 'Test report not found'
      });
    }

    res.json({
      success: true,
      data: testReport
    });

  } catch (error) {
    console.error('❌ Error fetching test report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test report'
    });
  }
};

// 📌 PUBLIC: Get Test Report Statistics (No authentication required)
const getPublicTestStatistics = async (req, res) => {
  try {
    const total = await TestReport.countDocuments();
    const pending = await TestReport.countDocuments({ status: 'pending' });
    const assigned = await TestReport.countDocuments({ status: 'assigned' });
    const inProgress = await TestReport.countDocuments({ status: 'in-progress' });
    const completed = await TestReport.countDocuments({ status: 'completed' });
    const cancelled = await TestReport.countDocuments({ status: 'cancelled' });

    // Reports by category
    const byCategory = await TestReport.aggregate([
      {
        $group: {
          _id: '$test_category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Reports by doctor
    const byDoctor = await TestReport.aggregate([
      {
        $group: {
          _id: '$doctor_name',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        assigned,
        inProgress,
        completed,
        cancelled,
        byCategory,
        byDoctor
      }
    });

  } catch (error) {
    console.error('❌ Error fetching test statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};



module.exports = {
  createTestRequest,
  getDoctorTestRequests,
  getMLTTestRequests,
  startTest,
  submitTestResults,
  acceptAssignment,
  rejectAssignment,
  getTestRequestDetails,
  getTestStatistics,
  getPatientsForDoctor,
  getAllTestReports,        // ✅ New public function
  getPublicTestReport,      // ✅ New public function
  getPublicTestStatistics 
};