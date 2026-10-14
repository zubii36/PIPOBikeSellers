const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const databaseFolder = path.join(__dirname);

if (!fs.existsSync(databaseFolder)) {
  fs.mkdirSync(databaseFolder, { recursive: true });
}

const dbPath = path.join(databaseFolder, "tractor_orders.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");


// Create orders table if it does not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    tractor_id TEXT NOT NULL,
    tractor_name TEXT NOT NULL,
    bike_color TEXT NOT NULL DEFAULT 'Not specified',
    tractor_price_usd REAL NOT NULL,
    deposit_percent REAL NOT NULL,
    deposit_amount_usd REAL NOT NULL,

    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    state TEXT,

    payment_method TEXT,
    payment_screenshot TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    order_status TEXT NOT NULL DEFAULT 'pending',

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);


// Check existing columns
const columns = db
  .prepare("PRAGMA table_info(orders)")
  .all();


// Add state if missing
const hasState = columns.some(
  column => column.name === "state"
);

if (!hasState) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN state TEXT
  `);

  console.log("State column added.");
}


// Add payment method if missing
const hasPaymentMethod = columns.some(
  column => column.name === "payment_method"
);

if (!hasPaymentMethod) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN payment_method TEXT
  `);

  console.log("Payment method column added.");
}
const hasPaymentScreenshot = columns.some(
  column => column.name === "payment_screenshot"
);

if (!hasPaymentScreenshot) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN payment_screenshot TEXT
  `);

  console.log("Payment screenshot column added.");
}

module.exports = db;