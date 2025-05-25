const express = require('express');
const router = express.Router();
const connectToDb = require('../db/sqlserver');
const multer = require('multer');
const fs = require('fs');

// File upload setup
const upload = multer({
  dest: 'uploads/', // Make sure this directory exists, or change as needed
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// GET: Fetch all residents, or filter by AssignedCaregiver (StaffNumber) if provided
router.get('/', async (req, res) => {
  try {
    const AssignedCaregiver = req.query.AssignedCaregiver || req.query.StaffNumber;
    const pool = await connectToDb();
    let query = 'SELECT ResidentID, Fullname, DateOfBirth, Gender, MedicalFilePath, ContactNo, AssignedCaregiver FROM Residents';
    let result;
    if (AssignedCaregiver) {
      query += ' WHERE AssignedCaregiver = @AssignedCaregiver';
      result = await pool.request()
        .input('AssignedCaregiver', AssignedCaregiver)
        .query(query);
    } else {
      result = await pool.request().query(query);
    }
    res.json(result.recordset);
  } catch (err) {
    console.error('DB fetch error:', err);
    res.status(500).json({ message: 'Server error fetching residents.' });
  }
});

// GET: Fetch a single resident by ResidentID
router.get('/:id', async (req, res) => {
  const residentId = req.params.id;
  try {
    const pool = await connectToDb();
    const result = await pool.request()
      .input('ResidentID', residentId)
      .query('SELECT ResidentID, Fullname, DateOfBirth, Gender, MedicalFilePath, ContactNo, AssignedCaregiver FROM Residents WHERE ResidentID = @ResidentID');
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Resident not found.' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('DB fetch error:', err);
    res.status(500).json({ message: 'Server error fetching resident.' });
  }
});

// DELETE: Delete a resident by ResidentID
router.delete('/:id', async (req, res) => {
  const residentId = req.params.id;

  try {
    const pool = await connectToDb();

    // Optional: Get medical file path before deletion
    const result = await pool.request()
      .input('ResidentID', residentId)
      .query('SELECT MedicalFilePath FROM Residents WHERE ResidentID = @ResidentID');
    const medicalFilePath = result.recordset[0] ? result.recordset[0].MedicalFilePath : null;

    // Delete the resident
    await pool.request()
      .input('ResidentID', residentId)
      .query('DELETE FROM Residents WHERE ResidentID = @ResidentID');

    // Delete the file if it exists
    if (medicalFilePath && fs.existsSync(medicalFilePath)) {
      try {
        fs.unlinkSync(medicalFilePath);
      } catch (e) {
        console.warn('Could not delete file:', medicalFilePath, e.message);
      }
    }

    res.json({ message: 'Resident deleted successfully.' });
  } catch (err) {
    console.error('DB delete error:', err);
    res.status(500).json({ message: 'Error deleting resident.' });
  }
});

// POST: Register a new resident
router.post('/', upload.single('MedicalFilePath'), async (req, res) => {
  // Accept PascalCase and camelCase body fields for compatibility
  const fullname = req.body.Fullname || req.body.fullname;
  const dateOfBirth = req.body.DateOfBirth || req.body.dateOfBirth;
  const gender = req.body.Gender || req.body.gender;
  const contactNo = req.body.ContactNo || req.body.contactNo;
  const AssignedCaregiver = req.body.AssignedCaregiver || req.body.assignedCaregiver;

  // Validation
  const errors = {};
  if (!fullname || !fullname.trim()) errors.Fullname = "Full name is required";
  if (!dateOfBirth) errors.DateOfBirth = "Date of birth is required";
  if (!gender) errors.Gender = "Gender is required";
  if (!AssignedCaregiver) errors.AssignedCaregiver = "Assigned caregiver is required";
  if (!req.file) errors.MedicalFilePath = "Medical file is required";

  let medicalFilePath = null;
  if (req.file) {
    medicalFilePath = req.file.path;
  }

  if (Object.keys(errors).length > 0) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: "Validation failed", errors });
  }

  try {
    const pool = await connectToDb();
    await pool.request()
      .input('Fullname', fullname.trim())
      .input('DateOfBirth', dateOfBirth)
      .input('Gender', gender)
      .input('MedicalFilePath', medicalFilePath)
      .input('ContactNo', contactNo || null)
      .input('AssignedCaregiver', AssignedCaregiver)
      .query(`
        INSERT INTO Residents
          (Fullname, DateOfBirth, Gender, MedicalFilePath, ContactNo, AssignedCaregiver)
        VALUES
          (@Fullname, @DateOfBirth, @Gender, @MedicalFilePath, @ContactNo, @AssignedCaregiver)
      `);

    res.status(201).json({ message: 'Resident registered successfully.' });
  } catch (err) {
    console.error('DB insert error:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Database error.' });
  }
});

// PUT: Update a resident by ResidentID
router.put('/:id', upload.single('MedicalFilePath'), async (req, res) => {
  const residentId = req.params.id;
  const fullname = req.body.Fullname || req.body.fullname;
  const dateOfBirth = req.body.DateOfBirth || req.body.dateOfBirth;
  const gender = req.body.Gender || req.body.gender;
  const contactNo = req.body.ContactNo || req.body.contactNo;
  const AssignedCaregiver = req.body.AssignedCaregiver || req.body.assignedCaregiver;

  let medicalFilePath = null;
  if (req.file) {
    medicalFilePath = req.file.path;
  }

  // Validation for update (required fields)
  const errors = {};
  if (!fullname || !fullname.trim()) errors.Fullname = "Full name is required";
  if (!dateOfBirth) errors.DateOfBirth = "Date of birth is required";
  if (!gender) errors.Gender = "Gender is required";
  if (!AssignedCaregiver) errors.AssignedCaregiver = "Assigned caregiver is required";

  if (Object.keys(errors).length > 0) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: "Validation failed", errors });
  }

  // Fetch the old file path
  let oldFilePath = null;
  try {
    const pool = await connectToDb();
    const fetchResult = await pool.request()
      .input('ResidentID', residentId)
      .query('SELECT MedicalFilePath FROM Residents WHERE ResidentID = @ResidentID');
    if (fetchResult.recordset.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Resident not found.' });
    }
    oldFilePath = fetchResult.recordset[0].MedicalFilePath;

    // Build update query assignments dynamically
    const assignments = [
      "Fullname = @Fullname",
      "DateOfBirth = @DateOfBirth",
      "Gender = @Gender"
    ];
    if (medicalFilePath) assignments.push("MedicalFilePath = @MedicalFilePath");
    assignments.push("ContactNo = @ContactNo");
    assignments.push("AssignedCaregiver = @AssignedCaregiver");

    const updateQuery = `
      UPDATE Residents SET
        ${assignments.join(",\n        ")}
      WHERE ResidentID = @ResidentID
    `;

    const request = pool.request()
      .input('ResidentID', residentId)
      .input('Fullname', fullname.trim())
      .input('DateOfBirth', dateOfBirth)
      .input('Gender', gender)
      .input('ContactNo', contactNo || null)
      .input('AssignedCaregiver', AssignedCaregiver);

    if (medicalFilePath) request.input('MedicalFilePath', medicalFilePath);

    await request.query(updateQuery);

    // Delete old file if a new one was uploaded
    if (medicalFilePath && oldFilePath && fs.existsSync(oldFilePath)) {
      try {
        fs.unlinkSync(oldFilePath);
      } catch (e) {
        console.warn('Could not delete old file:', oldFilePath, e.message);
      }
    }

    res.json({ message: 'Resident updated successfully.' });
  } catch (err) {
    console.error('DB update error:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Error updating resident.' });
  }
});

module.exports = router;