// scripts/cleanup-appointments.js
const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupAppointments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('appointments');

    // 1. Get all indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:', indexes.map(idx => idx.name));

    // 2. Drop appointmentId index if it exists
    try {
      await collection.dropIndex('appointmentId_1');
      console.log('✅ Dropped index: appointmentId_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️ Index appointmentId_1 not found');
      } else {
        throw error;
      }
    }

    // 3. Remove appointmentId field from all documents
    const result = await collection.updateMany(
      {},
      { $unset: { appointmentId: "" } }
    );
    console.log(`✅ Removed appointmentId field from ${result.modifiedCount} documents`);

    // 4. Create new indexes (optional)
    await collection.createIndex({ patientId: 1, appointment_status: 1 });
    await collection.createIndex({ patient_email: 1, appointment_status: 1 });
    await collection.createIndex({ doctor_email: 1, appointment_status: 1 });
    await collection.createIndex({ appointment_date: 1 });
    console.log('✅ Created new indexes');

    // 5. Verify final indexes
    const finalIndexes = await collection.indexes();
    console.log('📋 Final indexes:', finalIndexes.map(idx => idx.name));

    console.log('🎉 Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupAppointments();