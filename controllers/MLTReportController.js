// controllers/mltReportController.js
const TestReport = require('../models/testReportModel');
const MLT = require('../models/mltModel');
const Auth = require('../models/authModel');
const Doctor = require('../models/doctorModel');
const Appointment = require('../models/appointmentModel');
const mongoose = require('mongoose');

// ============================================
// MLT DASHBOARD & OVERVIEW
// ============================================

/**
 * 📊 Get MLT Dashboard Overview
 * GET /api/mlt-reports/dashboard/:mltId
 */
const getMLTDashboard = async (req, res) => {
  try {
    const { mltId } = req.params;
    
    // Verify MLT exists
    const mlt = await MLT.findById(mltId);
    if (!mlt) {
      return res.status(404).json({
        success: false,
        error: 'MLT not found'
      });
    }

    // Get all tests for this MLT
    const allTests = await TestReport.find({ mltId });
    
    // Statistics
    const stats = {
      total: allTests.length,
      pending: allTests.filter(t => t.status === 'pending').length,
      assigned: allTests.filter(t => t.status === 'assigned').length,
      'in-progress': allTests.filter(t => t.status === 'in-progress').length,
      completed: allTests.filter(t => t.status === 'completed').length,
      cancelled: allTests.filter(t => t.status === 'cancelled').length
    };

    // Recent tests (last 10)
    const recentTests = await TestReport.find({ mltId })
      .populate('patientId', 'name email profile')
      .populate('doctorId', 'name email specialization')
      .sort({ updatedAt: -1 })
      .limit(10);

    // Tests by category
    const byCategory = await TestReport.aggregate([
      { $match: { mltId: new mongoose.Types.ObjectId(mltId) } },
      {
        $group: {
          _id: '$test_category',
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Tests by priority
    const byPriority = await TestReport.aggregate([
      { $match: { mltId: new mongoose.Types.ObjectId(mltId) } },
      {
        $group: {
          _id: '$test_priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        mlt: {
          id: mlt._id,
          name: mlt.name,
          email: mlt.email,
          specialization: mlt.specialization
        },
        statistics: stats,
        recentTests,
        byCategory,
        byPriority
      }
    });

  } catch (error) {
    console.error('❌ Error fetching MLT dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data: ' + error.message
    });
  }
};

// ============================================
// TEST ASSIGNMENT MANAGEMENT
// ============================================

/**
 * 📋 Get Assigned Tests (with filters)
 * GET /api/mlt-reports/assigned/:mltId
 */
const getAssignedTests = async (req, res) => {
  try {
    const { mltId } = req.params;
    const { status, category, priority, search, page = 1, limit = 20 } = req.query;

    if (!mltId || !mongoose.Types.ObjectId.isValid(mltId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid MLT ID is required'
      });
    }

    // Build query
    let query = { mltId };
    
    // Status filter
    if (status) {
      const validStatuses = ['pending', 'assigned', 'in-progress', 'completed', 'cancelled'];
      if (validStatuses.includes(status)) {
        query.status = status;
      }
    } else {
      // Default: show pending, assigned, and in-progress
      query.status = { $in: ['pending', 'assigned', 'in-progress'] };
    }

    if (category) {
      query.test_category = category;
    }

    if (priority) {
      query.test_priority = priority;
    }

    // Search filter
    if (search) {
      query.$or = [
        { patient_name: { $regex: search, $options: 'i' } },
        { doctor_name: { $regex: search, $options: 'i' } },
        { test_name: { $regex: search, $options: 'i' } },
        { patient_email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    // Get tests with pagination
    const tests = await TestReport.find(query)
      .populate('patientId', 'name email phone profile')
      .populate('doctorId', 'name email specialization')
      .populate('appointmentId', 'appointment_date appointment_time symptoms')
      .sort({ 
        test_priority: -1, // Emergency first
        createdAt: -1 
      })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TestReport.countDocuments(query);

    res.json({
      success: true,
      data: {
        tests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching assigned tests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assigned tests: ' + error.message
    });
  }
};

// ============================================
// TEST MANAGEMENT
// ============================================

/**
 * ✅ Accept Test Assignment
 * PUT /api/mlt-reports/:testId/accept
 */
const acceptTestAssignment = async (req, res) => {
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

    // Verify MLT is assigned
    if (testReport.mltId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this test'
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
      message: 'Test assignment accepted successfully',
      data: testReport
    });

  } catch (error) {
    console.error('❌ Error accepting assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept assignment: ' + error.message
    });
  }
};

/**
 * ❌ Reject Test Assignment
 * PUT /api/mlt-reports/:testId/reject
 */
const rejectTestAssignment = async (req, res) => {
  try {
    const { testId } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || rejection_reason.trim() === '') {
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

    // Verify MLT is assigned
    if (testReport.mltId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this test'
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
      error: 'Failed to reject assignment: ' + error.message
    });
  }
};

/**
️ * ▶️ Start Working on Test
 * PUT /api/mlt-reports/:testId/start
 */
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

    // Verify MLT is assigned
    if (testReport.mltId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this test'
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
      error: 'Failed to start test: ' + error.message
    });
  }
};

