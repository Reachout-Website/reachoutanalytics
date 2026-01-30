import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SURVEYS_DIR = path.join(process.cwd(), "data", "surveys");
const INDEX_FILE = path.join(SURVEYS_DIR, "index.json");

async function readIndex(): Promise<
  { id: string; title: string; state: string; uploadedAt: string; numInstances: number; numVariables: number }[]
> {
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

    const surveysList = index.map((entry) => ({
      id: entry.id,
      name: entry.title,
      description: `Survey with ${entry.numVariables} variables and ${entry.numInstances} instances`,
      state: entry.state,
      responses: entry.numInstances,
      updatedAt: new Date(entry.uploadedAt).toLocaleDateString(),
      uploadedAt: entry.uploadedAt,
    }));

    // Index is already newest-first from upload
    return NextResponse.json({ surveys: surveysList });
  } catch (error) {
    console.error("Fetch surveys error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch surveys",
      },
      { status: 500 }
    );
  }
}
