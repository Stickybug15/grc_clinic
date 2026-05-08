import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool } from './db';
import fs from 'fs';

const sanitizeError = (error: any): string => {
  const msg = error.message || String(error);
  // Log real error for internal debugging
  console.error('[Internal Error]', error);
  
  // Let safe validation errors pass
  if (msg.includes('Insufficient stock') || msg.includes('not found')) {
    return msg;
  }
  
  // Hide SQL/database errors
  if (msg.includes('CONSTRAINT') || msg.includes('ER_') || msg.includes('SQL') || msg.includes('mysql') || msg.includes('database')) {
    return 'A system error occurred while processing your request. Please try again or contact support.';
  }
  
  return msg;
};

const app = express();
const PORT = 3006;

// 1. Security Headers Middleware
app.use(helmet());

// 2. Strict CORS Configuration (Only allow the frontend URL)
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. API Rate Limiting (Prevent DDoS / Brute Force)
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 200, // Limit each IP to 200 requests per `window`
  message: { error: 'Too many requests from this IP, please try again after 10 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter to all /api routes
app.use('/api', limiter);

app.use(express.json());

app.get('/api/schema', async (req: Request, res: Response) => {
  try {
    const [meds] = await pool.query('DESCRIBE medicines');
    let stockLedger = 'Not found';
    try {
       const [sl] = await pool.query('DESCRIBE stock_ledger');
       stockLedger = sl as any;
    } catch(e) {}
    
    let dispRecs = 'Not found';
    try {
       const [dr] = await pool.query('DESCRIBE dispensing_records');
       dispRecs = dr as any;
    } catch(e) {}
    
    res.json({ medicines: meds, stock_ledger: stockLedger, dispensing_records: dispRecs });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// =======================
// PATIENTS API
// =======================
app.get('/api/patients', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.patient_id, p.student_no, p.first_name, p.last_name, p.middle_name,
             p.level_section, p.birth_date, p.gender, p.guardian_name,
             p.guardian_contact, p.medical_background, p.is_enrolled,
             p.created_at, p.updated_at,
             COUNT(c.consult_id) AS visit_count,
             MAX(c.visit_timestamp) AS last_visit
      FROM patients p
      LEFT JOIN consultations c ON p.patient_id = c.patient_id
      GROUP BY p.patient_id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.post('/api/patients', async (req: Request, res: Response) => {
  const { student_no, full_name, gender, birth_date, level_section, emergency_contact_name, emergency_contact_no } = req.body;
  const nameParts = full_name ? full_name.split(' ') : [];
  const first_name = nameParts[0] || '';
  const last_name = nameParts.slice(1).join(' ') || '';
  try {
    const [result] = await pool.query(
      'INSERT INTO patients (student_no, first_name, last_name, gender, birth_date, level_section, guardian_name, guardian_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [student_no, first_name, last_name, gender, birth_date, level_section, emergency_contact_name, emergency_contact_no]
    );
    res.status(201).json({ id: (result as any).insertId, message: 'Patient created successfully' });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.get('/api/patients/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM patients WHERE patient_id = ?', [id]);
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const [visitRows] = await pool.query('SELECT COUNT(*) AS visit_count, MAX(visit_timestamp) AS last_visit FROM consultations WHERE patient_id = ?', [id]);
    const patient = (rows as any[])[0];
    const visitData = (visitRows as any[])[0] || { visit_count: 0, last_visit: null };
    patient.visit_count = Number(visitData.visit_count || 0);
    patient.last_visit = visitData.last_visit || null;
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.put('/api/patients/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { student_no, full_name, gender, birth_date, level_section, emergency_contact_name, emergency_contact_no } = req.body;
  const nameParts = full_name ? full_name.split(' ') : [];
  const first_name = nameParts[0] || '';
  const last_name = nameParts.slice(1).join(' ') || '';
  try {
    const [result] = await pool.query(
      'UPDATE patients SET student_no = ?, first_name = ?, last_name = ?, gender = ?, birth_date = ?, level_section = ?, guardian_name = ?, guardian_contact = ? WHERE patient_id = ?',
      [student_no, first_name, last_name, gender, birth_date, level_section, emergency_contact_name, emergency_contact_no, id]
    );
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({ message: 'Patient updated successfully' });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.delete('/api/patients/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM patients WHERE patient_id = ?', [id]);
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
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
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.post('/api/medicines', async (req: Request, res: Response) => {
  const { med_name, generic_name, category, unit, stock_qty, reorder_level, expiry_date } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO medicines (med_name, med_desc, category, unit, stock_qty, reorder_threshold, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [med_name, generic_name || '', category || 'other', unit || 'piece', stock_qty, reorder_level, expiry_date]
    );
    res.status(201).json({ id: (result as any).insertId, message: 'Medicine created successfully' });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.put('/api/medicines/:id/stock', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, transaction_type, action_type, remarks } = req.body;

  try {
    await pool.query('START TRANSACTION');

    // Get current stock
    const [medRows] = await pool.query('SELECT stock_qty FROM medicines WHERE medicine_id = ?', [id]);
    const currentStock = (medRows as any)[0].stock_qty;

    const qty = Number(quantity);
    const operator = transaction_type === 'IN' ? 1 : -1;
    const quantity_change = qty * operator;
    const stock_after = currentStock + quantity_change;

    if (stock_after < 0) {
      throw new Error(`Insufficient stock! Cannot perform transaction (Current stock: ${currentStock}, Attempted to remove: ${qty}).`);
    }

    // Map action type
    let db_action = 'adjustment';
    if (action_type === 'Restock') db_action = 'restock';
    if (action_type === 'Dispensed') db_action = 'dispense';
    if (action_type === 'Expired') db_action = 'expired_removal';

    // Insert into ledger
    await pool.query(
      'INSERT INTO stock_ledger (medicine_id, action, quantity_change, stock_after, notes) VALUES (?, ?, ?, ?, ?)',
      [id, db_action, quantity_change, stock_after, remarks || null]
    );

    // Update stock in medicines table
    await pool.query(`UPDATE medicines SET stock_qty = ? WHERE medicine_id = ?`, [stock_after, id]);

    await pool.query('COMMIT');
    res.json({ message: 'Stock updated successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.get('/api/medicines/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM medicines WHERE medicine_id = ?', [id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Medicine not found' });
    res.json((rows as any[])[0]);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.put('/api/medicines/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { med_name, generic_name, category, unit, reorder_level, expiry_date } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE medicines SET med_name = ?, med_desc = ?, category = ?, unit = ?, reorder_threshold = ?, expiry_date = ? WHERE medicine_id = ?',
      [med_name, generic_name, category, unit, reorder_level, expiry_date, id]
    );
    if ((result as any).affectedRows === 0) return res.status(404).json({ error: 'Medicine not found' });
    res.json({ message: 'Medicine updated successfully' });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.delete('/api/medicines/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const [medicineRows] = await pool.query('SELECT medicine_id, stock_qty FROM medicines WHERE medicine_id = ?', [id]);
    if ((medicineRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const medicine = (medicineRows as any[])[0];
    if (medicine.stock_qty > 0) {
      return res.status(409).json({ error: 'Cannot delete medicine while stock quantity is greater than zero. Set stock to 0 before deleting.' });
    }

    await pool.query('START TRANSACTION');
    await pool.query('DELETE FROM stock_ledger WHERE medicine_id = ?', [id]);
    await pool.query('DELETE FROM dispensing_records WHERE medicine_id = ?', [id]);
    const [result] = await pool.query('DELETE FROM medicines WHERE medicine_id = ?', [id]);
    if ((result as any).affectedRows === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Medicine not found' });
    }
    await pool.query('COMMIT');

    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.get('/api/inventory-movements', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT sl.*, m.med_name, m.unit 
      FROM stock_ledger sl 
      JOIN medicines m ON sl.medicine_id = m.medicine_id 
      ORDER BY sl.recorded_at DESC LIMIT 5
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.get('/api/inventory-movements/all', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT sl.*, m.med_name, m.unit 
      FROM stock_ledger sl 
      JOIN medicines m ON sl.medicine_id = m.medicine_id 
      ORDER BY sl.recorded_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// =======================
// CONSULTATIONS API
// =======================
app.get('/api/consultations', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, c.consult_id AS consultation_id, CONCAT(p.first_name, ' ', p.last_name) AS full_name, p.student_no 
      FROM consultations c 
      JOIN patients p ON c.patient_id = p.patient_id 
      ORDER BY c.visit_timestamp DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.post('/api/consultations', async (req: Request, res: Response) => {
  const { patient_id, symptoms, treatment, remarks, vital_signs, followup_required, dispensed_medicines } = req.body;
  try {
    await pool.query('START TRANSACTION');

    const [result] = await pool.query(
      'INSERT INTO consultations (patient_id, symptoms, treatment, remarks, vital_signs, followup_required) VALUES (?, ?, ?, ?, ?, ?)',
      [patient_id, symptoms, treatment, remarks, JSON.stringify(vital_signs), followup_required ? 1 : 0]
    );
    const consultId = (result as any).insertId;

    if (dispensed_medicines && Array.isArray(dispensed_medicines) && dispensed_medicines.length > 0) {
      for (const med of dispensed_medicines) {
        // 1. Verify stock
        const [medRows] = await pool.query('SELECT stock_qty FROM medicines WHERE medicine_id = ? FOR UPDATE', [med.medicine_id]);
        if ((medRows as any[]).length === 0) throw new Error(`Medicine ID ${med.medicine_id} not found.`);
        const currentStock = (medRows as any)[0].stock_qty;

        if (currentStock < med.qty) {
          throw new Error(`Insufficient stock for medicine ID ${med.medicine_id}. (Current: ${currentStock}, Requested: ${med.qty})`);
        }

        // 2. Insert into dispensing_records
        const [dispenseResult] = await pool.query(
          'INSERT INTO dispensing_records (consult_id, medicine_id, qty_issued, dosage_instructions) VALUES (?, ?, ?, ?)',
          [consultId, med.medicine_id, med.qty, med.dosage]
        );
        const dispensingId = (dispenseResult as any).insertId;

        // 3. Insert into stock_ledger
        const stockAfter = currentStock - med.qty;
        await pool.query(
          'INSERT INTO stock_ledger (medicine_id, action, quantity_change, stock_after, dispensing_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [med.medicine_id, 'dispense', -med.qty, stockAfter, dispensingId, `Dispensed to patient during consultation #${consultId}`]
        );

        // 4. Update medicines table
        await pool.query('UPDATE medicines SET stock_qty = ? WHERE medicine_id = ?', [stockAfter, med.medicine_id]);
      }
    }

    await pool.query('COMMIT');
    res.status(201).json({ id: consultId, message: 'Consultation recorded successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.get('/api/consultations/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`
      SELECT c.*, c.consult_id AS consultation_id,
             CONCAT(p.first_name, ' ', p.last_name) AS full_name,
             p.student_no
      FROM consultations c
      JOIN patients p ON c.patient_id = p.patient_id
      WHERE c.consult_id = ?
    `, [id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Consultation not found' });
    res.json((rows as any[])[0]);
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.put('/api/consultations/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { symptoms, treatment, remarks, followup_required } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE consultations SET symptoms = ?, treatment = ?, remarks = ?, followup_required = ? WHERE consult_id = ?',
      [symptoms, treatment, remarks, followup_required ? 1 : 0, id]
    );
    if ((result as any).affectedRows === 0) return res.status(404).json({ error: 'Consultation not found' });
    res.json({ message: 'Consultation updated successfully' });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

app.delete('/api/consultations/:id', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM consultations WHERE consult_id = ?', [id]);
    if ((result as any).affectedRows === 0) return res.status(404).json({ error: 'Consultation not found' });
    res.json({ message: 'Consultation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Clinic API Server running on http://localhost:${PORT}`);
});
