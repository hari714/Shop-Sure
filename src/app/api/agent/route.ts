import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
  try {
    return NextResponse.json(await runAgent(String(message).slice(0, 1000)));
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "agent failed" }, { status: 500 });
  }
}
