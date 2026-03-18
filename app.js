const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/connectDB');
const authRoutes = require('./routes/authRoute');
const adminRoutes= require('./routes/adminRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const paymentRoutes= require('./routes/paymentRoutes');
const publicRoutes= require('./routes/publicRoutes');
// Initialize express app
const app = express();
connectDB();
const path = require('path');
const fs = require('fs'); 


const corsOptions = {
  origin: 'http://localhost:5173', 
  credentials: true, 
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments',paymentRoutes);
app.use('/api/public',publicRoutes);


// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT= 3000;
app.listen(PORT,()=>{
  console.log(`Server is running on http://localhost:${PORT}`);
})
