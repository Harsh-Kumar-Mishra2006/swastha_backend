// controllers/testReportController.js
const TestReport = require('../models/testReportModel');
const Doctor = require('../models/doctorModel');
const MLT = require('../models/mltModel');
const mongoose = require('mongoose');

// ==================== DOCTOR CONTROLLERS ====================

// @desc    Create new test report (Doctor)
// @route   POST /api/reports/create
const createReport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const doctorId = req.user.userId;
    
    // Get doctor details
    const doctor = await Doctor.findOne({ userId: doctorId }).session(session);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    const {
      patientName,
      patientEmail,
      patientPhone,
      patientAge,
      patientGender,
      condition,
      disease,
      reportDescription,
      doctorNotes,
      tests,
      priority,
      additionalNotes
    } = req.body;

    // Validate required fields
    if (!patientName || !patientEmail || !condition || !disease || !reportDescription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: patientName, patientEmail, condition, disease, reportDescription'
      });
    }

    // Create report
    const report = await TestReport.create([{
      patient: {
        name: patientName,
        email: patientEmail,
        phone: patientPhone || '',
        age: patientAge || null,
        gender: patientGender || 'not_specified'
      },
      doctor: {
        doctorId: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization
      },
      condition,
      disease,
      reportDescription,
      doctorNotes: doctorNotes || '',
      additionalNotes: additionalNotes || '',
      tests: tests || [],
      priority: priority || 'normal',
      status: 'pending',
      createdBy: doctorId
    }], { session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Test report created successfully',
      data: {
        reportId: report[0].reportId,
        report: report[0]
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// @desc    Get all reports created by a doctor
// @route   GET /api/reports/doctor/my-reports
const getDoctorReports = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    
    const doctor = await Doctor.findOne({ userId: doctorId });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const query = { 'doctor.doctorId': doctor._id };
    
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await TestReport.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TestReport.countDocuments(query);

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single report by ID (Doctor)
// @route   GET /api/reports/doctor/:reportId
const getDoctorReportById = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { reportId } = req.params;

    const doctor = await Doctor.findOne({ userId: doctorId });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    const report = await TestReport.findOne({
      reportId: reportId,
      'doctor.doctorId': doctor._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update report (Doctor)
// @route   PUT /api/reports/doctor/:reportId
const updateDoctorReport = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { reportId } = req.params;
    const updates = req.body;

    const doctor = await Doctor.findOne({ userId: doctorId });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    const report = await TestReport.findOne({
      reportId: reportId,
      'doctor.doctorId': doctor._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['condition', 'disease', 'reportDescription', 'doctorNotes', 'tests', 'priority', 'additionalNotes'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        report[field] = updates[field];
      }
    });

    report.updatedAt = Date.now();
    await report.save();

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Assign report to MLT (Doctor)
// @route   POST /api/reports/doctor/:reportId/assign
const assignToMLT = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const doctorId = req.user.userId;
    const { reportId } = req.params;
    const { mltId } = req.body;

    const doctor = await Doctor.findOne({ userId: doctorId }).session(session);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    const mlt = await MLT.findById(mltId).session(session);
    if (!mlt || mlt.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'MLT not found or inactive'
      });
    }

    const report = await TestReport.findOne({
      reportId: reportId,
      'doctor.doctorId': doctor._id
    }).session(session);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    report.mlt = {
      mltId: mlt._id,
      name: mlt.name,
      email: mlt.email,
      assignedAt: new Date()
    };
    report.status = 'assigned';
    report.updatedAt = Date.now();
    await report.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: `Report assigned to MLT ${mlt.name}`,
      data: report
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// ==================== MLT CONTROLLERS ====================

// @desc    Get all reports assigned to MLT
// @route   GET /api/reports/mlt/my-reports
const getMLTReports = async (req, res) => {
  try {
    const mltId = req.user.userId;
    
    const mlt = await MLT.findOne({ userId: mltId });
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const query = { 'mlt.mltId': mlt._id };
    
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await TestReport.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TestReport.countDocuments(query);

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get single report for MLT
// @route   GET /api/reports/mlt/:reportId
const getMLTReportById = async (req, res) => {
  try {
    const mltId = req.user.userId;
    const { reportId } = req.params;

    const mlt = await MLT.findOne({ userId: mltId });
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    const report = await TestReport.findOne({
      reportId: reportId,
      'mlt.mltId': mlt._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found or not assigned to you'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Accept report assignment (MLT)
// @route   PUT /api/reports/mlt/:reportId/accept
const acceptReport = async (req, res) => {
  try {
    const mltId = req.user.userId;
    const { reportId } = req.params;

    const mlt = await MLT.findOne({ userId: mltId });
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    const report = await TestReport.findOne({
      reportId: reportId,
      'mlt.mltId': mlt._id,
      status: 'assigned'
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found or not in assigned status'
      });
    }

    report.status = 'in_progress';
    report.mlt.acceptedAt = new Date();
    report.updatedAt = Date.now();
    await report.save();

    res.json({
      success: true,
      message: 'Report accepted, you can now process the tests',
      data: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Update test results (MLT)
// @route   PUT /api/reports/mlt/:reportId/tests/:testIndex
const updateTestResult = async (req, res) => {
  try {
    const mltId = req.user.userId;
    const { reportId, testIndex } = req.params;
    const { result, status } = req.body;

    const mlt = await MLT.findOne({ userId: mltId });
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    const report = await TestReport.findOne({
      reportId: reportId,
      'mlt.mltId': mlt._id
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const index = parseInt(testIndex);
    if (index >= 0 && index < report.tests.length) {
      if (result !== undefined) report.tests[index].result = result;
      if (status !== undefined) report.tests[index].status = status;
      report.updatedAt = Date.now();
      await report.save();
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid test index'
      });
    }

    res.json({
      success: true,
      message: 'Test result updated',
      data: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Complete report (MLT)
// @route   PUT /api/reports/mlt/:reportId/complete
const completeReport = async (req, res) => {
  try {
    const mltId = req.user.userId;
    const { reportId } = req.params;

    const mlt = await MLT.findOne({ userId: mltId });
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    const report = await TestReport.findOne({
      reportId: reportId,
      'mlt.mltId': mlt._id,
      status: { $in: ['assigned', 'in_progress'] }
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    report.status = 'completed';
    report.completedAt = new Date();
    report.mlt.completedAt = new Date();
    report.updatedAt = Date.now();
    await report.save();

    res.json({
      success: true,
      message: 'Report completed successfully',
      data: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==================== BOTH ROLES ====================

// @desc    Get report by ID (if authorized - doctor or assigned MLT)
// @route   GET /api/reports/:reportId
const getReportById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { reportId } = req.params;

    let report = null;

    if (userRole === 'doctor') {
      const doctor = await Doctor.findOne({ userId });
      if (doctor) {
        report = await TestReport.findOne({
          reportId: reportId,
          'doctor.doctorId': doctor._id
        });
      }
    } else if (userRole === 'MLT') {
      const mlt = await MLT.findOne({ userId });
      if (mlt) {
        report = await TestReport.findOne({
          reportId: reportId,
          'mlt.mltId': mlt._id
        });
      }
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found or access denied'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get available MLTs for assignment (Doctor)
// @route   GET /api/reports/available-mlts
const getAvailableMLTs = async (req, res) => {
  try {
    const mlts = await MLT.find({ status: 'active' })
      .select('name email specialization department');

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

module.exports = {
  // Doctor endpoints
  createReport,
  getDoctorReports,
  getDoctorReportById,
  updateDoctorReport,
  assignToMLT,
  
  // MLT endpoints
  getMLTReports,
  getMLTReportById,
  acceptReport,
  updateTestResult,
  completeReport,
  
  // Shared endpoints
  getReportById,
  getAvailableMLTs
};