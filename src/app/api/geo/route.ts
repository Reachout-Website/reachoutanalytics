import { NextRequest, NextResponse } from "next/server";

const GEO_BACKEND = process.env.GEO_API_BACKEND ?? "http://localhost:5000/api/geo";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const url = queryString ? `${GEO_BACKEND}?${queryString}` : GEO_BACKEND;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: "Geo backend unavailable", detail: data },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Geo backend unavailable. Is the Express server running on port 5000?" },
      { status: 503 }
    );
  }
}
