import { NextRequest, NextResponse } from "next/server";
import { checkUrl } from "@/lib/check";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { url, fresh } = await req.json();
  if (!url || typeof url !== "string") return NextResponse.json({ error: "url required" }, { status: 400 });
  try {
    return NextResponse.json(await checkUrl(url, { fresh: !!fresh }));
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "check failed" }, { status: 500 });
  }
}
