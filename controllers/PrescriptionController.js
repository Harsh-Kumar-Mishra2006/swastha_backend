// controllers/prescriptionController.js
const Prescription = require('../models/PrescriptionModel');
const Appointment = require('../models/appointmentModel');
const Auth = require('../models/authModel');

// ============================================
// 📌 CREATE PRESCRIPTION (Doctor/Admin)
// ============================================
const createPrescription = async (req, res) => {
  try {
    console.log('📝 CREATE PRESCRIPTION - START');
    console.log('📦 Request body:', req.body);
    console.log('👤 User:', req.user);

    const {
      appointmentId,
      diagnosis,
      disease,
      disease_code,
      medications,
      patient_instructions,
      non_medication_advice,
      lifestyle_advice,
      dietary_restrictions,
      follow_up_required,
      follow_up_date,
      follow_up_notes,
      refills_allowed,
      valid_until,
      warnings,
      doctor_notes
    } = req.body;

    // ✅ Validate required fields
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        error: 'Appointment ID is required'
      });
    }

    if (!diagnosis || !disease) {
      return res.status(400).json({
        success: false,
        error: 'Diagnosis and disease are required'
      });
    }

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one medication is required'
      });
    }

    if (!patient_instructions || !Array.isArray(patient_instructions) || patient_instructions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one patient instruction is required'
      });
    }

    // ✅ Get appointment details
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'name email phone profile')
      .populate('doctor_email');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // ✅ Check if appointment is approved
    if (appointment.appointment_status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: `Cannot create prescription for ${appointment.appointment_status} appointment. Only approved appointments.`
      });
    }

    // ✅ Check if prescription already exists for this appointment
    const existingPrescription = await Prescription.findOne({ appointmentId });
    if (existingPrescription) {
      return res.status(409).json({
        success: false,
        error: 'Prescription already exists for this appointment',
        prescription_id: existingPrescription._id
      });
    }

    // ✅ Get doctor details
    const doctor = await Auth.findById(req.user.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // ✅ Validate medications
    const validatedMedications = medications.map((med, index) => {
      if (!med.medicine_name || !med.strength || !med.dosage || !med.frequency || !med.duration) {
        throw new Error(`Medication ${index + 1} is missing required fields`);
      }
      return {
        medicine_name: med.medicine_name.trim(),
        strength: med.strength.trim(),
        form: med.form || 'Tablet',
        quantity: med.quantity || 'As prescribed',
        dosage: med.dosage.trim(),
        frequency: med.frequency.trim(),
        duration: med.duration.trim(),
        timing: med.timing || 'Any time',
        special_instructions: med.special_instructions || '',
        is_controlled: med.is_controlled || false
      };
    });

    // ✅ Create prescription
    const prescriptionData = {
      appointmentId: appointment._id,
      patientId: appointment.patientId._id || appointment.patientId,
      patient_name: appointment.patient_name,
      patient_email: appointment.patient_email,
      patient_phone: appointment.patient_phone,
      patient_age: appointment.patientId?.profile?.age || '',
      patient_gender: appointment.patientId?.profile?.gender || '',
      patient_bloodGroup: appointment.patientId?.profile?.bloodGroup || '',
      
      doctorId: doctor._id,
      doctor_name: doctor.name,
      doctor_email: doctor.email,
      doctor_specialization: doctor.profile?.specialization || appointment.doctor_specialization || '',
      
      diagnosis: diagnosis.trim(),
      disease: disease.trim(),
      disease_code: disease_code || '',
      
      prescription_date: new Date(),
      valid_until: valid_until ? new Date(valid_until) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      
      medications: validatedMedications,
      patient_instructions: patient_instructions.map(i => i.trim()),
      non_medication_advice: non_medication_advice || '',
      
      lifestyle_advice: lifestyle_advice || '',
      dietary_restrictions: dietary_restrictions || '',
      
      follow_up_required: follow_up_required || false,
      follow_up_date: follow_up_date ? new Date(follow_up_date) : undefined,
      follow_up_notes: follow_up_notes || '',
      
      refills_allowed: refills_allowed || 0,
      refills_remaining: refills_allowed || 0,
      
      warnings: warnings || [],
      allergies_checked: true,
      drug_interactions_checked: true,
      
      doctor_notes: doctor_notes || '',
      is_digital_signed: true,
      digital_signature: `Dr. ${doctor.name}`,
      prescription_status: 'active'
    };

    const prescription = new Prescription(prescriptionData);
    await prescription.save();

    console.log('✅ Prescription created:', prescription._id);

    // ✅ Update appointment status to completed
    appointment.appointment_status = 'completed';
    await appointment.save();

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error creating prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create prescription: ' + error.message
    });
  }
};

