require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./db");

const users = [
  {
    email: "supervisor@apparelflow.com",
    full_name: "Cutting Supervisor",
    role: "cutting_supervisor",
  },
  {
    email: "verifier@apparelflow.com",
    full_name: "Cutting Verifier",
    role: "cutting_verifier",
  },
  {
    email: "sewing@apparelflow.com",
    full_name: "Sewing Supervisor",
    role: "sewing_supervisor",
  },
];

const PASSWORD = "ChangeMe123!";

async function seed() {
  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    for (const user of users) {
      const existing = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [user.email]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE users
           SET password_hash = $1, role = $2, full_name = $3
           WHERE email = $4`,
          [passwordHash, user.role, user.full_name, user.email]
        );
        console.log(`Updated: ${user.email}`);
      } else {
        await pool.query(
          `INSERT INTO users (email, password_hash, role, full_name)
           VALUES ($1, $2, $3, $4)`,
          [user.email, passwordHash, user.role, user.full_name]
        );
        console.log(`Created: ${user.email}`);
      }
    }

    console.log("Done. Password for all users:", PASSWORD);
  } catch (error) {
    console.error("Seed error:", error.message);
  } finally {
    await pool.end();
  }
}

seed();