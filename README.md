# 세카이 덱 메이커

프로젝트 세카이 **한국 서버·일본 서버**에서 내가 가진 카드로 이벤트 최적 덱을 찾아 주는 사이트입니다.

- 보유 카드 체크 (직접 체크 또는 게임 카드 목록 스크린샷으로 한 번에 추가)
- 내실 입력 (캐릭터 랭크, 에어리어 아이템, 마이세카이, 칭호 / 에어리어 아이템은 스크린샷으로 입력 가능)
- 덱 편성 도우미 (현재·미래·과거 이벤트, 월드 링크 챕터, 카드·캐릭터·리더 고정, 멀티 라이브 팀원 정보, 실효 스킬 표시)

## 구조

화면과 계산 서버를 나눠서 운영합니다.

| 역할 | 위치 | 하는 일 |
|---|---|---|
| 화면 | GitHub Pages | 모든 화면, **덱 계산(브라우저에서 직접)** |
| API 서버 | 구글 클라우드 (Nginx → Next.js) | 스크린샷 카드 대조, 에어리어 아이템 글자 인식, 카드 썸네일 |

- 화면은 GitHub Actions(`.github/workflows/pages.yml`)가 `main`에 올릴 때와 매일 15:01·20:01(한국 시간)에 자동으로 다시 빌드합니다.
- 빌드 때 `scripts/build-data.mjs`가 덱 계산에 필요한 게임 데이터만 줄여서(한섭 약 3MB, 일섭 약 4MB) 사이트에 함께 올립니다.

## 설정

**GitHub 저장소 변수** (Settings → Secrets and variables → Actions → Variables)
- `API_BASE`: API 서버 주소 (예: `https://sekai-api.duckdns.org`, 끝에 `/` 없이)
- `BASE_PATH` (선택): 사이트 하위 주소. 없으면 저장소 이름(`/sekai-deck`)을 씁니다.

**API 서버** 프로젝트 폴더의 `.env.production.local`
```
ALLOWED_ORIGIN=https://아이디.github.io
```
값을 바꾼 뒤에는 `npm run build`를 다시 해야 적용됩니다.

## 실행

```bash
npm ci
npm run build
npm start   # http://localhost:3000
```

내 PC에서 브라우저 덱 계산까지 확인하려면 먼저 `node scripts/build-data.mjs`를 한 번 실행합니다. 데이터가 없으면 덱 계산은 서버 API(`/api/recommend`)로 대신 합니다.

## 주요 파일

- `lib/recommendCore.ts` — 덱 추천 계산 (서버·브라우저 공용)
- `lib/deckSearch.ts` — 빠른 덱 탐색
- `lib/teamScore.ts` — 라이브 종류별 스킬 발동 순서 (솔로: 1~5번째 평균·앵콜은 리더 / 멀티: 5명 실효 스킬 평균·앵콜은 종합력이 가장 높은 사람)
- `lib/recommendClient.ts`, `lib/recommend.ts` — 브라우저용·서버용 데이터 받기
- `lib/master.ts`, `lib/events.ts`, `lib/songs.ts`, `lib/growth.ts` — 화면에 쓰는 게임 데이터
- `lib/screenshot.ts`, `lib/cardMatch.ts`, `lib/areaItemOcr.ts` — 스크린샷 인식
- `lib/patchNotes.ts` — 첫 화면 패치 노트 (업데이트할 때마다 맨 위에 추가)
- `app/ApiBridge.tsx` — GitHub Pages 화면의 `/api/...` 요청을 API 서버로 연결

## 참고

- 게임 데이터: Sekai-World 마스터 데이터(한국판·일본판), 곡 데이터: Sekai Viewer
- 카드 이미지는 게임사(SEGA·Colorful Palette)의 저작물입니다.
- 보유 카드·내실은 브라우저에만 저장됩니다. 다른 기기·주소로 옮길 때는 보유 카드 화면의 내보내기·가져오기를 쓰세요.
