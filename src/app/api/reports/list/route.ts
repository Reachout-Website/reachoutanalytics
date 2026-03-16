import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const INDEX_FILE = path.join(process.cwd(), "data", "surveys", "index.json");

async function readIndex(): Promise<any[]> {
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
    const state = searchParams.get("state") || "";
    const index = await readIndex();
    if (!state.trim()) {
      return NextResponse.json({ surveys: [] });
    }
    const surveys = index.filter((e) => String(e.state).trim() === state.trim());
    return NextResponse.json({ surveys });
  } catch (err) {
    console.error("List surveys error:", err);
    return NextResponse.json({ surveys: [] }, { status: 500 });
  }
}
