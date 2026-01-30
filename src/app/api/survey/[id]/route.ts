import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SURVEYS_DIR = path.join(process.cwd(), "data", "surveys");

function sanitizeId(id: string): string {
  // Allow only alphanumeric, hyphen; prevent path traversal
  return id.replace(/[^a-zA-Z0-9-]/g, "");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const rawId = resolvedParams.id;
    const surveyId = sanitizeId(rawId);
    if (surveyId !== rawId) {
      return NextResponse.json({ error: "Invalid survey id" }, { status: 400 });
    }

    const surveyPath = path.join(SURVEYS_DIR, `${surveyId}.json`);
    try {
      const content = await fs.readFile(surveyPath, "utf-8");
      const survey = JSON.parse(content);
      return NextResponse.json({
        id: survey.id,
        title: survey.title,
        state: survey.state,
        variablesList: survey.variablesList || [],
        data: survey.data || [],
        numVariables: survey.numVariables,
        numInstances: survey.numInstances,
      });
    } catch {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }
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
