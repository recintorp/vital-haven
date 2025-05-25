const express = require('express');
const router = express.Router();
const connectToDb = require('../db/sqlserver');

// GET: Fetch activity logs (all or by StaffNumber)
router.get('/', async (req, res) => {
  const { staffNumber } = req.query;
  try {
    const pool = await connectToDb();
    let query = 'SELECT LogID, StaffNumber, Activity, Details, Timestamp FROM ActivityLog';
    if (staffNumber) {
      query += ' WHERE StaffNumber = @StaffNumber';
    }
    query += ' ORDER BY Timestamp DESC';
    const request = pool.request();
    if (staffNumber) request.input('StaffNumber', staffNumber);
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('ActivityLog fetch error:', err);
    res.status(500).json({ message: 'Error fetching activity logs.' });
  }
});

// POST: Add a new activity log entry
router.post('/', async (req, res) => {
  const { staffNumber, activity, details } = req.body;
  if (!staffNumber || !activity) {
    return res.status(400).json({ message: 'StaffNumber and Activity are required.' });
  }
  try {
    const pool = await connectToDb();
    await pool.request()
      .input('StaffNumber', staffNumber)
      .input('Activity', activity)
      .input('Details', details || null)
      .query(`
        INSERT INTO ActivityLog (StaffNumber, Activity, Details)
        VALUES (@StaffNumber, @Activity, @Details)
      `);
    res.status(201).json({ message: 'Activity log created.' });
  } catch (err) {
    console.error('ActivityLog insert error:', err);
    res.status(500).json({ message: 'Error creating activity log.' });
  }
});

module.exports = router;