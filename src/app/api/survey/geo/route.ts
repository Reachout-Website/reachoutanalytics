import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://reachout:reachout@reachout-political.cvaq262gyh30.ap-south-1.rds.amazonaws.com:5432/reachout",
  ssl: { rejectUnauthorized: false },
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const state = searchParams.get("state");
  const yoe = searchParams.get("yoe");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");

  let query = `
    SELECT id, state, yoe, location, pincode, date, value,
           district, latitude, longitude, geom
    FROM geo_samples
    WHERE 1=1
  `;

  const values: (string | number)[] = [];
  let index = 1;

  if (state) {
    query += ` AND state = $${index++}`;
    values.push(state);
  }

  if (yoe) {
    query += ` AND yoe = $${index++}`;
    values.push(yoe);
  }

  if (fromDate && toDate) {
    query += ` AND date BETWEEN $${index++} AND $${index++}`;
    values.push(fromDate, toDate);
  }

  const result = await pool.query(query, values);

  return NextResponse.json(result.rows);
}