// ============================================
// REPORT CREATION & SUBMISSION
// ============================================

/**
 * 📝 Create/Update Detailed Report
 * PUT /api/mlt-reports/:testId/report
 */
const createDetailedReport = async (req, res) => {
  console.log('🚀 CREATE DETAILED REPORT - START');
  console.log('📦 Request body:', req.body);
  console.log('📁 File received:', req.file ? 'Yes' : 'No');

  try {
    const { testId } = req.params;
    
    // Parse JSON fields from form-data
    let test_parameters = [];
    let normal_ranges = [];
    
    try {
      if (req.body.test_parameters) {
        test_parameters = typeof req.body.test_parameters === 'string' 
          ? JSON.parse(req.body.test_parameters) 
          : req.body.test_parameters;
      }
      if (req.body.normal_ranges) {
        normal_ranges = typeof req.body.normal_ranges === 'string' 
          ? JSON.parse(req.body.normal_ranges) 
          : req.body.normal_ranges;
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON format for test_parameters or normal_ranges'
      });
    }

    const {
      test_results,
      results_summary,
      test_conclusion,
      recommendations,
      mlt_notes,
      report_status,
      interpretation,
      clinical_impression,
      follow_up_instructions,
      report_visibility
    } = req.body;

    // Find the test report
    const testReport = await TestReport.findById(testId);
    if (!testReport) {
      return res.status(404).json({
        success: false,
        error: 'Test request not found'
      });
    }

    // Check if MLT is assigned to this test
    const userId = req.user.id || req.user._id;
    const userEmail = req.user.email;
    
    const isAssignedMLT = testReport.mltId && 
      testReport.mltId.toString() === userId.toString();
    const isMLTByEmail = testReport.mlt_email === userEmail;
    
    if (!isAssignedMLT && !isMLTByEmail) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to update this test report'
      });
    }

    // Check if test can be updated
    if (testReport.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'This test has been cancelled and cannot be updated'
      });
    }

    // Save previous version before updating
    const previousVersion = {
      test_results: testReport.test_results,
      results_summary: testReport.results_summary,
      test_conclusion: testReport.test_conclusion,
      recommendations: testReport.recommendations,
      test_parameters: testReport.test_parameters || [],
      updatedAt: new Date(),
      updatedBy: userEmail || 'unknown'
    };

    // Update report with detailed information
    const updateData = {
      status: report_status || 'completed',
      test_results: test_results || testReport.test_results || '',
      results_summary: results_summary || testReport.results_summary || '',
      test_conclusion: test_conclusion || testReport.test_conclusion || '',
      recommendations: recommendations || testReport.recommendations || '',
      mlt_notes: mlt_notes || testReport.mlt_notes || '',
      test_parameters: test_parameters.length > 0 ? test_parameters : testReport.test_parameters || [],
      normal_ranges: normal_ranges.length > 0 ? normal_ranges : testReport.normal_ranges || [],
      interpretation: interpretation || testReport.interpretation || '',
      clinical_impression: clinical_impression || testReport.clinical_impression || '',
      follow_up_instructions: follow_up_instructions || testReport.follow_up_instructions || '',
      report_visibility: report_visibility || testReport.report_visibility || 'both',
      report_version: (testReport.report_version || 1) + 1,
      updatedAt: new Date()
    };

    // If status is being set to completed, add completed_date
    if (report_status === 'completed' && testReport.status !== 'completed') {
      updateData.completed_date = new Date();
    }

    // If file uploaded (report PDF/Image)
    if (req.file) {
      updateData.test_report_url = req.file.path;
      updateData.test_report_public_id = req.file.filename;
    }

    // Add to previous versions (keep last 5 versions)
    const previousVersions = testReport.previous_versions || [];
    previousVersions.unshift(previousVersion);
    if (previousVersions.length > 5) {
      previousVersions.pop();
    }
    updateData.previous_versions = previousVersions;

    const updatedTest = await TestReport.findByIdAndUpdate(
      testId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('✅ Detailed report created:', updatedTest._id);

    res.json({
      success: true,
      message: 'Detailed test report created successfully',
      data: updatedTest
    });

  } catch (error) {
    console.error('❌ Error creating detailed report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create detailed report: ' + error.message
    });
  }
};

/**
 * 📎 Submit Test Results (Simple version)
 * PUT /api/mlt-reports/:testId/submit
 */
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

    // Check if MLT is assigned
    if (testReport.mltId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to submit results for this test'
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
      error: 'Failed to submit test results: ' + error.message
    });
  }
};

