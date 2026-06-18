// controllers/appointmentController.js
const Appointment = require('../models/appointmentModel');
const Auth = require('../models/authModel');
const Doctor = require('../models/doctorModel');
const mongoose = require('mongoose');

// 📌 BOOK APPOINTMENT (Patient)
const bookAppointment = async (req, res) => {
  console.log('🚀 BOOK APPOINTMENT - START');
  console.log('📦 Request body:', req.body);
  console.log('📁 File received:', req.file ? 'Yes' : 'No');

  try {
    const {
      patient_email,
      patient_name,
      patient_phone,
      doctor_email,
      doctor_name,
      doctor_specialization,
      appointment_date,
      appointment_time,
      symptoms,
      notes,
      amount
    } = req.body;

    // ✅ VALIDATION
    if (!patient_email || !patient_name || !patient_phone) {
      return res.status(400).json({
        success: false,
        error: 'Patient information is required'
      });
    }

    if (!doctor_email || !doctor_name) {
      return res.status(400).json({
        success: false,
        error: 'Doctor information is required'
      });
    }

    if (!appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        error: 'Appointment date and time are required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Payment screenshot is required'
      });
    }

    // ✅ Get Cloudinary URL from multer
    const screenshotUrl = req.file.path;
    const screenshotPublicId = req.file.filename;

    console.log('✅ Screenshot uploaded:', screenshotUrl);

    // ✅ Check if patient exists and get their ID
    const patient = await Auth.findOne({ email: patient_email });
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found. Please register first.'
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

    // ✅ Check for duplicate appointment (same doctor, same date/time)
    const existingAppointment = await Appointment.findOne({
      doctor_email,
      appointment_date: new Date(appointment_date),
      appointment_time,
      appointment_status: { $in: ['pending', 'approved'] }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        error: 'This time slot is already booked. Please choose another time.'
      });
    }

    // ✅ Create appointment with patientId
    const appointmentData = {
      patientId: patient._id,  // ✅ Add patientId from Auth model
      patient_email,
      patient_name,
      patient_phone,
      doctor_email,
      doctor_name,
      doctor_specialization,
      appointment_date: new Date(appointment_date),
      appointment_time,
      symptoms: symptoms || '',
      notes: notes || '',
      amount: amount || doctor.consultationFee || 500,
      screenshot_url: screenshotUrl,
      screenshot_public_id: screenshotPublicId,
      payment_status: 'pending',
      appointment_status: 'pending'
    };

    const appointment = new Appointment(appointmentData);
    await appointment.save();

    console.log('✅ Appointment created:', appointment._id);
    console.log('✅ Patient ID:', patient._id);

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully! Waiting for doctor approval.',
      data: {
        appointment_id: appointment._id,
        patientId: appointment.patientId,
        patient_name: appointment.patient_name,
        doctor_name: appointment.doctor_name,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
        status: appointment.appointment_status,
        screenshot_url: appointment.screenshot_url
      }
    });

  } catch (error) {
    console.error('❌ Error booking appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to book appointment: ' + error.message
    });
  }
};

