const { Client } = require('pg');
const bcrypt = require('bcrypt');

// Configuration from backend/.env
const connectionString = "postgresql://samaysafar_db_user:zp2jkRLtFJKrcukv2IUhTMdXc38WrMgs@dpg-d779qqkhg0os73e7ht90-a.oregon-postgres.render.com:5432/samaysafar_db?ssl=true";
const email = "bayungraiprerna@gmail.com";
const password = "Expo5544#@";
const name = "Prerna Rai";

async function setup() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected successfully.");

    // 1. Create Organization if not exists
    console.log("Checking organization...");
    const orgRes = await client.query('INSERT INTO "Organization" ("Name", "Email", "Phone", "Address") VALUES ($1, $2, $3, $4) ON CONFLICT ("Email") DO UPDATE SET "Name" = EXCLUDED."Name" RETURNING "OrgId"', [name, email, '9804040485', 'Kathmandu']);
    const orgId = orgRes.rows[0].OrgId;
    console.log(`Organization ready (ID: ${orgId})`);

    // 2. Create User if not exists
    console.log("Checking user...");
    const userRes = await client.query('INSERT INTO "Users" ("OrgId", "Role", "Name", "Email", "Phone") VALUES ($1, $2, $3, $4, $5) ON CONFLICT ("Email") DO UPDATE SET "Name" = EXCLUDED."Name" RETURNING "UserId"', [orgId, 'admin', name, email, '9804040485']);
    const userId = userRes.rows[0].UserId;
    console.log(`User ready (ID: ${userId})`);

    // 3. Create Credentials
    console.log("Updating credentials...");
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    await client.query('INSERT INTO "Credentials" ("UserId", "PasswordHash", "MustChangePassword") VALUES ($1, $2, $3) ON CONFLICT ("UserId") DO UPDATE SET "PasswordHash" = EXCLUDED."PasswordHash"', [userId, hash, false]);
    console.log("Credentials ready.");

    console.log("\n✅ Setup complete! You can now run the tests.");
  } catch (err) {
    console.error("❌ Setup failed:", err.message);
  } finally {
    await client.end();
  }
}

setup();
