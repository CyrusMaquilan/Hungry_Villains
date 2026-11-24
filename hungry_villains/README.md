# Hungry Villains POS

The cashier register uses PHP and MySQL or MariaDB. Chrome and Edge can install it as a web app. Amounts use Philippine pesos.

## Upgrade an existing installation

1. Back up the existing database and project folder. Keep any uploaded photos in the existing `pictures/` folder.
2. Open phpMyAdmin, select the **existing** Hungry Villains database, and import `database/upgrade-v2.sql`. The migration adds POS tables alongside existing products, users, orders and order items. It can be rerun.
3. Copy the app files into the existing deployment, keeping uploaded photos. Keep the same database settings. After updating, close all open POS tabs, reopen the app, and sign in to load the new offline catalog.

Use `hungry_villains_db.sql` for fresh installations only. The fresh file includes the existing menu as sample products with no staff accounts, addresses, or historical sales.

## Fresh XAMPP installation

1. Put the `hungry_villains` folder inside XAMPP's `htdocs` directory. Start Apache and MySQL. PHP needs `pdo_mysql` and `mbstring`.
2. At `http://localhost/phpmyadmin`, create a database named `hungry_villains_db` and import `hungry_villains_db.sql`.
3. Open PowerShell in the project folder and create the first administrator. The password prompt hides what you type.

   ```powershell
   $posPassword = Read-Host 'Temporary administrator password (12 to 72 bytes)' -AsSecureString
   $env:HV_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $posPassword).Password
   try { & C:\xampp\php\php.exe tools\create-admin.php admin } finally { Remove-Item Env:HV_ADMIN_PASSWORD }
   ```

4. Open `http://localhost/hungry_villains/`, sign in, and create cashier accounts from **Accounts**. Use the browser's **Install app** option for a desktop shortcut.

## Use the POS over the internet

Host this PHP project over HTTPS and connect it to one shared MySQL or MariaDB database. Configure `HV_DB_HOST`, `HV_DB_PORT`, `HV_DB_NAME`, `HV_DB_USER`, and `HV_DB_PASS` on the server. The defaults are for local XAMPP. Use a dedicated database account and keep database access private to the PHP server. The account needs SELECT, INSERT, UPDATE and DELETE at runtime. Use a migration account to import SQL.

Use the same HTTPS URL on each register. Keep the SQL, tools, tests and installation files private on the web server. The supplied Apache access files block those formats and folders when Apache enables the corresponding overrides. Back up the database and uploaded photos. Treat the database backup as sensitive.

For a single store computer, XAMPP can keep the register and database running locally without internet. A local XAMPP database is its own installation. To share a database across registers, use one hosted URL and enable browser offline mode on those registers.

## Work when a hosted server is unreachable

- Sign in online before the shift and wait until the catalog appears. Leave the cashier session open in that browser tab or installed app. The cached catalog supports up to 12 hours of offline cash checkout from its last refresh, including an offline reload in the same session.
- Complete cash sales and print the receipt as usual. Pending sales live in this browser profile and sync automatically while the app is open and the original cashier's server session is valid. If the session expires, sign in online again as that cashier.
- Check **Sync queue** for pending sales or stock conflicts. Concurrent offline registers can each sell from their last known stock. If the server detects insufficient stock or an inactive product, a manager checks and corrects inventory before the cashier selects **Retry sync**. The original confirmed amount and receipt number are retained.
- Sync pending sales before clearing browser data, changing browser profiles, or disabling a staff account. The queue is tied to the device, site URL, and browser profile.
- Card and e-wallet choices record a payment already approved by the separate terminal or wallet app. Complete those payments online and enter their references. The POS stores references and amounts.

## Data and controls

Orders and their line items retain the existing format. New sales link to a unique client receipt ID, the recorded payment, stock movement entries, and audit events. The server checks the cashier account and signed catalog prices and writes the sale, payment, and stock update in one database transaction. Reports use Philippine store dates. Sales history shows the latest 500 records. The reports screen supports searching a longer date range. New receipts can be reprinted from Sales history.
