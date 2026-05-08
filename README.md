# GRC Clinic Management System

A web-based clinic management system for tracking patients, consultations, and medicine inventory.

## Features

- Patient management with medical background tracking
- Consultation records with vital signs and treatment notes
- Medicine inventory with expiry tracking and stock alerts
- Dispensing records with automatic stock deduction
- Real-time dashboard with statistics
- Cross-tab synchronization for live updates

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + MySQL
- **Frontend**: Vanilla HTML/TS with Tailwind CSS
- **Database**: MySQL with triggers and views for data integrity

## Quick Start

### Prerequisites
- Node.js (v16+)
- MySQL (via XAMPP or standalone)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd grc_clinic
   ```

2. **Set up the database**
   - Create a MySQL database named `grc_clinic_db`
   - Import `backend/grc_clinic_db.sql` to create tables, triggers, and sample data

3. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

4. **Start the application**
   ```bash
   # Backend (from backend folder)
   npm start

   # Frontend (from frontend folder, in another terminal)
   npm start
   ```

5. **Access the application**
   - Open http://localhost:3000 in your browser
   - Backend API runs on http://localhost:3006

## Database Schema

The system uses the following main tables:
- `patients` - Student patient records
- `consultations` - Clinic visit records
- `medicines` - Medicine inventory
- `dispensing_records` - Medicine dispensing during consultations
- `stock_ledger` - Audit trail of all inventory movements

Views:
- `medicine_status_view` - Medicine status with expiry and stock alerts
- `medicine_usage_report` - Medicine usage statistics
- `daily_consultation_report` - Daily consultation summary

## Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

## Development

- Backend uses TypeScript with strict mode
- Frontend uses ES modules
- Database triggers handle automatic stock updates and validation
- Real-time updates via localStorage events and polling