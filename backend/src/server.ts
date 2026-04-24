import express, { Request, Response } from 'express';
import cors from 'cors';
import { pool } from './db';

const app = express();
const PORT = 3006;

app.use(cors());
app.use(express.json());

// =======================
// PATIENTS API
// =======================
app.get('/api/patients', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM patients ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/patients', async (req: Request, res: Response) => {
  const { student_no, full_name, gender, birth_date, level_section, contact_no, emergency_contact_name, emergency_contact_no } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO patients (student_no, full_name, gender, birth_date, level_section, contact_no, emergency_contact_name, emergency_contact_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [student_no, full_name, gender, birth_date, level_section, contact_no, emergency_contact_name, emergency_contact_no]
    );
    res.status(201).json({ id: (result as any).insertId, message: 'Patient created successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// =======================
// MEDICINES INVENTORY API
// =======================
app.get('/api/medicines', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM medicines ORDER BY med_name ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/medicines', async (req: Request, res: Response) => {
  const { med_name, generic_name, category, unit, stock_qty, reorder_level, expiry_date } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO medicines (med_name, generic_name, category, unit, stock_qty, reorder_level, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [med_name, generic_name, category, unit, stock_qty, reorder_level, expiry_date]
    );
    res.status(201).json({ id: (result as any).insertId, message: 'Medicine created successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put('/api/medicines/:id/stock', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, transaction_type, action_type, remarks } = req.body; // transaction_type: IN/OUT

  try {
    await pool.query('START TRANSACTION');

    // Insert into ledger
    await pool.query(
      'INSERT INTO stock_ledger (medicine_id, transaction_type, quantity, action_type, remarks) VALUES (?, ?, ?, ?, ?)',
      [id, transaction_type, quantity, action_type, remarks]
    );

    // Update stock in medicines table
    const operator = transaction_type === 'IN' ? '+' : '-';
    await pool.query(`UPDATE medicines SET stock_qty = stock_qty ${operator} ? WHERE medicine_id = ?`, [quantity, id]);

    await pool.query('COMMIT');
    res.json({ message: 'Stock updated successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: (error as Error).message });
  }
});

// =======================
// CONSULTATIONS API
// =======================
app.get('/api/consultations', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, p.full_name, p.student_no 
      FROM consultations c 
      JOIN patients p ON c.patient_id = p.patient_id 
      ORDER BY c.visit_timestamp DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/consultations', async (req: Request, res: Response) => {
  const { patient_id, symptoms, treatment, remarks, vital_signs, followup_required } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO consultations (patient_id, symptoms, treatment, remarks, vital_signs, followup_required) VALUES (?, ?, ?, ?, ?, ?)',
      [patient_id, symptoms, treatment, remarks, JSON.stringify(vital_signs), followup_required ? 1 : 0]
    );
    res.status(201).json({ id: (result as any).insertId, message: 'Consultation recorded successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Clinic API Server running on http://localhost:${PORT}`);
});
