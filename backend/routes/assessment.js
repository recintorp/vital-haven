const express = require('express');
const router = express.Router();
const connectToDb = require('../db/sqlserver');

// GET: Fetch recent health assessments for a caregiver's assigned residents
router.get('/', async (req, res) => {
  const staffNumber = req.query.staffNumber;
  const search = req.query.q || "";

  if (!staffNumber) {
    return res.status(400).json({ message: "Missing staffNumber parameter." });
  }

  try {
    const pool = await connectToDb();

    // Get all residents assigned to this caregiver
    const residentsResult = await pool.request()
      .input('AssignedCaregiver', staffNumber)
      .query('SELECT ResidentID, Fullname FROM Residents WHERE AssignedCaregiver = @AssignedCaregiver');

    const residents = residentsResult.recordset;

    if (!residents.length) {
      return res.json([]); // No assigned residents
    }

    const residentIds = residents.map(r => r.ResidentID);

    // If there are no resident IDs, return empty array
    if (!residentIds.length) {
      return res.json([]);
    }

    // Dynamically build parameterized query for resident IDs
    let query = `
      SELECT 
        a.AssessmentID,
        a.ResidentID,
        r.Fullname,
        a.StaffNumber,
        a.AssessmentDate,
        a.Notes
      FROM HealthAssessments a
      INNER JOIN Residents r ON a.ResidentID = r.ResidentID
      WHERE 
        (${residentIds.map((_, i) => `a.ResidentID = @id${i}`).join(' OR ')})
    `;

    // Optional search filter
    if (search) {
      query += " AND (r.Fullname LIKE @search OR a.Notes LIKE @search)";
    }
    query += " ORDER BY a.AssessmentDate DESC";

    const request = pool.request();
    residentIds.forEach((id, i) => request.input(`id${i}`, id));
    if (search) request.input('search', `%${search}%`);

    const result = await request.query(query);

    res.json(result.recordset);
  } catch (err) {
    console.error('DB assessment fetch error:', err);
    res.status(500).json({ message: 'Server error fetching assessments.' });
  }
});

// POST: Add a new health assessment
router.post('/', async (req, res) => {
  const { ResidentID, StaffNumber, Notes } = req.body;

  if (
    !ResidentID ||
    !StaffNumber ||
    !Notes ||
    !Notes.toString().trim()
  ) {
    return res.status(400).json({ message: "Resident, StaffNumber, and Notes are required." });
  }

  try {
    const pool = await connectToDb();
    await pool.request()
      .input('ResidentID', ResidentID)
      .input('StaffNumber', StaffNumber)
      .input('AssessmentDate', new Date())
      .input('Notes', Notes.toString().trim())
      .query(`
        INSERT INTO HealthAssessments (ResidentID, StaffNumber, AssessmentDate, Notes)
        VALUES (@ResidentID, @StaffNumber, @AssessmentDate, @Notes)
      `);
    res.status(201).json({ message: 'Assessment saved successfully.' });
  } catch (err) {
    console.error('DB assessment insert error:', err);
    res.status(500).json({ message: 'Server error saving assessment.' });
  }
});

module.exports = router;