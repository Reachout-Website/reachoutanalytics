import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const INDEX_FILE = path.join(process.cwd(), "data", "surveys", "index.json");

async function readIndex(): Promise<{ state: string }[]> {
  try {
    const content = await fs.readFile(INDEX_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const index = await readIndex();
    const stateSet = new Set<string>();
    for (const entry of index) {
      if (entry.state && String(entry.state).trim()) {
        stateSet.add(String(entry.state).trim());
      }
    }
    const states = Array.from(stateSet).sort();
    return NextResponse.json({ states });
  } catch (error) {
    console.error("Fetch states error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch states",
      },
      { status: 500 }
    );
  }
}