// ============================================
// 📌 GET PATIENT PRESCRIPTIONS
// ============================================
const getPatientPrescriptions = async (req, res) => {
  try {
    const { patient_email } = req.params;

    if (!patient_email) {
      return res.status(400).json({
        success: false,
        error: 'Patient email is required'
      });
    }

    // Get patient by email
    const patient = await Auth.findOne({ email: patient_email });
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Optional: Filter by status
    const { status } = req.query;
    let query = { patientId: patient._id };

    if (status && ['active', 'dispensed', 'expired', 'cancelled'].includes(status)) {
      query.prescription_status = status;
    }

    const prescriptions = await Prescription.find(query)
      .sort({ createdAt: -1 })
      .populate('appointmentId', 'appointment_date appointment_time doctor_name');

    res.json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });

  } catch (error) {
    console.error('❌ Error fetching patient prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescriptions'
    });
  }
};

// ============================================
// 📌 GET DOCTOR PRESCRIPTIONS
// ============================================
const getDoctorPrescriptions = async (req, res) => {
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

    if (status && ['active', 'dispensed', 'expired', 'cancelled'].includes(status)) {
      query.prescription_status = status;
    }

    const prescriptions = await Prescription.find(query)
      .sort({ createdAt: -1 })
      .populate('patientId', 'name email phone profile')
      .populate('appointmentId', 'appointment_date appointment_time');

    // Statistics
    const stats = {
      total: prescriptions.length,
      active: prescriptions.filter(p => p.prescription_status === 'active').length,
      dispensed: prescriptions.filter(p => p.prescription_status === 'dispensed').length,
      expired: prescriptions.filter(p => p.prescription_status === 'expired').length,
      cancelled: prescriptions.filter(p => p.prescription_status === 'cancelled').length
    };

    res.json({
      success: true,
      statistics: stats,
      data: prescriptions
    });

  } catch (error) {
    console.error('❌ Error fetching doctor prescriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescriptions'
    });
  }
};

// ============================================
// 📌 GET PRESCRIPTION DETAILS
// ============================================
const getPrescriptionDetails = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findById(prescriptionId)
      .populate('patientId', 'name email phone profile')
      .populate('doctorId', 'name email profile')
      .populate('appointmentId', 'appointment_date appointment_time');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    res.json({
      success: true,
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error fetching prescription details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescription details'
    });
  }
};

// ============================================
// 📌 UPDATE PRESCRIPTION (Doctor)
// ============================================
const updatePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const updateData = req.body;

    const prescription = await Prescription.findById(prescriptionId);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    // Check if prescription can be updated
    if (prescription.prescription_status === 'dispensed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a dispensed prescription'
      });
    }

    if (prescription.prescription_status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a cancelled prescription'
      });
    }

    // Allowed updates
    const allowedUpdates = [
      'diagnosis', 'disease', 'disease_code',
      'medications', 'patient_instructions',
      'non_medication_advice', 'lifestyle_advice',
      'dietary_restrictions', 'warnings',
      'follow_up_required', 'follow_up_date', 'follow_up_notes',
      'valid_until', 'refills_allowed', 'doctor_notes'
    ];

    let updated = false;
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'medications' && Array.isArray(updateData[field])) {
          // Validate medications
          prescription.medications = updateData[field].map(med => ({
            medicine_name: med.medicine_name?.trim() || '',
            strength: med.strength?.trim() || '',
            form: med.form || 'Tablet',
            quantity: med.quantity || 'As prescribed',
            dosage: med.dosage?.trim() || '',
            frequency: med.frequency?.trim() || '',
            duration: med.duration?.trim() || '',
            timing: med.timing || 'Any time',
            special_instructions: med.special_instructions || '',
            is_controlled: med.is_controlled || false
          }));
          updated = true;
        } else if (field === 'patient_instructions' && Array.isArray(updateData[field])) {
          prescription.patient_instructions = updateData[field].map(i => i.trim());
          updated = true;
        } else if (field === 'warnings' && Array.isArray(updateData[field])) {
          prescription.warnings = updateData[field].map(i => i.trim());
          updated = true;
        } else {
          prescription[field] = updateData[field];
          updated = true;
        }
      }
    });

    if (updateData.refills_allowed !== undefined) {
      // Reset refills_remaining to new value if increased
      const newRefills = parseInt(updateData.refills_allowed);
      if (newRefills > prescription.refills_remaining) {
        prescription.refills_remaining = newRefills;
      }
    }

    if (!updated) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    prescription.updatedAt = new Date();
    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription updated successfully',
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error updating prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prescription: ' + error.message
    });
  }
};

