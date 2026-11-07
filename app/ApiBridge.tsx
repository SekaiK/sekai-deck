"use client";

// 화면(GitHub Pages)과 계산 서버(구글 클라우드)가 다른 주소에 있을 때, 화면 코드의 "/api/..." 요청을
// 계산 서버 주소로 보내 주는 연결부. NEXT_PUBLIC_API_BASE가 비어 있으면(서버에서 화면까지 함께 제공할 때) 아무것도 하지 않는다.
// 각 화면 코드는 지금처럼 fetch("/api/recommend") 형태로 쓰면 되고, 여기서 주소와 서버 구분 헤더(X-Region)만 붙인다.
import { currentRegion } from "@/lib/region";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

if (typeof window !== "undefined" && API_BASE && !(window as { __apiBridge?: boolean }).__apiBridge) {
  (window as { __apiBridge?: boolean }).__apiBridge = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      const headers = new Headers(init?.headers);
      // 다른 주소로 보내면 Referer에 화면 경로가 빠져서, 한섭·일섭 구분을 헤더로 알려 줌
      if (!headers.has("X-Region")) headers.set("X-Region", currentRegion());
      return original(API_BASE + input, { ...init, headers });
    }
    return original(input, init);
  };
}

/** 레이아웃에 한 번 넣어 두면 위 연결이 화면이 열릴 때 바로 적용됨 (화면에는 아무것도 그리지 않음) */
export default function ApiBridge() {
  return null;
}
