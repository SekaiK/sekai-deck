// 서버 쪽 덱 추천: 게임 데이터를 GitHub 원본에서 받아 메모리에 보관하고, 계산은 lib/recommendCore.ts를 쓴다.
// 화면(브라우저)은 보통 lib/recommendClient.ts로 직접 계산하고, 사이트에 계산용 데이터가 없을 때만 이 서버 API(/api/recommend)를 부른다.
// 곡 목록·내실·스크린샷 인식 등 다른 서버 코드도 여기의 getMasterFile, getMusicMetas를 쓴다.
import "server-only";
import type { MusicMeta } from "sekai-calculator";
import { fetchWithRetry } from "./fetchRetry";
import { REGIONS, type Region } from "./region";
import { createRecommender } from "./recommendCore";

export * from "./recommendCore";

const MUSIC_META_URL = process.env.MUSIC_META_URL ?? "https://storage.sekai.best/sekai-best-assets/music_metas.json";
const CACHE_MS = 60 * 60 * 1000;

// ---------- 메모리 캐시 (큰 JSON이라 Next 데이터 캐시 대신 사용) ----------
const memo = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>;
  const value = load().catch((e) => {
    memo.delete(key); // 실패는 캐시하지 않음
    throw e;
  });
  memo.set(key, { at: Date.now(), value });
  return value;
}

/** 메모리에 보관한 게임 데이터를 비움 (오후 3시·8시 화면 갱신 때 새로 받도록) */
export function clearMasterCache() {
  memo.clear();
}

/** 게임 데이터 파일. region을 빼면 한국 서버 */
export function getMasterFile<T>(key: string, region: Region = "kr"): Promise<T[]> {
  return cached(`master:${region}:${key}`, async () => {
    // 화면을 정적으로 만들 수 있게 no-store 대신 태그 캐시 사용 (오후 3시·8시 갱신 때 함께 비워짐).
    // 2MB가 넘는 파일은 Next가 저장하지 않지만 위의 메모리 캐시로 충분함
    const res = await fetchWithRetry(`${REGIONS[region].masterBase}/${key}.json`, {
      next: { revalidate: false, tags: ["master"] },
    });
    // 한국판에 아직 없는 파일(신규 시스템 등)은 빈 배열로 처리
    if (res.status === 404) return [] as T[];
    if (!res.ok) throw new Error(`${key}.json 불러오기 실패 (${res.status})`);
    return (await res.json()) as T[];
  });
}

/** 곡 메타 전체. 받아오지 못하면 null */
export async function getMusicMetas(): Promise<MusicMeta[] | null> {
  try {
    return await cached("musicMetas", async () => {
      const res = await fetchWithRetry(MUSIC_META_URL, { next: { revalidate: false, tags: ["master"] } });
      if (!res.ok) throw new Error(`music_metas ${res.status}`);
      return (await res.json()) as MusicMeta[];
    });
  } catch {
    return null;
  }
}

/** 서버에서 덱 추천 (API /api/recommend가 씀) */
export const recommendDecks = createRecommender({ getMasterFile, getMusicMetas });
