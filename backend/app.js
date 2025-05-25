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

// Print __dirname and static path to help debug directory issues
console.log('__dirname:', __dirname);

const staticDir = path.join(__dirname, '..', 'frontend');
console.log('Static files served from:', staticDir);

if (!fs.existsSync(staticDir)) {
    console.error('ERROR: Static directory does not exist:', staticDir);
    process.exit(1);
}

app.use(express.json());

// Serve frontend statically
app.use(express.static(staticDir));

// Serve uploads directory statically for file downloads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API route for caregivers
app.use('/api/caregivers', caregiversRouter);

// API route for emails
app.use('/api/emails', emailsRouter);

// API route for residents
app.use('/api/residents', residentsRouter);

// API route for assessments
app.use('/api/assessments', assessmentRouter);

// API route for medications
app.use('/api/medications', medicationsRouter);

// API route for activity log
app.use('/api/activity-log', activityLogRouter);

// Simple DB test route (for debugging connection)
app.get('/test-db', async (req, res) => {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query('SELECT GETDATE() AS CurrentTime');
        res.json({ dbTime: result.recordset[0].CurrentTime });
    } catch (err) {
        res.status(500).send('Database connection failed: ' + err.message);
    }
});

// Home route to test server
app.get('/', (req, res) => {
    res.send('VitalHaven backend running. Try /form.html');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});