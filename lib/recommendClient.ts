// 브라우저에서 덱 계산: 사이트에 함께 올린 작은 게임 데이터(public/data, scripts/build-data.mjs로 만듦)를 받아
// lib/recommendCore.ts로 계산한다. 계산 서버에 요청을 보내지 않아서 서버가 꺼져 있어도 동작한다.
import type { MusicMeta } from "sekai-calculator";
import { BASE_PATH, type Region } from "./region";
import { createRecommender, type RecommendInput, type RecommendResult } from "./recommendCore";

/** 사이트에 계산용 데이터가 없음 (서버에서 직접 실행하는 경우 등) → 화면은 서버 API로 계산 */
export class ClientDataMissing extends Error {}

const cache = new Map<string, Promise<unknown>>();

function loadJson<T>(file: string): Promise<T> {
  const url = `${BASE_PATH}/data/${file}`;
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url)
      .then(async (res) => {
        if (res.status === 404) throw new ClientDataMissing(file);
        if (!res.ok) throw new Error(`게임 데이터(${file})를 받지 못했어요. (${res.status})`);
        return (await res.json()) as T;
      })
      .catch((e) => {
        cache.delete(url); // 실패는 보관하지 않음
        throw e;
      });
    cache.set(url, p);
  }
  return p;
}

const recommend = createRecommender({
  getMasterFile: async <T,>(key: string, region: Region) => {
    try {
      return await loadJson<T[]>(`${region}/${key}.json`);
    } catch (e) {
      // 카드 데이터가 없으면 데이터 전체가 없는 것으로 보고, 다른 파일이 없으면 서버처럼 빈 목록으로 처리
      if (e instanceof ClientDataMissing && key !== "cards") return [] as T[];
      throw e;
    }
  },
  getMusicMetas: async () => {
    try {
      return await loadJson<MusicMeta[]>("music_metas.json");
    } catch {
      return null;
    }
  },
});

/** 브라우저에서 덱 추천 */
export function recommendInBrowser(input: RecommendInput): Promise<RecommendResult> {
  return recommend(input);
}
