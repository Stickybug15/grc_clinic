-- Set optimized reorder levels for all medicines based on clinic usage frequency
UPDATE medicines SET reorder_threshold = 30 WHERE med_name = 'Paracetamol';
UPDATE medicines SET reorder_threshold = 20 WHERE med_name = 'Ibuprofen';
UPDATE medicines SET reorder_threshold = 15 WHERE med_name = 'Cetirizine';
UPDATE medicines SET reorder_threshold = 25 WHERE med_name = 'Mefenamic Acid';
UPDATE medicines SET reorder_threshold = 15 WHERE med_name = 'Amoxicillin';
UPDATE medicines SET reorder_threshold = 20 WHERE med_name = 'Antacid (Kremil)';
UPDATE medicines SET reorder_threshold = 8 WHERE med_name = 'Betadine';
UPDATE medicines SET reorder_threshold = 40 WHERE med_name = 'Ascorbic Acid';
UPDATE medicines SET reorder_threshold = 20 WHERE med_name = 'ORS Sachet';
UPDATE medicines SET reorder_threshold = 15 WHERE med_name = 'Bandage Roll';
UPDATE medicines SET reorder_threshold = 5 WHERE med_name = 'Lopiramide';

SELECT medicine_id, med_name, stock_qty, reorder_threshold, CASE 
  WHEN stock_qty <= reorder_threshold THEN 'LOW STOCK - ORDER SOON'
  ELSE 'Adequate'
END as status FROM medicines ORDER BY med_name;
