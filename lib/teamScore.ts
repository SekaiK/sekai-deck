// 라이브 점수·이벤트 포인트 계산에서 스킬 발동 순서를 게임 규칙에 맞춰 넣는 부분 (서버·브라우저 공용)
//
// 솔로·오토 라이브: 1~5번째 스킬은 덱 5장의 스킬이 무작위 순서로 발동해서 5장 평균으로 계산하고,
//                  6번째(앵콜) 스킬은 리더 카드 스킬.
// 멀티·치어풀 라이브: 5명이 각자 실효 스킬(리더 스킬 + 나머지 4장 스킬 합 × 0.2)로 한 번씩 발동하는데 순서가 무작위라
//                  1~5번째는 5명 실효 스킬의 평균, 6번째(앵콜)는 5명 중 종합력이 가장 높은 사람의 실효 스킬.
//                  팀원을 입력하지 않은 자리는 내 덱과 같은 종합력·실효 스킬로 본다.
//                  액티브 보너스(멀티만)는 5명 종합력 합으로 계산.
import { EventCalculator, LiveCalculator, LiveType, type DeckDetail, type EventType, type MusicMeta } from "sekai-calculator";

export interface Teammate {
  /** 종합력 */
  power: number;
  /** 실효 스킬(%) */
  skill: number;
}

/** 덱 하나로 점수·이벤트 포인트를 내는 함수 묶음 */
export interface Scorer {
  liveScore: (meta: MusicMeta, deck: DeckDetail) => number;
  point: (meta: MusicMeta, deck: DeckDetail) => number;
}

/** 내 덱의 실효 스킬: 리더 스킬 + 나머지 4명 스킬 합 × 0.2 */
export function deckEffectiveSkill(deck: DeckDetail) {
  return deck.cards.reduce((sum, c, i) => sum + (i === 0 ? c.skill.scoreUp : c.skill.scoreUp * 0.2), 0);
}

/** 라이브러리는 6번째 스킬이 0이면 넣어 준 스킬 목록을 무시하므로, 아주 작은 값으로 바꿔 넣음 */
const nonZero = (v: number) => (v > 0 ? v : 1e-9);
const deckBonusOf = (deck: DeckDetail) => (deck.eventBonus ?? 0) + (deck.supportDeckBonus ?? 0);

/** 솔로·오토 라이브 */
export function makeSoloScorer(liveType: LiveType, eventType: EventType): Scorer {
  const liveScore = (meta: MusicMeta, deck: DeckDetail) => {
    const skills = deck.cards.map((c) => c.skill.scoreUp);
    const avg = skills.reduce((a, b) => a + b, 0) / Math.max(1, skills.length);
    const details = [
      ...Array.from({ length: 5 }, () => ({ scoreUp: avg, lifeRecovery: 0 })),
      { scoreUp: nonZero(deck.cards[0]?.skill.scoreUp ?? 0), lifeRecovery: 0 },
    ];
    return LiveCalculator.getLiveDetailByDeck(deck, meta, liveType, details).score;
  };
  return {
    liveScore,
    point: (meta, deck) =>
      EventCalculator.getEventPoint(liveType, eventType, liveScore(meta, deck), meta.event_rate, deckBonusOf(deck)),
  };
}

/** 멀티·치어풀 라이브 (팀원은 최대 4명, 비운 자리는 내 덱과 같다고 봄) */
export function makeTeamScorer(liveType: LiveType, eventType: EventType, teammates: Teammate[]): Scorer {
  const live = (meta: MusicMeta, deck: DeckDetail) => {
    const ownPower = deck.power.total;
    const ownSkill = deckEffectiveSkill(deck);
    const members: Teammate[] = [
      { power: ownPower, skill: ownSkill },
      ...[0, 1, 2, 3].map((i) => teammates[i] ?? { power: ownPower, skill: ownSkill }),
    ];
    const avg = members.reduce((a, m) => a + m.skill, 0) / 5;
    // 앵콜: 종합력이 가장 높은 사람 (같으면 앞사람, 즉 나부터)
    const encore = members.reduce((best, m) => (m.power > best.power ? m : best), members[0]);
    const details = [
      ...Array.from({ length: 5 }, () => ({ scoreUp: avg, lifeRecovery: 0 })),
      { scoreUp: nonZero(encore.skill), lifeRecovery: 0 },
    ];
    const powerSum = members.reduce((a, m) => a + m.power, 0);
    const scoreFor = (power: number) =>
      LiveCalculator.getLiveDetailByDeck({ ...deck, power: { ...deck.power, total: power } }, meta, liveType, details, powerSum)
        .score;
    const self = scoreFor(ownPower);
    const others = members.slice(1).reduce((a, m) => a + scoreFor(m.power), 0);
    return { self, others };
  };
  return {
    liveScore: (meta, deck) => live(meta, deck).self,
    point: (meta, deck) => {
      const { self, others } = live(meta, deck);
      return EventCalculator.getEventPoint(liveType, eventType, self, meta.event_rate, deckBonusOf(deck), 1, others);
    },
  };
}

/** 라이브 종류에 맞는 점수 계산 */
export function makeScorer(liveType: LiveType, eventType: EventType, teammates: Teammate[]): Scorer {
  return liveType === LiveType.MULTI || liveType === LiveType.CHEERFUL
    ? makeTeamScorer(liveType, eventType, teammates)
    : makeSoloScorer(liveType, eventType);
}
