import { NextRequest, NextResponse } from "next/server";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const surveys = await readSurveys();
    const resolvedParams = await Promise.resolve(params);
    const surveyId = resolvedParams.id;

    if (!surveys[surveyId]) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    const survey = surveys[surveyId];

    return NextResponse.json({
      id: survey.id,
      title: survey.title,
      variablesList: survey.variablesList || [],
      data: survey.data || [],
      numVariables: survey.numVariables,
      numInstances: survey.numInstances,
    });
  } catch (error) {
    console.error("Fetch survey error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch survey",
      },
      { status: 500 }
    );
  }
}
