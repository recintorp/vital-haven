const express = require('express');
const connectToDb = require('../db/sqlserver');
const router = express.Router();

// POST /api/emails - Save request to Emails table
router.post('/', async (req, res) => {
  const { body } = req.body;
  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ message: 'Request body must not be empty.' });
  }
  try {
    const pool = await connectToDb();
    await pool.request()
      .input('Body', body)
      .query('INSERT INTO Emails (Body) VALUES (@Body)');
    res.status(201).json({ message: 'Request submitted successfully.' });
  } catch (err) {
    console.error('DB insert error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// GET /api/emails - Fetch all emails for inbox
router.get('/', async (req, res) => {
  try {
    const pool = await connectToDb();
    const result = await pool.request()
      .query('SELECT EmailID, Body FROM Emails ORDER BY EmailID DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('DB fetch error:', err);
    res.status(500).json({ message: 'Fetch error.' });
  }
});

module.exports = router;