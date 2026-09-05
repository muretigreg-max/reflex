import { Pool } from 'pg';

async function fixAdmin() {
  // ⚠️ PASTE YOUR EXACT NEON CONNECTION STRING HERE
  const connectionString = "postgresql://neondb_owner:npg_1wJQ6jgeYxKR@ep-bitter-heart-zaqm4shd-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"; 
  
  const pool = new Pool({ connectionString });

  console.log(`Connecting to Neon cloud database...`);
  
  // 1. Force update Dinah Ngai's role to 'ADMIN' (Uppercase!)
  await pool.query(`UPDATE "User" SET role = 'ADMIN' WHERE name = 'Dinah Ngai'`);
  console.log(`✅ Successfully updated Dinah Ngai's role to 'ADMIN'!`);
  
  // 2. Print out all users so we can see exactly what's in there
  const res = await pool.query('SELECT id, name, phone, role FROM "User"');
  console.log("\nHere is everyone currently in your cloud database:");
  console.table(res.rows); // This prints a very nice, readable table

  await pool.end();
}

fixAdmin().catch(console.error);