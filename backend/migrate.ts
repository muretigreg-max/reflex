import "dotenv/config";
import Database from 'better-sqlite3';
import { Pool } from 'pg';

async function migrate() {
  console.log('🚀 Starting raw migration from SQLite to Neon...');

  // 1. Connect to your OLD local SQLite database
  const localDb = new Database('prisma/dev.db');

  // 2. Connect to your NEW Neon cloud database
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // --- MIGRATE USERS ---
  // Prisma creates SQLite tables in lowercase by default
  const users = localDb.prepare('SELECT * FROM user').all();
  console.log(`Found ${users.length} users.`);
  for (const user of users) {
    await pool.query(
      `INSERT INTO "user" (id, name, phone, email, password, role, "createdAt") 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.name, user.phone, user.email, user.password, user.role, user.createdAt]
    );
  }

  // --- MIGRATE DELIVERIES ---
  const deliveries = localDb.prepare('SELECT * FROM delivery').all();
  console.log(`Found ${deliveries.length} deliveries.`);
  for (const d of deliveries) {
    await pool.query(
      `INSERT INTO "delivery" (id, "trackingCode", "customerName", "customerPhone", "deliveryAddress", "itemDescription", status, "qrConfirmedAt", "qrConfirmedById", "retailerId", "riderId", "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       ON CONFLICT (id) DO NOTHING`,
      [d.id, d.trackingCode, d.customerName, d.customerPhone, d.deliveryAddress, d.itemDescription, d.status, d.qrConfirmedAt, d.qrConfirmedById, d.retailerId, d.riderId, d.createdAt, d.updatedAt]
    );
  }

  // --- MIGRATE STATUS HISTORY ---
  const history = localDb.prepare('SELECT * FROM statushistory').all();
  console.log(`Found ${history.length} status history records.`);
  for (const h of history) {
    await pool.query(
      `INSERT INTO "statushistory" (id, "deliveryId", "changedById", "oldStatus", "newStatus", "changedAt") 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (id) DO NOTHING`,
      [h.id, h.deliveryId, h.changedById, h.oldStatus, h.newStatus, h.changedAt]
    );
  }

  console.log('✅ Migration complete! Your old data is now in the cloud.');
  
  // Cleanup connections
  localDb.close();
  await pool.end();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});