// 서버(한국판·일본판) 구분. 주소가 /jp로 시작하면 일본 서버, 아니면 한국 서버
export type Region = "kr" | "jp";

export const REGIONS: Record<Region, { label: string; short: string; prefix: string; masterBase: string }> = {
  kr: {
    label: "한국 서버",
    short: "한섭",
    prefix: "",
    masterBase: "https://raw.githubusercontent.com/Sekai-World/sekai-master-db-kr-diff/main",
  },
  jp: {
    label: "일본 서버",
    short: "일섭",
    prefix: "/jp",
    masterBase: "https://raw.githubusercontent.com/Sekai-World/sekai-master-db-diff/main",
  },
};

/** GitHub Pages처럼 사이트가 하위 주소(예: /sekai-deck)에 올라갈 때의 앞부분. 서버에서 직접 열면 빈 값 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** 주소 경로로 서버 판단 */
export function regionOfPath(pathname: string | null | undefined): Region {
  return pathname === "/jp" || pathname?.startsWith("/jp/") ? "jp" : "kr";
}

/** 서버에 맞는 화면 주소. regionHref("jp", "/cards") → "/jp/cards", regionHref("jp", "/") → "/jp" */
export function regionHref(region: Region, path: string) {
  const prefix = REGIONS[region].prefix;
  if (!prefix) return path;
  return path === "/" ? prefix : prefix + path;
}

/** 지금 화면 주소에서 서버 부분을 뺀 경로. "/jp/cards" → "/cards" */
export function stripRegion(pathname: string) {
  const r = regionOfPath(pathname);
  if (r === "kr") return pathname || "/";
  const rest = pathname.slice(REGIONS[r].prefix.length);
  return rest === "" ? "/" : rest;
}

/** 브라우저 주소에서 하위 주소 앞부분(BASE_PATH)을 뺀 경로 */
export function sitePath(pathname: string) {
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) return pathname.slice(BASE_PATH.length) || "/";
  return pathname;
}

/** 브라우저에서 지금 서버 (서버 렌더링 중에는 한국 서버) */
export function currentRegion(): Region {
  return typeof window === "undefined" ? "kr" : regionOfPath(sitePath(window.location.pathname));
}

/**
 * API 요청의 서버: 명시한 값 → 주소의 ?region= → X-Region 헤더 → 요청을 보낸 화면 주소(Referer) 순서로 판단.
 * GitHub Pages에서 구글 클라우드 API로 보내는 요청은 Referer에 경로가 빠지므로, 화면 쪽에서 X-Region 헤더를 붙여 보낸다.
 */
export function regionOfRequest(req: Request, explicit?: unknown): Region {
  if (explicit === "jp" || explicit === "kr") return explicit;
  const fromQuery = new URL(req.url).searchParams.get("region");
  if (fromQuery === "jp" || fromQuery === "kr") return fromQuery;
  const fromHeader = req.headers.get("x-region");
  if (fromHeader === "jp" || fromHeader === "kr") return fromHeader;
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      return regionOfPath(sitePath(new URL(ref).pathname));
    } catch {
      // 무시
    }
  }
  return "kr";
}
