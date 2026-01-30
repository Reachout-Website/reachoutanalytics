import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const FIELD_COLORS_FILE = path.join(
  process.cwd(),
  "data",
  "reports-field-colors.json"
);

function isValidFieldColors(obj: unknown): obj is Record<string, string> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  return Object.values(obj).every(
    (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)
  );
}

function isValidShowCurve(obj: unknown): obj is Record<string, boolean> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  return Object.values(obj).every((v) => typeof v === "boolean");
}

type StoredPrefs = {
  fieldColors?: Record<string, string>;
  vizShowCurve?: Record<string, boolean>;
};

async function readStored(): Promise<StoredPrefs> {
  try {
    const content = await fs.readFile(FIELD_COLORS_FILE, "utf-8");
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const obj = parsed as Record<string, unknown>;
    // New format: { fieldColors, vizShowCurve }
    if (obj.fieldColors !== undefined || obj.vizShowCurve !== undefined) {
      return {
        fieldColors: isValidFieldColors(obj.fieldColors) ? obj.fieldColors : {},
        vizShowCurve: isValidShowCurve(obj.vizShowCurve) ? obj.vizShowCurve : {},
      };
    }
    // Legacy format: file is directly fieldColors
    if (isValidFieldColors(parsed)) {
      return { fieldColors: parsed, vizShowCurve: {} };
    }
    return {};
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {};
    }
    throw err;
  }
}

export async function GET() {
  try {
    const prefs = await readStored();
    return NextResponse.json({
      fieldColors: prefs.fieldColors ?? {},
      vizShowCurve: prefs.vizShowCurve ?? {},
    });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ fieldColors: {} });
    }
    console.error("Read field colors error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to read field colors",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const obj = body as Record<string, unknown>;
    let fieldColors: Record<string, string> | null = null;
    let vizShowCurve: Record<string, boolean> | null = null;

    // Support legacy format: body is directly fieldColors
    if (isValidFieldColors(body)) {
      fieldColors = body;
    } else {
      if (obj.fieldColors !== undefined) {
        if (!isValidFieldColors(obj.fieldColors)) {
          return NextResponse.json(
            { error: "Invalid fieldColors format" },
            { status: 400 }
          );
        }
        fieldColors = obj.fieldColors;
      }
      if (obj.vizShowCurve !== undefined) {
        if (!isValidShowCurve(obj.vizShowCurve)) {
          return NextResponse.json(
            { error: "Invalid vizShowCurve format" },
            { status: 400 }
          );
        }
        vizShowCurve = obj.vizShowCurve;
      }
    }

    const existing: StoredPrefs = await readStored().catch(
      (): StoredPrefs => ({})
    );
    const merged: StoredPrefs = {
      fieldColors: fieldColors ?? existing.fieldColors ?? {},
      vizShowCurve: vizShowCurve ?? existing.vizShowCurve ?? {},
    };

    const dir = path.dirname(FIELD_COLORS_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      FIELD_COLORS_FILE,
      JSON.stringify(merged, null, 2),
      "utf-8"
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Save field colors error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save field colors",
      },
      { status: 500 }
    );
  }
}
