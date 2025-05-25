const express = require('express');
const connectToDb = require('../db/sqlserver');
const router = express.Router();

// NOTE: This version stores passwords in plain text, per your requirement,
// but this is NOT RECOMMENDED for security reasons in any real-world scenario.

// POST: Register a new caregiver
router.post('/', async (req, res) => {
  const {
    StaffNumber,
    Password,
    Fullname,
    ContactNo,
    Email,
    AssignedResident,
    Shift
  } = req.body;

  // Validation (basic, should match your frontend)
  const errors = {};
  if (!StaffNumber || !/^N-\d{6}$/.test(StaffNumber)) {
    errors.StaffNumber = 'Staff number is required and must match format N-012025';
  }
  if (!Password || Password.length < 8) {
    errors.Password = 'Password is required and must be at least 8 characters';
  }
  if (!Fullname) errors.Fullname = 'Full name is required';
  if (!AssignedResident) errors.AssignedResident = 'Assigned resident is required';
  if (!Shift) errors.Shift = 'Shift is required';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  try {
    // Store the password as plain text (NOT recommended)
    const pool = await connectToDb();
    const request = pool.request();

    request.input('StaffNumber', StaffNumber);
    request.input('Password', Password);
    request.input('Fullname', Fullname);
    request.input('ContactNo', ContactNo || null);
    request.input('Email', Email || null);
    request.input('AssignedResident', AssignedResident);
    request.input('Shift', Shift);

    await request.query(`
      INSERT INTO Caregivers
        (StaffNumber, Password, Fullname, ContactNo, Email, AssignedResident, Shift)
      VALUES
        (@StaffNumber, @Password, @Fullname, @ContactNo, @Email, @AssignedResident, @Shift)
    `);

    res.status(201).json({ message: 'Caregiver registered successfully.' });
  } catch (err) {
    // Unique constraint error for StaffNumber
    if (err.originalError && err.originalError.info && err.originalError.info.number === 2627) {
      return res.status(409).json({ message: 'Staff number already exists.' });
    }
    console.error('DB insert error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// POST: Caregiver/Admin Login (support both admin and caregivers)
router.post('/login', async (req, res) => {
  const { StaffNumber, Password } = req.body;
  if (!StaffNumber || !Password) {
    return res.status(400).json({ message: 'StaffNumber and Password are required.' });
  }

  // Hardcoded admin login
  if (StaffNumber === 'admin' && Password === '1234') {
    return res.status(200).json({ message: 'Admin login successful.' });
  }

  try {
    const pool = await connectToDb();
    const result = await pool.request()
      .input('StaffNumber', StaffNumber)
      .input('Password', Password)
      .query('SELECT * FROM Caregivers WHERE StaffNumber = @StaffNumber AND Password = @Password');

    if (result.recordset.length === 1) {
      // Return the StaffNumber in result for frontend use
      return res.status(200).json({ message: 'Login successful.', StaffNumber: result.recordset[0].StaffNumber });
    }
    return res.status(401).json({ message: 'Invalid credentials.' });
  } catch (err) {
    console.error('DB login error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// GET: Fetch all caregivers for the logs table (INCLUDE PASSWORD)
router.get('/', async (req, res) => {
  try {
    const pool = await connectToDb();
    const result = await pool.request().query(
      'SELECT StaffNumber, Password, Fullname, ContactNo, Email, AssignedResident, Shift FROM Caregivers'
    );
    res.json(result.recordset);
  } catch (err) {
    console.error('DB fetch error:', err);
    res.status(500).json({ message: 'Server error fetching caregivers.' });
  }
});

// GET: Fetch a single caregiver by StaffNumber
router.get('/:StaffNumber', async (req, res) => {
  const StaffNumber = req.params.StaffNumber;
  try {
    const pool = await connectToDb();
    const result = await pool.request()
      .input('StaffNumber', StaffNumber)
      .query('SELECT StaffNumber, Password, Fullname, ContactNo, Email, AssignedResident, Shift FROM Caregivers WHERE StaffNumber = @StaffNumber');
    if (!result.recordset.length) {
      return res.status(404).json({ message: 'Caregiver not found.' });
    }
    // Send password as is for admin viewing/editing
    const caregiver = result.recordset[0];
    caregiver.Password = caregiver.Password || ""; // for frontend compatibility
    res.json(caregiver);
  } catch (err) {
    res.status(500).json({ message: 'Database error.' });
  }
});

// PUT: Update caregiver by StaffNumber
router.put('/:StaffNumber', async (req, res) => {
  const StaffNumber = req.params.StaffNumber;
  const {
    Password,
    Fullname,
    ContactNo,
    Email,
    AssignedResident,
    Shift
  } = req.body;

  // Validation (basic, should match your frontend)
  const errors = {};
  if (!Password || Password.length < 8) {
    errors.Password = 'Password is required and must be at least 8 characters';
  }
  if (!Fullname) errors.Fullname = 'Full name is required';
  if (!AssignedResident) errors.AssignedResident = 'Assigned resident is required';
  if (!Shift) errors.Shift = 'Shift is required';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  try {
    // Store the password as plain text (NOT recommended)
    const pool = await connectToDb();
    await pool.request()
      .input('StaffNumber', StaffNumber)
      .input('Password', Password)
      .input('Fullname', Fullname)
      .input('ContactNo', ContactNo || null)
      .input('Email', Email || null)
      .input('AssignedResident', AssignedResident)
      .input('Shift', Shift)
      .query(`
        UPDATE Caregivers SET
          Password = @Password,
          Fullname = @Fullname,
          ContactNo = @ContactNo,
          Email = @Email,
          AssignedResident = @AssignedResident,
          Shift = @Shift
        WHERE StaffNumber = @StaffNumber
      `);
    res.json({ message: 'Caregiver updated.' });
  } catch (err) {
    console.error('DB update error:', err);
    res.status(500).json({ message: 'Update failed.' });
  }
});

// DELETE: Delete caregiver by StaffNumber
router.delete('/:StaffNumber', async (req, res) => {
  const StaffNumber = req.params.StaffNumber;
  try {
    const pool = await connectToDb();
    await pool.request()
      .input('StaffNumber', StaffNumber)
      .query('DELETE FROM Caregivers WHERE StaffNumber = @StaffNumber');
    res.json({ message: 'Caregiver deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed.' });
  }
});

module.exports = router;