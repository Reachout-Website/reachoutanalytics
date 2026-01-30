import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SURVEYS_DIR = path.join(process.cwd(), "data", "surveys");
const INDEX_FILE = path.join(SURVEYS_DIR, "index.json");

function isNumeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function excelSerialToYear(excelSerial: number): number | null {
  try {
    const jsDate = new Date((excelSerial - 25569) * 86400000);
    if (isNaN(jsDate.getTime())) return null;
    return jsDate.getFullYear();
  } catch {
    return null;
  }
}

async function readIndex(): Promise<
  { id: string; state: string }[]
> {
  try {
    const content = await fs.readFile(INDEX_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    if (!state || !state.trim()) {
      return NextResponse.json(
        { error: "State query parameter is required" },
        { status: 400 }
      );
    }

    const index = await readIndex();
    const idsForState = index
      .filter((e) => String(e.state).trim() === state.trim())
      .map((e) => e.id);

    const allRows: Record<string, unknown>[] = [];
    for (const id of idsForState) {
      const surveyPath = path.join(SURVEYS_DIR, `${id}.json`);
      try {
        const content = await fs.readFile(surveyPath, "utf-8");
        const survey = JSON.parse(content);
        const data = survey.data;
        if (Array.isArray(data)) {
          for (const row of data) {
            const rowCopy = { ...row };
            const dateValue = rowCopy["date"];
            if (isNumeric(dateValue)) {
              const year = excelSerialToYear(dateValue);
              if (year !== null) {
                rowCopy["Year"] = String(year);
              }
            }
            allRows.push(rowCopy);
          }
        }
      } catch {
        // Skip missing or invalid survey file
      }
    }

    return NextResponse.json({ rows: allRows });
  } catch (error) {
    console.error("Fetch by-state error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch report data",
      },
      { status: 500 }
    );
  }
}
