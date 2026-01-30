import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SURVEYS_DIR = path.join(DATA_DIR, "surveys");
const INDEX_FILE = path.join(SURVEYS_DIR, "index.json");

type SurveyIndexEntry = {
  id: string;
  title: string;
  state: string;
  uploadedAt: string;
  numInstances: number;
  numVariables: number;
};

// Ensure surveys directory exists
async function ensureSurveysDir() {
  try {
    await fs.access(SURVEYS_DIR);
  } catch {
    await fs.mkdir(SURVEYS_DIR, { recursive: true });
  }
}

// Read survey index
async function readIndex(): Promise<SurveyIndexEntry[]> {
  try {
    await ensureSurveysDir();
    const content = await fs.readFile(INDEX_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Write survey index
async function writeIndex(entries: SurveyIndexEntry[]) {
  await ensureSurveysDir();
  await fs.writeFile(
    INDEX_FILE,
    JSON.stringify(entries, null, 2),
    "utf-8"
  );
}

// Generate unique ID
function generateId(): string {
  return `survey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const state = (formData.get("state") as string)?.trim() || "";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Survey title is required" },
        { status: 400 }
      );
    }

    if (!state) {
      return NextResponse.json(
        { error: "State is required" },
        { status: 400 }
      );
    }

    // Create FormData for backend API
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    // Upload to backend API
    const backendResponse = await fetch(
      "http://localhost:5000/api/survey/upload",
      {
        method: "POST",
        body: backendFormData,
      }
    );

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json(
        { error: `Backend API error: ${errorText}` },
        { status: backendResponse.status }
      );
    }

    const backendData = await backendResponse.json();
    const surveyId = generateId();

    const surveyRecord = {
      id: surveyId,
      title: title.trim(),
      state,
      fileName: backendData.fileName,
      uploadedAt: new Date().toISOString(),
      numVariables: backendData.numVariables ?? 0,
      variablesList: backendData.variablesList ?? [],
      numInstances: backendData.numInstances ?? 0,
      data: backendData.data ?? [],
    };

    // Save this upload to its own file
    await ensureSurveysDir();
    const surveyPath = path.join(SURVEYS_DIR, `${surveyId}.json`);
    await fs.writeFile(
      surveyPath,
      JSON.stringify(surveyRecord, null, 2),
      "utf-8"
    );

    // Update index
    const index = await readIndex();
    index.unshift({
      id: surveyId,
      title: surveyRecord.title,
      state: surveyRecord.state,
      uploadedAt: surveyRecord.uploadedAt,
      numInstances: surveyRecord.numInstances,
      numVariables: surveyRecord.numVariables,
    });
    await writeIndex(index);

    return NextResponse.json({
      success: true,
      surveyId,
      message: "Survey uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload survey",
      },
      { status: 500 }
    );
  }
}