// 📌 GET PATIENT APPOINTMENTS (Updated to use patientId)
const getPatientAppointments = async (req, res) => {
  try {
    const { patient_email } = req.params;

    if (!patient_email) {
      return res.status(400).json({
        success: false,
        error: 'Patient email is required'
      });
    }

    // Get patient by email to get their ID
    const patient = await Auth.findOne({ email: patient_email });
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    const appointments = await Appointment.find({ 
      patientId: patient._id 
    })
      .populate('patientId', 'name email phone profile') // Populate patient details
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: appointments.length,
      data: appointments
    });

  } catch (error) {
    console.error('❌ Error fetching patient appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
};

// 📌 GET DOCTOR APPOINTMENTS (Doctor's Portal)
const getDoctorAppointments = async (req, res) => {
  try {
    const { doctor_email } = req.params;

    if (!doctor_email) {
      return res.status(400).json({
        success: false,
        error: 'Doctor email is required'
      });
    }

    // Optional: Filter by status
    const { status } = req.query;
    let query = { doctor_email };

    if (status && ['pending', 'approved', 'rejected', 'cancelled', 'completed'].includes(status)) {
      query.appointment_status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email phone profile') // ✅ Populate patient details
      .sort({ createdAt: -1 });

    // Get statistics
    const stats = {
      total: appointments.length,
      pending: appointments.filter(a => a.appointment_status === 'pending').length,
      approved: appointments.filter(a => a.appointment_status === 'approved').length,
      rejected: appointments.filter(a => a.appointment_status === 'rejected').length,
      completed: appointments.filter(a => a.appointment_status === 'completed').length
    };

    res.json({
      success: true,
      statistics: stats,
      data: appointments
    });

  } catch (error) {
    console.error('❌ Error fetching doctor appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
};

// 📌 GET APPOINTMENT DETAILS (Updated with populate)
const getAppointmentDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'name email phone profile'); // ✅ Populate patient details

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error('❌ Error fetching appointment details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment details'
    });
  }
};


// 📌 APPROVE APPOINTMENT (Doctor)
const approveAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { doctor_notes } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check if appointment is already processed
    if (appointment.appointment_status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Appointment is already ${appointment.appointment_status}`
      });
    }

    // Update appointment
    appointment.appointment_status = 'approved';
    appointment.doctor_notes = doctor_notes || 'Approved';
    appointment.approval_date = new Date();
    appointment.updatedAt = new Date();

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment approved successfully',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Error approving appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve appointment'
    });
  }
};

// 📌 REJECT APPOINTMENT (Doctor)
const rejectAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { rejection_reason, doctor_notes } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check if appointment is already processed
    if (appointment.appointment_status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Appointment is already ${appointment.appointment_status}`
      });
    }

    // Update appointment
    appointment.appointment_status = 'rejected';
    appointment.rejection_reason = rejection_reason;
    appointment.doctor_notes = doctor_notes || 'Rejected';
    appointment.updatedAt = new Date();

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment rejected',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Error rejecting appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject appointment'
    });
  }
};


// 📌 CANCEL APPOINTMENT (Patient)
const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { patient_email } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Verify patient owns this appointment
    if (appointment.patient_email !== patient_email) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to cancel this appointment'
      });
    }

    // Can only cancel pending or approved appointments
    if (!['pending', 'approved'].includes(appointment.appointment_status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel appointment with status: ${appointment.appointment_status}`
      });
    }

    appointment.appointment_status = 'cancelled';
    appointment.updatedAt = new Date();
    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel appointment'
    });
  }
};

// 📌 VERIFY PAYMENT (Admin/Doctor)
const verifyPayment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    appointment.payment_status = 'verified';
    appointment.updatedAt = new Date();
    await appointment.save();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
};

// 📌 GET APPOINTMENT STATISTICS (Admin Dashboard)
const getAppointmentStats = async (req, res) => {
  try {
    const total = await Appointment.countDocuments();
    const pending = await Appointment.countDocuments({ appointment_status: 'pending' });
    const approved = await Appointment.countDocuments({ appointment_status: 'approved' });
    const rejected = await Appointment.countDocuments({ appointment_status: 'rejected' });
    const completed = await Appointment.countDocuments({ appointment_status: 'completed' });
    const cancelled = await Appointment.countDocuments({ appointment_status: 'cancelled' });

    // Appointments by doctor
    const byDoctor = await Appointment.aggregate([
      {
        $group: {
          _id: '$doctor_name',
          count: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$appointment_status', 'pending'] }, 1, 0] }
          },
          approved: {
            $sum: { $cond: [{ $eq: ['$appointment_status', 'approved'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Appointments by date (last 7 days)
    const last7Days = await Appointment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        completed,
        cancelled,
        byDoctor,
        last7Days
      }
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

module.exports = {
  bookAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  approveAppointment,
  rejectAppointment,
  getAppointmentDetails,
  cancelAppointment,
  verifyPayment,
  getAppointmentStats
};