import { NextResponse } from "next/server";
import { recognizeAreaItems } from "@/lib/areaItemOcr";
import { regionOfRequest } from "@/lib/region";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const headers = new Headers();

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-Region");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");

  return headers;
}

function jsonResponse(req: Request, data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(req),
  });
}

/** GitHub Pages 화면에서 오는 요청의 사전 확인(CORS). 허용 헤더는 next.config.mjs에서 붙음 */
export function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}
