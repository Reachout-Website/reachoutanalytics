import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SURVEYS_FILE = path.join(DATA_DIR, "surveys.json");

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Read surveys from JSON file
async function readSurveys() {
  try {
    await ensureDataDir();
    const fileContent = await fs.readFile(SURVEYS_FILE, "utf-8");
    return JSON.parse(fileContent);
  } catch {
    return {};
  }
}

// Write surveys to JSON file
async function writeSurveys(surveys: Record<string, any>) {
  await ensureDataDir();
  await fs.writeFile(SURVEYS_FILE, JSON.stringify(surveys, null, 2), "utf-8");
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

    // Create FormData for backend API
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    // Upload to backend API
    const backendResponse = await fetch("http://localhost:5000/api/survey/upload", {
      method: "POST",
      body: backendFormData,
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json(
        { error: `Backend API error: ${errorText}` },
        { status: backendResponse.status }
      );
    }

    const backendData = await backendResponse.json();

    // Generate unique ID for this survey
    const surveyId = generateId();

    // Read existing surveys
    const surveys = await readSurveys();

    // Store survey with ID as key
    surveys[surveyId] = {
      id: surveyId,
      title: title.trim(),
      fileName: backendData.fileName,
      uploadedAt: new Date().toISOString(),
      numVariables: backendData.numVariables,
      variablesList: backendData.variablesList,
      numInstances: backendData.numInstances,
      data: backendData.data,
      response: backendData, // Store full response
    };

    // Write back to file
    await writeSurveys(surveys);

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
