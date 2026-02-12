const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Open database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// New password hash
const newPassword = '131819';
const hashedPassword = bcrypt.hashSync(newPassword, 10);

// Update admin user password
const stmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
const result = stmt.run(hashedPassword, 'admin');

console.log(`Updated ${result.changes} user(s)`);
console.log('Admin password changed to: 131819');

db.close();
