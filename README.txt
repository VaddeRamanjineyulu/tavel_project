RAMANJINEYULU - ONLINE TRAVEL PACKAGE BOOKING MANAGEMENT SYSTEM

REQUIREMENTS
- Node.js (LTS recommended)
- MySQL 8.0 and MySQL Workbench
- VS Code

1. DATABASE SETUP
- Open MySQL Workbench and connect to your local MySQL server.
- Open database/ramanjineyulu_travel.sql in Workbench.
- Execute the complete script using the lightning bolt button.
- Run: USE ramanjineyulu_travel; SHOW TABLES;
- You should see exactly these four tables: customers, destination, packages, bookings.

2. PROJECT SETUP
- Open the folder Ramanjineyulu_Travel_Booking_Complete in VS Code.
- Open Terminal > New Terminal. Confirm the terminal is in the folder containing package.json.
- Run: npm install
- Copy .env.example and rename the copy to .env.
- Edit .env and set DB_PASSWORD to your MySQL root password.
- Change ADMIN_PASSWORD and JWT_SECRET before using the application.

3. RUN
- Run: npm start
- Open http://localhost:3000 in your browser.

ADMIN LOGIN
- Email: admin@ramanjineyulu.com
- Password: Admin@123 (unless changed in .env)

FEATURES
- Customer registration and login
- Destination and package listing
- Package booking with available-slot checking
- Customer booking status view
- Admin booking list and status updates
- Admin can add destinations and packages

NOTES
- The database has the four requested tables. The packages table is not linked to a destination because the requested schema does not include destination_id.
- This is a college project starter. Test it locally and change default admin credentials. No online payment gateway is included.
- If npm reports ENOENT, run 'dir' and check that package.json is visible in the current terminal folder.
