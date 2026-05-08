# School Clinic System: Deployment Guide

This guide explains how to install and run the School Clinic Management System on a standalone computer at the clinic.

---

### Step 1: Prepare the Clinic Computer (Prerequisites)
On the clinic computer, you need to install the two primary engines that run this system:

1. **Install Node.js:** Download and install it from [nodejs.org](https://nodejs.org). *(This runs the application code).*
2. **Install XAMPP:** Download and install XAMPP from [apachefriends.org](https://www.apachefriends.org). *(This runs the MySQL database).* 
   - Once installed, open the **XAMPP Control Panel** and click **Start** next to the **MySQL** module.

---

### Step 2: Set Up the Database
You need to create the database and import the schema with sample data.

1. Open XAMPP Control Panel and click **Start** next to the **MySQL** module.
2. Click **"Admin"** next to MySQL to open phpMyAdmin.
3. Create a new database named exactly `grc_clinic_db` (use UTF8 collation).
4. Click on the new database, go to the **Import** tab.
5. Upload the `backend/grc_clinic_db.sql` file from the project folder and click **Import**.

---

### Step 3: Transfer the Code
1. Copy the entire `grc_clinic` project folder onto the **clinic computer** (e.g., in the Documents folder or directly on the `C:\` drive).

---

### Step 4: Initial Setup (One-Time Only)
The first time you put the code on the clinic computer, you must install the dependencies.

1. Open the `grc_clinic` folder in VS Code (or your terminal) on the clinic computer.
2. Open two terminals.
3. **In the first terminal:** Navigate to the backend by typing `cd backend`. Then run:
   ```bash
   npm install
   ```
4. **In the second terminal:** Navigate to the frontend by typing `cd frontend`. Then run:
   ```bash
   npm install
   ```

---

### Step 5: How the Staff will Run the System Everyday

The staff at the clinic **do not** need to open terminals or VS Code. A special launch file has been created for them.

1. Locate the `start-clinic.bat` file inside the main `school-clinic` folder.
2. Right-click the `start-clinic.bat` file, click **"Send to" -> "Desktop (create shortcut)"**.
3. Go to the Desktop and rename the new shortcut to **"School Clinic System"**. You can even change the icon if you'd like.

**Daily Workflow for Staff:**
1. Ensure XAMPP is open and MySQL is started.
2. Double-click the **"School Clinic System"** icon on the desktop.

**What happens automatically:**
- Two hidden command windows will open to start the backend and frontend servers.
- The system will wait exactly 5 seconds for the servers to warm up.
- The default web browser will automatically open directly to the Clinic Dashboard (`http://localhost:5173`).

> [!IMPORTANT]
> The staff must keep the two black server windows open in the background while they are using the system! Closing them will shut down the server.
