// scripts/cleanup-database.js
const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function cleanupDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Cleanup Appointments
    console.log('\n📋 Cleaning up appointments...');
    const appointments = db.collection('appointments');
    try {
      await appointments.dropIndex('appointmentId_1');
      console.log('✅ Dropped appointmentId_1 index');
    } catch (error) {
      console.log('ℹ️ appointmentId_1 index not found');
    }
    await appointments.updateMany({}, { $unset: { appointmentId: "" } });
    console.log('✅ Removed appointmentId field');

    // Cleanup Test Reports
    console.log('\n📋 Cleaning up testreports...');
    const testReports = db.collection('testreports');
    try {
      await testReports.dropIndex('reportId_1');
      console.log('✅ Dropped reportId_1 index');
    } catch (error) {
      console.log('ℹ️ reportId_1 index not found');
    }
    await testReports.updateMany({}, { $unset: { reportId: "" } });
    console.log('✅ Removed reportId field');

    console.log('\n🎉 Database cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupDatabase();