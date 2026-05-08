-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 08, 2026 at 12:27 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `grc_clinic_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `consultations`
--

CREATE TABLE `consultations` (
  `consult_id` int(11) NOT NULL,
  `patient_id` int(11) NOT NULL,
  `visit_timestamp` datetime NOT NULL DEFAULT current_timestamp(),
  `symptoms` text NOT NULL,
  `treatment` text DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `vital_signs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`vital_signs`)),
  `followup_required` tinyint(1) NOT NULL DEFAULT 0,
  `followup_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Clinic visits. Data Dictionary source: consultations_db.sql';

--
-- Dumping data for table `consultations`
--

INSERT INTO `consultations` (`consult_id`, `patient_id`, `visit_timestamp`, `symptoms`, `treatment`, `remarks`, `vital_signs`, `followup_required`, `followup_date`, `created_at`, `updated_at`) VALUES
(1, 1, '2026-01-15 10:30:00', 'Fever and headache', 'Provided 1 tablet Paracetamol and advised rest', 'Advise patient to rest and drink water. Monitor for recurring headache and dizziness. If symptoms persist, consult a doctor.', '{\"temp_c\": 38.1, \"bp\": \"110/70\", \"hr\": 88}', 0, NULL, '2026-04-23 21:12:27', '2026-04-23 21:12:27');

--
-- Triggers `consultations`
--
DELIMITER $$
CREATE TRIGGER `set_updated_at_consultations` BEFORE UPDATE ON `consultations` FOR EACH ROW BEGIN
    SET NEW.updated_at = NOW();
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `consult_treatment_types`
--

CREATE TABLE `consult_treatment_types` (
  `id` int(11) NOT NULL,
  `consult_id` int(11) NOT NULL,
  `treatment_type` enum('rest','first_aid','medication','consult','referred_to_hospital','sent_home') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Junction table replacing the treatment_type[] array column in PostgreSQL.';

--
-- Dumping data for table `consult_treatment_types`
--

INSERT INTO `consult_treatment_types` (`id`, `consult_id`, `treatment_type`) VALUES
(2, 1, 'rest'),
(1, 1, 'medication');

-- --------------------------------------------------------

--
-- Stand-in structure for view `daily_consultation_report`
-- (See below for the actual view)
--
CREATE TABLE `daily_consultation_report` (
`consult_id` int(11)
,`visit_timestamp` datetime
,`student_no` varchar(20)
,`patient_name` varchar(102)
,`level_section` varchar(30)
,`symptoms` text
,`treatment_types` mediumtext
,`treatment` text
,`medicine_dispensed` varchar(100)
,`qty_issued` int(11)
,`dosage_instructions` varchar(150)
,`followup_required` tinyint(1)
,`followup_date` date
);

-- --------------------------------------------------------

--
-- Table structure for table `dispensing_records`
--

CREATE TABLE `dispensing_records` (
  `dispensing_id` int(11) NOT NULL,
  `consult_id` int(11) NOT NULL,
  `medicine_id` int(11) NOT NULL,
  `qty_issued` int(11) NOT NULL CHECK (`qty_issued` > 0),
  `dosage_instructions` varchar(150) DEFAULT NULL,
  `dispensed_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Medicines dispensed per consultation. Normalizes qty_issued from the Data Dictionary.';

--
-- Triggers `dispensing_records`
--
DELIMITER $$
CREATE TRIGGER `trg_after_dispense` AFTER INSERT ON `dispensing_records` FOR EACH ROW BEGIN
    DECLARE v_current_stock INT DEFAULT 0;
    DECLARE v_med_name      VARCHAR(100) DEFAULT '';

    -- Read current stock
    SELECT stock_qty, med_name
      INTO v_current_stock, v_med_name
      FROM medicines
     WHERE medicine_id = NEW.medicine_id;

    -- Over-dispense guard
    IF NEW.qty_issued > v_current_stock THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient stock: requested quantity exceeds available stock.';
        -- Note: include v_med_name in application-level error handling
        -- as SIGNAL MESSAGE_TEXT cannot embed variables directly in MySQL.
    END IF;

    -- Deduct from inventory
    UPDATE medicines
       SET stock_qty  = stock_qty - NEW.qty_issued,
           updated_at = NOW()
     WHERE medicine_id = NEW.medicine_id;

    -- Write to audit ledger
    INSERT INTO stock_ledger (medicine_id, action, quantity_change, stock_after, dispensing_id)
    VALUES (
        NEW.medicine_id,
        'dispense',
        -NEW.qty_issued,
        v_current_stock - NEW.qty_issued,
        NEW.dispensing_id
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `medicines`
--

CREATE TABLE `medicines` (
  `medicine_id` int(11) NOT NULL,
  `med_name` varchar(100) NOT NULL,
  `med_desc` text DEFAULT NULL,
  `category` enum('analgesic','antibiotic','antihistamine','antacid','antiseptic','vitamin_supplement','decongestant','wound_care','other') NOT NULL DEFAULT 'other',
  `unit` enum('tablet','capsule','bottle','sachet','ampule','patch','drop','piece') NOT NULL,
  `stock_qty` int(11) NOT NULL DEFAULT 0 CHECK (`stock_qty` >= 0),
  `reorder_threshold` int(11) NOT NULL DEFAULT 10 CHECK (`reorder_threshold` >= 0),
  `dosage_strength` varchar(50) DEFAULT NULL,
  `expiry_date` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='First-aid and OTC medicine inventory. Data Dictionary source: inventory_db.sql';

--
-- Dumping data for table `medicines`
--

INSERT INTO `medicines` (`medicine_id`, `med_name`, `med_desc`, `category`, `unit`, `stock_qty`, `reorder_threshold`, `dosage_strength`, `expiry_date`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Paracetamol', 'For fever and pain relief', 'analgesic', 'tablet', 150, 20, '500mg', '2027-06-30', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(2, 'Ibuprofen', 'For pain, fever, and inflammation', 'analgesic', 'tablet', 80, 15, '200mg', '2026-08-19', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(3, 'Cetirizine', 'For allergy symptoms and allergic rhinitis', 'antihistamine', 'tablet', 90, 15, '10mg', '2027-03-15', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(4, 'Mefenamic Acid', 'For mild to moderate pain relief', 'analgesic', 'capsule', 100, 20, '500mg', '2026-11-01', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(5, 'Amoxicillin', 'Broad-spectrum antibiotic for infections', 'antibiotic', 'capsule', 3, 10, '500mg', '2026-05-10', 1, '2026-04-23 21:12:27', '2026-05-08 16:23:51'),
(6, 'Antacid (Kremil)', 'For acid reflux and stomach upset', 'antacid', 'tablet', 70, 15, '200mg/200mg', '2027-01-20', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(7, 'Betadine', 'Antiseptic solution for wound cleaning', 'antiseptic', 'bottle', 20, 5, '10% 60ml', '2026-10-05', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(8, 'Ascorbic Acid', 'Vitamin C supplement for immune support', 'vitamin_supplement', 'tablet', 200, 30, '500mg', '2027-08-01', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(9, 'ORS Sachet', 'Oral rehydration salts for dehydration', 'other', 'sachet', 80, 15, '1L reconst.', '2026-07-20', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(10, 'Bandage Roll', 'Gauze bandage for wound dressing', 'wound_care', 'piece', 60, 10, 'N/A', '2028-01-01', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(12, 'Lopiramide', 'skit sa tyan', 'antiseptic', '', 5, 1, NULL, '2026-05-24', 1, '2026-05-08 16:25:02', '2026-05-08 16:25:02');

--
-- Triggers `medicines`
--
DELIMITER $$
CREATE TRIGGER `trg_check_expiry_before_insert` BEFORE INSERT ON `medicines` FOR EACH ROW BEGIN
    IF NEW.expiry_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot add a medicine with a past expiry date.';
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Stand-in structure for view `medicine_status_view`
-- (See below for the actual view)
--
CREATE TABLE `medicine_status_view` (
`medicine_id` int(11)
,`med_name` varchar(100)
,`med_desc` text
,`category` enum('analgesic','antibiotic','antihistamine','antacid','antiseptic','vitamin_supplement','decongestant','wound_care','other')
,`unit` enum('tablet','capsule','bottle','sachet','ampule','patch','drop','piece')
,`dosage_strength` varchar(50)
,`stock_qty` int(11)
,`reorder_threshold` int(11)
,`expiry_date` date
,`status` varchar(13)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `medicine_usage_report`
-- (See below for the actual view)
--
CREATE TABLE `medicine_usage_report` (
`medicine_id` int(11)
,`med_name` varchar(100)
,`category` enum('analgesic','antibiotic','antihistamine','antacid','antiseptic','vitamin_supplement','decongestant','wound_care','other')
,`unit` enum('tablet','capsule','bottle','sachet','ampule','patch','drop','piece')
,`total_dispensed` decimal(32,0)
,`times_used` bigint(21)
,`first_used` datetime
,`last_used` datetime
);

-- --------------------------------------------------------

--
-- Table structure for table `patients`
--

CREATE TABLE `patients` (
  `patient_id` int(11) NOT NULL,
  `student_no` varchar(20) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `level_section` varchar(30) NOT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` char(1) NOT NULL DEFAULT 'M' CHECK (`gender` in ('M','F','X')),
  `guardian_name` varchar(120) DEFAULT NULL,
  `guardian_contact` varchar(20) DEFAULT NULL,
  `medical_background` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT json_object('allergies',json_array(),'conditions',json_array()) CHECK (json_valid(`medical_background`)),
  `is_enrolled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Student patient records. Data Dictionary source: patients_db.sql';

--
-- Dumping data for table `patients`
--

INSERT INTO `patients` (`patient_id`, `student_no`, `first_name`, `last_name`, `middle_name`, `level_section`, `birth_date`, `gender`, `guardian_name`, `guardian_contact`, `medical_background`, `is_enrolled`, `created_at`, `updated_at`) VALUES
(1, '2024-06-00110', 'Kimpee', 'Aton', NULL, 'BSIT / 3rd Year', '2002-05-10', 'M', NULL, NULL, '{\"allergies\": [], \"conditions\": []}', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(2, '2024-07-00110', 'Geraldyn', 'Castillano', NULL, 'BSIT / 3rd Year', '2003-11-12', 'F', NULL, NULL, '{\"allergies\": [\"Penicillin\"], \"conditions\": []}', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(3, '2024-00301', 'Hanny', 'Cortez', NULL, 'BSIT / 2nd Year', '2004-03-21', 'F', NULL, NULL, '{\"allergies\": [], \"conditions\": [\"Asthma\"]}', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27'),
(4, '2024-00402', 'Jerick', 'Isip', NULL, 'BSIT / 2nd Year', '2003-08-14', 'M', NULL, NULL, '{\"allergies\": [], \"conditions\": []}', 1, '2026-04-23 21:12:27', '2026-04-23 21:12:27');

-- --------------------------------------------------------

--
-- Table structure for table `stock_ledger`
--

CREATE TABLE `stock_ledger` (
  `ledger_id` int(11) NOT NULL,
  `medicine_id` int(11) NOT NULL,
  `action` enum('restock','dispense','adjustment','expired_removal') NOT NULL,
  `quantity_change` int(11) NOT NULL,
  `stock_after` int(11) NOT NULL CHECK (`stock_after` >= 0),
  `dispensing_id` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `recorded_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Full audit trail of all inventory movements for Usage and Inventory Status Reports.';

--
-- Dumping data for table `stock_ledger`
--

INSERT INTO `stock_ledger` (`ledger_id`, `medicine_id`, `action`, `quantity_change`, `stock_after`, `dispensing_id`, `notes`, `recorded_at`) VALUES
(1, 1, 'restock', 150, 150, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(2, 2, 'restock', 80, 80, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(3, 3, 'restock', 90, 90, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(4, 4, 'restock', 100, 100, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(5, 5, 'restock', 50, 50, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(6, 6, 'restock', 70, 70, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(7, 7, 'restock', 20, 20, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(8, 8, 'restock', 200, 200, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(9, 9, 'restock', 80, 80, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(10, 10, 'restock', 60, 60, NULL, 'Initial stock load', '2026-04-23 21:12:27'),
(16, 5, 'expired_removal', -5, 45, NULL, 'remove', '2026-05-08 15:37:50'),
(19, 5, 'restock', 5, 50, NULL, NULL, '2026-05-08 16:17:12'),
(20, 5, 'restock', -40, 10, NULL, NULL, '2026-05-08 16:17:41'),
(21, 5, 'dispense', -5, 5, NULL, NULL, '2026-05-08 16:20:25'),
(22, 5, 'adjustment', -2, 3, NULL, NULL, '2026-05-08 16:23:51');

-- --------------------------------------------------------

--
-- Structure for view `daily_consultation_report`
--
DROP TABLE IF EXISTS `daily_consultation_report`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `daily_consultation_report`  AS SELECT `c`.`consult_id` AS `consult_id`, `c`.`visit_timestamp` AS `visit_timestamp`, `p`.`student_no` AS `student_no`, concat(`p`.`last_name`,', ',`p`.`first_name`) AS `patient_name`, `p`.`level_section` AS `level_section`, `c`.`symptoms` AS `symptoms`, (select group_concat(`ctt`.`treatment_type` order by `ctt`.`treatment_type` ASC separator ', ') from `consult_treatment_types` `ctt` where `ctt`.`consult_id` = `c`.`consult_id`) AS `treatment_types`, `c`.`treatment` AS `treatment`, `m`.`med_name` AS `medicine_dispensed`, `dr`.`qty_issued` AS `qty_issued`, `dr`.`dosage_instructions` AS `dosage_instructions`, `c`.`followup_required` AS `followup_required`, `c`.`followup_date` AS `followup_date` FROM (((`consultations` `c` join `patients` `p` on(`p`.`patient_id` = `c`.`patient_id`)) left join `dispensing_records` `dr` on(`dr`.`consult_id` = `c`.`consult_id`)) left join `medicines` `m` on(`m`.`medicine_id` = `dr`.`medicine_id`)) ORDER BY `c`.`visit_timestamp` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `medicine_status_view`
--
DROP TABLE IF EXISTS `medicine_status_view`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `medicine_status_view`  AS SELECT `medicines`.`medicine_id` AS `medicine_id`, `medicines`.`med_name` AS `med_name`, `medicines`.`med_desc` AS `med_desc`, `medicines`.`category` AS `category`, `medicines`.`unit` AS `unit`, `medicines`.`dosage_strength` AS `dosage_strength`, `medicines`.`stock_qty` AS `stock_qty`, `medicines`.`reorder_threshold` AS `reorder_threshold`, `medicines`.`expiry_date` AS `expiry_date`, CASE WHEN `medicines`.`expiry_date` < curdate() THEN 'expired' WHEN `medicines`.`expiry_date` <= curdate() + interval 30 day THEN 'expiring_soon' WHEN `medicines`.`stock_qty` = 0 THEN 'out_of_stock' WHEN `medicines`.`stock_qty` <= `medicines`.`reorder_threshold` THEN 'low_stock' ELSE 'available' END AS `status` FROM `medicines` WHERE `medicines`.`is_active` = 1 ORDER BY CASE WHEN `medicines`.`expiry_date` < curdate() THEN 0 WHEN `medicines`.`stock_qty` = 0 THEN 1 WHEN `medicines`.`stock_qty` <= `medicines`.`reorder_threshold` THEN 2 ELSE 3 END ASC, `medicines`.`stock_qty` ASC ;

-- --------------------------------------------------------

--
-- Structure for view `medicine_usage_report`
--
DROP TABLE IF EXISTS `medicine_usage_report`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `medicine_usage_report`  AS SELECT `m`.`medicine_id` AS `medicine_id`, `m`.`med_name` AS `med_name`, `m`.`category` AS `category`, `m`.`unit` AS `unit`, sum(`dr`.`qty_issued`) AS `total_dispensed`, count(distinct `dr`.`consult_id`) AS `times_used`, min(`c`.`visit_timestamp`) AS `first_used`, max(`c`.`visit_timestamp`) AS `last_used` FROM ((`dispensing_records` `dr` join `medicines` `m` on(`m`.`medicine_id` = `dr`.`medicine_id`)) join `consultations` `c` on(`c`.`consult_id` = `dr`.`consult_id`)) GROUP BY `m`.`medicine_id`, `m`.`med_name`, `m`.`category`, `m`.`unit` ORDER BY sum(`dr`.`qty_issued`) DESC ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `consultations`
--
ALTER TABLE `consultations`
  ADD PRIMARY KEY (`consult_id`),
  ADD KEY `idx_consultations_patient` (`patient_id`),
  ADD KEY `idx_consultations_timestamp` (`visit_timestamp`);

--
-- Indexes for table `consult_treatment_types`
--
ALTER TABLE `consult_treatment_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_consult_treatment` (`consult_id`,`treatment_type`),
  ADD KEY `idx_ctt_consult` (`consult_id`);

--
-- Indexes for table `dispensing_records`
--
ALTER TABLE `dispensing_records`
  ADD PRIMARY KEY (`dispensing_id`),
  ADD KEY `idx_dispensing_consult` (`consult_id`),
  ADD KEY `idx_dispensing_medicine` (`medicine_id`);

--
-- Indexes for table `medicines`
--
ALTER TABLE `medicines`
  ADD PRIMARY KEY (`medicine_id`),
  ADD KEY `idx_medicines_name` (`med_name`),
  ADD KEY `idx_medicines_expiry` (`expiry_date`),
  ADD KEY `idx_medicines_category` (`category`);

--
-- Indexes for table `patients`
--
ALTER TABLE `patients`
  ADD PRIMARY KEY (`patient_id`),
  ADD UNIQUE KEY `uq_student_no` (`student_no`),
  ADD KEY `idx_patients_name` (`last_name`,`first_name`),
  ADD KEY `idx_patients_student_no` (`student_no`);

--
-- Indexes for table `stock_ledger`
--
ALTER TABLE `stock_ledger`
  ADD PRIMARY KEY (`ledger_id`),
  ADD KEY `fk_ledger_dispensing` (`dispensing_id`),
  ADD KEY `idx_ledger_medicine` (`medicine_id`),
  ADD KEY `idx_ledger_recorded` (`recorded_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `consultations`
--
ALTER TABLE `consultations`
  MODIFY `consult_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `consult_treatment_types`
--
ALTER TABLE `consult_treatment_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `dispensing_records`
--
ALTER TABLE `dispensing_records`
  MODIFY `dispensing_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `medicines`
--
ALTER TABLE `medicines`
  MODIFY `medicine_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `patients`
--
ALTER TABLE `patients`
  MODIFY `patient_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `stock_ledger`
--
ALTER TABLE `stock_ledger`
  MODIFY `ledger_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `consultations`
--
ALTER TABLE `consultations`
  ADD CONSTRAINT `fk_consult_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON UPDATE CASCADE;

--
-- Constraints for table `consult_treatment_types`
--
ALTER TABLE `consult_treatment_types`
  ADD CONSTRAINT `fk_ctt_consult` FOREIGN KEY (`consult_id`) REFERENCES `consultations` (`consult_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `dispensing_records`
--
ALTER TABLE `dispensing_records`
  ADD CONSTRAINT `fk_dr_consult` FOREIGN KEY (`consult_id`) REFERENCES `consultations` (`consult_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_dr_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`medicine_id`) ON UPDATE CASCADE;

--
-- Constraints for table `stock_ledger`
--
ALTER TABLE `stock_ledger`
  ADD CONSTRAINT `fk_ledger_dispensing` FOREIGN KEY (`dispensing_id`) REFERENCES `dispensing_records` (`dispensing_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ledger_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`medicine_id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;