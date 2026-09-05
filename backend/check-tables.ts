import Database from 'better-sqlite3';

// Connect to your local SQLite database
const db = new Database('prisma/dev.db');

// Ask the database to list all its tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();

console.log(" Tables found in your local database:");
console.log(tables);

db.close();