import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SURVEYS_FILE = path.join(DATA_DIR, "surveys.json");

// Read surveys from JSON file
async function readSurveys() {
  try {
    const fileContent = await fs.readFile(SURVEYS_FILE, "utf-8");
    return JSON.parse(fileContent);
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const surveys = await readSurveys();

    // Transform surveys to list format for display
    const surveysList = Object.values(surveys).map((survey: any) => ({
      id: survey.id,
      name: survey.title,
      description: `Survey with ${survey.numVariables} variables and ${survey.numInstances} instances`,
      responses: survey.numInstances,
      updatedAt: new Date(survey.uploadedAt).toLocaleDateString(),
      uploadedAt: survey.uploadedAt,
    }));

    // Sort by upload date (newest first)
    surveysList.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

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
