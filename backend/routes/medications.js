const express = require('express');
const router = express.Router();
const connectToDb = require('../db/sqlserver');

// GET: Fetch medications for residents assigned to this caregiver
router.get('/', async (req, res) => {
  const StaffNumber = req.query.staffNumber; // Use capital S everywhere for consistency
  const residentId = req.query.residentId;
  const status = req.query.status;
  const search = req.query.q || "";

  if (!StaffNumber) {
    return res.status(400).json({ message: "Missing staffNumber parameter." });
  }

  try {
    const pool = await connectToDb();

    // Get assigned residents for this caregiver
    const residentsResult = await pool.request()
      .input('AssignedCaregiver', StaffNumber)
      .query('SELECT ResidentID, Fullname FROM Residents WHERE AssignedCaregiver = @AssignedCaregiver');

    const residents = residentsResult.recordset;
    if (!residents.length) return res.json([]);

    const residentIds = residents.map(r => r.ResidentID);
    if (!residentIds.length) return res.json([]);

    // Build dynamic WHERE clause for resident IDs
    let whereClause = residentIds.map((_, i) => `m.ResidentID = @id${i}`).join(' OR ');
    if (whereClause) {
      whereClause = `(${whereClause})`;
    } else {
      return res.json([]);
    }

    let query = `
      SELECT 
        m.MedicationID,
        m.ResidentID,
        r.Fullname,
        m.MedicationName,
        m.Dosage,
        -- Use raw time from database for flexibility (frontend will format to 12h if needed)
        m.Time,
        m.Frequency,
        m.Priority,
        m.LastAdministered
      FROM Medication m
      INNER JOIN Residents r ON m.ResidentID = r.ResidentID
      WHERE ${whereClause}
    `;

    const request = pool.request();
    residentIds.forEach((id, i) => request.input(`id${i}`, id));

    if (residentId) {
      query += ' AND m.ResidentID = @residentId';
      request.input('residentId', residentId);
    }
    if (status) {
      query += ' AND m.Status = @status';
      request.input('status', status);
    }
    if (search) {
      query += ' AND (m.MedicationName LIKE @search OR m.Dosage LIKE @search OR r.Fullname LIKE @search)';
      request.input('search', `%${search}%`);
    }
    query += ' ORDER BY m.Time ASC';

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('DB medication fetch error:', err);
    res.status(500).json({ message: 'Server error fetching medications.' });
  }
});

// POST: Add a new medication
router.post('/', async (req, res) => {
  const {
    ResidentID,
    StaffNumber,
    MedicationName,
    Dosage,
    Time,
    Frequency,
    Priority,
    LastAdministered
  } = req.body;

  // Minimal validation
  if (
    !ResidentID ||
    !StaffNumber ||
    !MedicationName ||
    !Dosage ||
    !Time ||
    !Frequency ||
    !Priority
  ) {
    return res.status(400).json({ message: "All required fields must be provided." });
  }

  try {
    const pool = await connectToDb();
    await pool.request()
      .input('ResidentID', ResidentID)
      .input('StaffNumber', StaffNumber)
      .input('MedicationName', MedicationName)
      .input('Dosage', Dosage)
      .input('Time', Time)
      .input('Frequency', Frequency)
      .input('Priority', Priority)
      .input('LastAdministered', LastAdministered || null)
      .query(`
        INSERT INTO Medication
          (ResidentID, StaffNumber, MedicationName, Dosage, Time, Frequency, Priority, LastAdministered)
        VALUES
          (@ResidentID, @StaffNumber, @MedicationName, @Dosage, @Time, @Frequency, @Priority, @LastAdministered)
      `);
    res.status(201).json({ message: 'Medication added successfully.' });
  } catch (err) {
    console.error('DB medication insert error:', err);
    res.status(500).json({ message: 'Server error adding medication.' });
  }
});

// PUT: Update medication by MedicationID
router.put('/:id', async (req, res) => {
  const medicationId = req.params.id;
  const {
    MedicationName,
    Dosage,
    Time,
    Frequency,
    Priority,
    LastAdministered
  } = req.body;

  if (!medicationId) {
    return res.status(400).json({ message: "MedicationID is required." });
  }

  try {
    const pool = await connectToDb();
    await pool.request()
      .input('MedicationID', medicationId)
      .input('MedicationName', MedicationName)
      .input('Dosage', Dosage)
      .input('Time', Time)
      .input('Frequency', Frequency)
      .input('Priority', Priority)
      .input('LastAdministered', LastAdministered || null)
      .query(`
        UPDATE Medication SET
          MedicationName = @MedicationName,
          Dosage = @Dosage,
          Time = @Time,
          Frequency = @Frequency,
          Priority = @Priority,
          LastAdministered = @LastAdministered
        WHERE MedicationID = @MedicationID
      `);
    res.json({ message: 'Medication updated successfully.' });
  } catch (err) {
    console.error('DB medication update error:', err);
    res.status(500).json({ message: 'Server error updating medication.' });
  }
});

// DELETE: Delete medication by MedicationID
router.delete('/:id', async (req, res) => {
  const medicationId = req.params.id;
  if (!medicationId) {
    return res.status(400).json({ message: "MedicationID is required." });
  }

  try {
    const pool = await connectToDb();
    await pool.request()
      .input('MedicationID', medicationId)
      .query('DELETE FROM Medication WHERE MedicationID = @MedicationID');
    res.json({ message: 'Medication deleted successfully.' });
  } catch (err) {
    console.error('DB medication delete error:', err);
    res.status(500).json({ message: 'Server error deleting medication.' });
  }
});

module.exports = router;