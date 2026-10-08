import { Pool } from "pg";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

export async function GET() {
  try {
    const result = await pool.query("SELECT NOW()");
    return Response.json({ success: true, time: result.rows[0] });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        success: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : String(error), // dev only
      },
      { status: 500 }
    );
  }
}