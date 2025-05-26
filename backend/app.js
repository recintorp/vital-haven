require('dotenv').config();
const express = require('express');
const connectToDb = require('./db/sqlserver');
const caregiversRouter = require('./routes/caregivers');
const emailsRouter = require('./routes/emails');
const residentsRouter = require('./routes/residents');
const assessmentRouter = require('./routes/assessment');
const medicationsRouter = require('./routes/medications');
const activityLogRouter = require('./routes/activitylog');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

// Debug: Print __dirname and static path
console.log('__dirname:', __dirname);

const staticDir = path.join(__dirname, '..', 'frontend');
console.log('Static files served from:', staticDir);

if (!fs.existsSync(staticDir)) {
    console.error('ERROR: Static directory does not exist:', staticDir);
    process.exit(1);
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
}

app.use(express.json());

// (Optional) Enable CORS if needed
// const cors = require('cors');
// app.use(cors());

app.use(express.static(staticDir)); // Serve frontend statically
app.use('/uploads', express.static(uploadsDir)); // Serve uploads directory

// API routes
app.use('/api/caregivers', caregiversRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/residents', residentsRouter);
app.use('/api/assessments', assessmentRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/activity-log', activityLogRouter);

// DB test route
app.get('/test-db', async (req, res) => {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query('SELECT GETDATE() AS CurrentTime');
        res.json({ dbTime: result.recordset[0].CurrentTime });
    } catch (err) {
        res.status(500).send('Database connection failed: ' + err.message);
    }
});

// Home route
app.get('/', (req, res) => {
    res.send('VitalHaven backend running. Try /form.html');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});