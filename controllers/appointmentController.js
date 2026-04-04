// controllers/appointmentController.js
const Appointment = require('../models/appointmentModel');
const Patient = require('../models/patientModel');
const Doctor = require('../models/doctorModel');
const Payment = require('../models/paymentModel');
const mongoose = require('mongoose');

// @desc    Check doctor availability for a specific slot
// @route   GET /api/appointments/check-availability
const checkAvailability = async (req, res) => {
  try {
    const { doctorId, date, timeSlot } = req.query;

    // Check if slot is already booked (confirmed or pending payment)
    const existingAppointment = await Appointment.findOne({
      'doctor.doctorId': doctorId,
      appointmentDate: new Date(date),
      'appointmentTime.slot': timeSlot,
      status: { $in: ['pending', 'confirmed'] } // Both pending and confirmed are blocked
    });

    res.json({
      success: true,
      available: !existingAppointment,
      message: existingAppointment ? 'Slot not available' : 'Slot available'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Create appointment form data (get doctor details for form)
// @route   GET /api/appointments/book-form/:doctorId
const getAppointmentFormData = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.doctorId)
      .select('name specialization consultationFee experience qualifications');

    if (!doctor || doctor.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Doctor not available'
      });
    }

    res.json({
      success: true,
      data: {
        doctorId: doctor._id,
        doctorName: doctor.name,
        specialization: doctor.specialization,
        consultationFee: doctor.consultationFee,
        experience: doctor.experience
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Create pending appointment (before payment)
// @route   POST /api/appointments/create-pending
const createPendingAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.userId;
    const {
      doctorId,
      appointmentDate,
      appointmentTime,
      appointmentType,
      reasonForVisit,
      symptoms,
      diseaseDetails,
      isFirstVisit,
      additionalNotes
    } = req.body;

    // Get patient details from Patient model using userId
    const patient = await Patient.findOne({ userId }).session(session);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient profile not found'
      });
    }

    // Get doctor details
    const doctor = await Doctor.findById(doctorId).session(session);
    if (!doctor || doctor.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Doctor not available'
      });
    }

    // Double-check availability within transaction
    const existingAppointment = await Appointment.findOne({
      'doctor.doctorId': doctorId,
      appointmentDate: new Date(appointmentDate),
      'appointmentTime.slot': appointmentTime,
      status: { $in: ['pending', 'confirmed'] }
    }).session(session);

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is no longer available'
      });
    }

    // Calculate expiry time (30 minutes for payment)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Create pending appointment
    const appointment = await Appointment.create([{
      patient: {
        patientId: patient._id,
        userId: patient.userId,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender
      },
      doctor: {
        doctorId: doctor._id,
        name: doctor.name,
        specialization: doctor.specialization,
        consultationFee: doctor.consultationFee
      },
      appointmentType,
      bookingType: 'direct', // Will be updated to 'paid' after payment
      appointmentDate: new Date(appointmentDate),
      appointmentTime: {
        slot: appointmentTime,
        duration: 30
      },
      status: 'pending',
      reasonForVisit,
      symptoms: symptoms || [],
      diseaseDetails: diseaseDetails || {},
      isFirstVisit: isFirstVisit || true,
      additionalNotes,
      createdBy: userId,
      expiresAt // Custom field we'll add to schema
    }], { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Pending appointment created',
      data: {
        appointmentId: appointment[0]._id,
        appointmentIdDisplay: appointment[0].appointmentId,
        doctorName: doctor.name,
        consultationFee: doctor.consultationFee,
        convenienceFee: Math.round(doctor.consultationFee * 0.02),
        totalAmount: doctor.consultationFee + Math.round(doctor.consultationFee * 0.02),
        expiresAt
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating pending appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// @desc    Get appointment details after successful payment
// @route   GET /api/appointments/confirmed/:appointmentId
const getConfirmedAppointment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { appointmentId } = req.params;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      'patient.userId': userId,
      status: 'confirmed'
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Confirmed appointment not found'
      });
    }

    // Get payment details
    const payment = await Payment.findOne({ appointmentId: appointment._id });

    res.json({
      success: true,
      data: {
        appointmentId: appointment.appointmentId,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        doctor: appointment.doctor,
        patient: appointment.patient,
        status: appointment.status,
        paymentDetails: payment ? {
          paymentId: payment.paymentId,
          amount: payment.totalAmount,
          paymentStatus: payment.paymentStatus,
          paymentDate: payment.paymentDate
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get all appointments for logged-in patient
// @route   GET /api/appointments/my-appointments
const getMyAppointments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query = { 'patient.userId': userId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: -1, 'appointmentTime.slot': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: appointments.map(apt => ({
        appointmentId: apt.appointmentId,
        doctorName: apt.doctor.name,
        specialization: apt.doctor.specialization,
        appointmentDate: apt.appointmentDate,
        appointmentTime: apt.appointmentTime.slot,
        status: apt.status,
        bookingType: apt.bookingType,
        reasonForVisit: apt.reasonForVisit
      })),
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

// @desc    Cancel appointment (no refund - for future implementation)
// @route   PUT /api/appointments/cancel/:appointmentId
const cancelAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.userId;
    const { appointmentId } = req.params;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      'patient.userId': userId,
      status: { $in: ['confirmed', 'pending'] }
    }).session(session);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found or cannot be cancelled'
      });
    }

    // Check if appointment is within 24 hours (optional)
    const appointmentDate = new Date(appointment.appointmentDate);
    const today = new Date();
    const hoursDiff = (appointmentDate - today) / (1000 * 60 * 60);
    
    if (hoursDiff < 24) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel appointment within 24 hours'
      });
    }

    appointment.status = 'cancelled';
    await appointment.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
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
// controllers/appointmentController.js
// Add this function at the end, before module.exports

// @desc    Upload medical reports for an appointment
// @route   POST /api/appointments/upload-reports/:appointmentId
const uploadReports = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.userId;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Find the appointment
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      'patient.userId': userId
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Process uploaded files
    const uploadedReports = files.map(file => ({
      fileName: file.originalname,
      fileUrl: `/uploads/${file.filename}`,
      fileType: file.mimetype,
      uploadedAt: new Date()
    }));

    // Add reports to appointment
    appointment.reports.push(...uploadedReports);
    await appointment.save();

    res.json({
      success: true,
      message: 'Reports uploaded successfully',
      data: {
        reports: uploadedReports
      }
    });

  } catch (error) {
    console.error('Error uploading reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};



module.exports = {
  checkAvailability,
  getAppointmentFormData,
  createPendingAppointment,
  getConfirmedAppointment,
  getMyAppointments,
  cancelAppointment,
  uploadReports 
};