// ============================================
// 📌 DISPENSE PRESCRIPTION (Pharmacy/Admin)
// ============================================
const dispensePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { pharmacy_name, pharmacist_name, notes } = req.body;

    const prescription = await Prescription.findById(prescriptionId);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    if (prescription.prescription_status === 'dispensed') {
      return res.status(400).json({
        success: false,
        error: 'Prescription is already dispensed'
      });
    }

    if (prescription.prescription_status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot dispense a cancelled prescription'
      });
    }

    if (prescription.is_expired) {
      return res.status(400).json({
        success: false,
        error: 'Prescription has expired'
      });
    }

    // Update prescription
    prescription.prescription_status = 'dispensed';
    prescription.dispensed_at = new Date();
    prescription.updatedAt = new Date();
    
    // Decrease refills remaining
    if (prescription.refills_remaining > 0) {
      prescription.refills_remaining -= 1;
    }

    // Add dispense details
    prescription.doctor_notes = prescription.doctor_notes + 
      `\n[DISPENSED] by ${pharmacist_name || 'Pharmacy'} at ${pharmacy_name || 'Pharmacy'}`;

    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription dispensed successfully',
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error dispensing prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dispense prescription'
    });
  }
};

// ============================================
// 📌 CANCEL PRESCRIPTION (Doctor/Admin)
// ============================================
const cancelPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { reason } = req.body;

    const prescription = await Prescription.findById(prescriptionId);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    if (prescription.prescription_status === 'dispensed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a dispensed prescription'
      });
    }

    prescription.prescription_status = 'cancelled';
    prescription.cancelled_at = new Date();
    prescription.doctor_notes = prescription.doctor_notes + 
      `\n[CANCELLED] Reason: ${reason || 'Not specified'}`;
    prescription.updatedAt = new Date();

    await prescription.save();

    res.json({
      success: true,
      message: 'Prescription cancelled successfully',
      data: prescription
    });

  } catch (error) {
    console.error('❌ Error cancelling prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel prescription'
    });
  }
};

// ============================================
// 📌 GET PRESCRIPTION STATISTICS (Admin)
// ============================================
const getPrescriptionStats = async (req, res) => {
  try {
    const total = await Prescription.countDocuments();
    const active = await Prescription.countDocuments({ prescription_status: 'active' });
    const dispensed = await Prescription.countDocuments({ prescription_status: 'dispensed' });
    const expired = await Prescription.countDocuments({ prescription_status: 'expired' });
    const cancelled = await Prescription.countDocuments({ prescription_status: 'cancelled' });

    // Prescriptions by doctor
    const byDoctor = await Prescription.aggregate([
      {
        $group: {
          _id: '$doctor_name',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$prescription_status', 'active'] }, 1, 0] }
          },
          dispensed: {
            $sum: { $cond: [{ $eq: ['$prescription_status', 'dispensed'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Most prescribed medications
    const topMedications = await Prescription.aggregate([
      { $unwind: '$medications' },
      {
        $group: {
          _id: '$medications.medicine_name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Daily prescription trend (last 30 days)
    const last30Days = await Prescription.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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
        active,
        dispensed,
        expired,
        cancelled,
        byDoctor,
        topMedications,
        last30Days
      }
    });

  } catch (error) {
    console.error('❌ Error fetching prescription stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

module.exports = {
  createPrescription,
  getPatientPrescriptions,
  getDoctorPrescriptions,
  getPrescriptionDetails,
  updatePrescription,
  dispensePrescription,
  cancelPrescription,
  getPrescriptionStats
};