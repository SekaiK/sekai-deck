import path from "path";
import { fileURLToPath } from "url";

// 빌드 방식 두 가지
//  - 기본(구글 클라우드 서버): next build → next start. 화면과 API(/api/...)를 함께 제공
//  - BUILD_TARGET=static(GitHub Pages): 화면만 정적 파일(out 폴더)로 내보냄. API는 구글 클라우드 서버를 부름
const isStatic = process.env.BUILD_TARGET === "static";
// GitHub Pages 하위 주소 (예: /sekai-deck). 아이디.github.io 저장소면 비워 둠
const basePath = isStatic ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "") : "";
// API 서버가 요청을 받아 줄 화면 주소 (예: https://아이디.github.io). 쉼표로 여러 개 가능
const allowedOrigin = (process.env.ALLOWED_ORIGIN ?? "").split(",")[0].trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 글자 인식 라이브러리는 내부 작업 파일 경로를 쓰므로 묶지 않고 그대로 불러옴
  // (instrumentation.ts는 Next 15부터 기본 기능이라 따로 켤 필요 없음)
  serverExternalPackages: ["tesseract.js"],
  // 화면을 미리 만들 때 게임 데이터(일본판은 40MB 이상)를 받느라 오래 걸릴 수 있어서 시간 제한을 늘림 (기본 60초).
  // 데이터 받기는 한 번에 최대 3분, 최대 3번 시도하므로 그보다 넉넉하게 둠
  staticPageGenerationTimeout: 600,
  // 프로젝트 폴더를 기준으로 빌드 (상위 폴더에 있는 다른 package-lock.json을 보지 않게)
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  ...(isStatic
    ? {
        output: "export",
        basePath,
        images: { unoptimized: true },
      }
    : {
        // GitHub Pages 화면이 이 서버의 API를 부를 수 있게 허용 (CORS)
        async headers() {
          if (!allowedOrigin) return [];
          return [
            {
              source: "/api/:path*",
              headers: [
                { key: "Access-Control-Allow-Origin", value: allowedOrigin },
                { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
                { key: "Access-Control-Allow-Headers", value: "Content-Type, X-Region" },
                { key: "Access-Control-Max-Age", value: "86400" },
                { key: "Vary", value: "Origin" },
              ],
            },
          ];
        },
      }),
};
export default nextConfig;
