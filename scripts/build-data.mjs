// 브라우저에서 덱을 계산할 때 쓰는 게임 데이터를 만든다. (GitHub Actions의 정적 빌드 전에 실행)
//   node scripts/build-data.mjs  →  public/data/kr/*.json, public/data/jp/*.json, public/data/music_metas.json
// 원본(Sekai-World 마스터 데이터)에서 덱 계산에 쓰는 파일만 받고, 계산에 쓰지 않는 큰 항목을 빼서 크기를 줄인다.
// 특히 카드 파라미터는 사이트가 쓰는 최대 레벨 값만 남긴다(lib/recommendCore.ts의 MAX_LEVEL과 같아야 함).
// (원본 데이터와 줄인 데이터로 한섭·일섭 과거 이벤트 46개를 계산해 결과가 모두 같은 것을 확인함)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "data");
const MASTER = {
  kr: "https://raw.githubusercontent.com/Sekai-World/sekai-master-db-kr-diff/main",
  jp: "https://raw.githubusercontent.com/Sekai-World/sekai-master-db-diff/main",
};
const MUSIC_META_URL = "https://storage.sekai.best/sekai-best-assets/music_metas.json";

/** 덱 계산(계산 라이브러리 + 사이트 코드)이 읽는 파일 */
const KEYS = [
  "cards",
  "cardEpisodes",
  "cardRarities",
  "cardMysekaiCanvasBonuses",
  "masterLessons",
  "skills",
  "characterRanks",
  "gameCharacters",
  "gameCharacterUnits",
  "events",
  "eventCards",
  "eventDeckBonuses",
  "eventRarityBonusRates",
  "eventCardBonusLimits",
  "eventSkillScoreUpLimits",
  "eventTotalPowerLimits",
  "eventHonorBonuses",
  "eventMysekaiFixtureGameCharacterPerformanceBonusLimits",
  "worldBlooms",
  "worldBloomDifferentAttributeBonuses",
  "worldBloomSupportDeckBonuses",
  "worldBloomSupportDeckUnitEventLimitedBonuses",
  "areaItems",
  "areaItemLevels",
  "mysekaiGates",
  "mysekaiGateLevels",
  "honors",
  "musics",
  "musicDifficulties",
];

/** 레어도별 최대 레벨 (lib/recommendCore.ts의 MAX_LEVEL과 같게) */
const MAX_LEVEL = { rarity_1: 20, rarity_2: 30, rarity_3: 50, rarity_4: 60, rarity_birthday: 60 };

const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const pick = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));

/** 파일별로 계산에 쓰지 않는 큰 항목 빼기 */
const TRIM = {
  cards: (list) =>
    list.map((c) => {
      const level = MAX_LEVEL[c.cardRarityType] ?? 1;
      const p = c.cardParameters;
      // 최대 레벨의 파라미터 3개만 (배열 형식으로 통일)
      const cardParameters = Array.isArray(p)
        ? p.filter((x) => x.cardLevel === level)
        : ["param1", "param2", "param3"].map((t) => ({ cardLevel: level, cardParameterType: t, power: p?.[t]?.[level - 1] ?? 0 }));
      return {
        ...omit(c, ["gachaPhrase", "flavorText", "cardSkillName", "prefix", "assetbundleName", "archivePublishedAt", "archiveDisplayType"]),
        cardParameters,
      };
    }),
  cardEpisodes: (list) => list.map((e) => omit(e, ["title", "scenarioId", "assetbundleName", "rewardResourceBoxIds", "costs"])),
  masterLessons: (list) => list.map((m) => omit(m, ["costs", "rewards"])),
  skills: (list) => list.map((s) => omit(s, ["description", "shortDescription", "descriptionSpriteName"])),
  characterRanks: (list) => list.map((r) => omit(r, ["rewardResourceBoxIds", "characterScenarioId"])),
  events: (list) =>
    list.map((e) =>
      omit(e, ["eventRankingRewardRanges", "bgmAssetbundleName", "assetbundleName", "eventPointAssetbundleName", "virtualLiveId"]),
    ),
  // 칭호는 종합력 보너스가 있는 칭호와 이벤트 보너스 칭호만 계산에 쓰임 (사이트도 이 칭호만 입력받음)
  honors: (list, ctx) =>
    list
      .filter((h) => (h.levels ?? []).some((l) => l.bonus > 0) || ctx.eventHonorIds.has(h.id))
      .map((h) => ({ ...pick(h, ["id", "groupId", "honorRarity"]), levels: (h.levels ?? []).map((l) => pick(l, ["level", "bonus"])) })),
  musics: (list) => list.map((m) => pick(m, ["id", "publishedAt"])),
  musicDifficulties: (list) => list.map((d) => pick(d, ["id", "musicId", "musicDifficulty", "playLevel", "totalNoteCount"])),
};

async function fetchText(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
      throw new Error(`${url} ${res.status}`);
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  return null;
}

let total = 0;
for (const [region, base] of Object.entries(MASTER)) {
  const dir = path.join(OUT, region);
  await mkdir(dir, { recursive: true });
  // 이벤트 보너스 칭호 번호 (칭호 줄이기에 씀)
  const eventHonors = JSON.parse((await fetchText(`${base}/eventHonorBonuses.json`)) ?? "[]");
  const ctx = { eventHonorIds: new Set(eventHonors.map((b) => b.honorId)) };
  for (const key of KEYS) {
    const text = await fetchText(`${base}/${key}.json`);
    const list = text ? JSON.parse(text) : [];
    const body = JSON.stringify(TRIM[key] ? TRIM[key](list, ctx) : list);
    await writeFile(path.join(dir, `${key}.json`), body);
    total += body.length;
    console.log(`${region}/${key}.json  ${(body.length / 1024).toFixed(0)}KB  (원본 ${((text?.length ?? 0) / 1024).toFixed(0)}KB)`);
  }
}

// 곡 메타 (곡별 점수 계산용). 받지 못해도 계속 진행하고, 브라우저 계산은 기본 곡으로 대체됨
let metas = null;
try {
  metas = await fetchText(MUSIC_META_URL);
} catch (e) {
  console.warn(`곡 메타 받기 실패: ${e.message}`);
}
if (metas) {
  await writeFile(path.join(OUT, "music_metas.json"), metas);
  total += metas.length;
  console.log(`music_metas.json  ${(metas.length / 1024).toFixed(0)}KB`);
} else {
  console.warn("곡 메타를 받지 못했어요. 브라우저 계산은 기본 곡으로 대체돼요.");
}
await writeFile(path.join(OUT, "version.json"), JSON.stringify({ builtAt: Date.now() }));
console.log(`합계 ${(total / 1024 / 1024).toFixed(1)}MB`);
