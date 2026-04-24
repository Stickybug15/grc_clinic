# School Clinic System: Deployment Guide

This guide explains how to install and run the School Clinic Management System on a standalone computer at the clinic.

---

### Step 1: Prepare the Clinic Computer (Prerequisites)
On the clinic computer, you need to install the two primary engines that run this system:

1. **Install Node.js:** Download and install it from [nodejs.org](https://nodejs.org). *(This runs the application code).*
2. **Install XAMPP:** Download and install XAMPP from [apachefriends.org](https://www.apachefriends.org). *(This runs the MySQL database).* 
   - Once installed, open the **XAMPP Control Panel** and click **Start** next to the **MySQL** module.

---

### Step 2: Transfer the Database
You must move your current database data over to the new computer.

1. On your **current computer**, open XAMPP, and click **"Admin"** next to MySQL to open phpMyAdmin.
2. Click on your `grc_clinic_db` database on the left sidebar.
3. Go to the **Export** tab at the top of the screen and click **Export**. This will download an `.sql` file to your computer.
4. Move this `.sql` file onto a USB Flash Drive.
5. Go to the **clinic computer**, open XAMPP, and click "Admin" next to MySQL.
6. Create a new database named exactly `grc_clinic_db`.
7. Click on the new database, go to the **Import** tab, and upload your `.sql` file from the USB drive.

---

### Step 3: Transfer the Code
1. On your **current computer**, copy the entire `school-clinic` project folder onto your USB Flash Drive.
2. Paste the folder onto the **clinic computer** (e.g., in the Documents folder or directly on the `C:\` drive).

---

### Step 4: Initial Setup (One-Time Only)
The first time you put the code on the clinic computer, you must install the dependencies.

1. Open the `school-clinic` folder in VS Code (or your terminal) on the clinic computer.
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