// ============================================
// REPORT VIEWING
// ============================================

/**
 * 👁️ Get Test Report Details
 * GET /api/mlt-reports/:testId
 */
const getTestReportDetails = async (req, res) => {
  try {
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid test ID'
      });
    }

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

    // Permission check
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const userEmail = req.user.email;

    const isAssignedMLT = testReport.mltId && 
      testReport.mltId.toString() === userId.toString();
    const isDoctor = testReport.doctorId && 
      testReport.doctorId.toString() === userId.toString();
    const isPatient = testReport.patientId && 
      testReport.patientId.toString() === userId.toString();
    const isAdmin = userRole === 'admin';

    // Check visibility for patient
    let hasAccess = false;
    if (isAdmin || isAssignedMLT || isDoctor) {
      hasAccess = true;
    } else if (isPatient) {
      const visibility = testReport.report_visibility || 'both';
      hasAccess = visibility === 'patient' || visibility === 'both';
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this report'
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
      error: 'Failed to fetch test details: ' + error.message
    });
  }
};

/**
 * 📊 Get Completed Reports (MLT's own work)
 * GET /api/mlt-reports/completed/:mltId
 */
const getCompletedReports = async (req, res) => {
  try {
    const { mltId } = req.params;
    const { startDate, endDate, category, page = 1, limit = 20 } = req.query;

    if (!mltId || !mongoose.Types.ObjectId.isValid(mltId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid MLT ID is required'
      });
    }

    let query = { 
      mltId: mltId,
      status: 'completed'
    };

    if (category) {
      query.test_category = category;
    }

    if (startDate || endDate) {
      query.completed_date = {};
      if (startDate) {
        query.completed_date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.completed_date.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;

    const reports = await TestReport.find(query)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name email specialization')
      .sort({ completed_date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TestReport.countDocuments(query);

    // Get summary statistics
    const summary = await TestReport.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          avgTime: { 
            $avg: { 
              $subtract: ['$completed_date', '$assigned_date'] 
            } 
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        reports,
        summary: summary[0] || { totalReports: 0, avgTime: 0 },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching completed reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch completed reports: ' + error.message
    });
  }
};

// ============================================
// REPORT HISTORY & VERSIONS
// ============================================

/**
 * 📜 Get Report Version History
 * GET /api/mlt-reports/:testId/history
 */
const getReportHistory = async (req, res) => {
  try {
    const { testId } = req.params;

    const testReport = await TestReport.findById(testId)
      .select('previous_versions report_version updatedAt');

    if (!testReport) {
      return res.status(404).json({
        success: false,
        error: 'Test report not found'
      });
    }

    res.json({
      success: true,
      data: {
        currentVersion: testReport.report_version || 1,
        lastUpdated: testReport.updatedAt,
        history: testReport.previous_versions || []
      }
    });

  } catch (error) {
    console.error('❌ Error fetching report history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report history: ' + error.message
    });
  }
};

// ============================================
// STATISTICS
// ============================================

/**
 * 📊 Get MLT Performance Statistics
 * GET /api/mlt-reports/:mltId/statistics
 */
const getMLTStatistics = async (req, res) => {
  try {
    const { mltId } = req.params;
    const { period = 'month' } = req.query; // week, month, year

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    const matchQuery = {
      mltId: new mongoose.Types.ObjectId(mltId),
      createdAt: { $gte: startDate }
    };

    // Overall statistics
    const overall = await TestReport.aggregate([
      { $match: { mltId: new mongoose.Types.ObjectId(mltId) } },
      {
        $group: {
          _id: null,
          totalTests: { $sum: 1 },
          completedTests: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledTests: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          avgCompletionTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                { $subtract: ['$completed_date', '$assigned_date'] },
                null
              ]
            }
          }
        }
      }
    ]);

    // Daily statistics (last 30 days)
    const daily = await TestReport.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Category breakdown
    const byCategory = await TestReport.aggregate([
      { $match: { mltId: new mongoose.Types.ObjectId(mltId) } },
      {
        $group: {
          _id: '$test_category',
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
        period,
        dateRange: {
          start: startDate,
          end: now
        },
        overall: overall[0] || {
          totalTests: 0,
          completedTests: 0,
          cancelledTests: 0,
          avgCompletionTime: 0
        },
        daily,
        byCategory
      }
    });

  } catch (error) {
    console.error('❌ Error fetching MLT statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics: ' + error.message
    });
  }
};

module.exports = {
  getMLTDashboard,
  getAssignedTests,
  acceptTestAssignment,
  rejectTestAssignment,
  startTest,
  createDetailedReport,
  submitTestResults,
  getTestReportDetails,
  getCompletedReports,
  getReportHistory,
  getMLTStatistics
};