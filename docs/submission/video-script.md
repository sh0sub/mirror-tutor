# 데모 영상 스크립트 (약 2:55, 175.3초)

이슈 #28 시나리오를 현재 앱 라우트(`/capture` `/analyze` `/lesson` `/compare` `/grade` `/shop` `/share`)에 맞춘 촬영안. 영상은 1~3분, YouTube 공개, 제3자 상표·음악 없음, 실기기 구동 장면 포함. 나레이션은 영어(Devpost 심사용), 자막은 한국어를 기본으로 하고 영어 자막은 나레이션과 같은 문장을 쓴다.

## 시작 전 필수

- Vercel을 `YOUCAM_MODE=live`로 바꾸고 재배포한 뒤 촬영한다. mock 모드로 찍으면 VTO 결과가 YouCam 결과가 아니라 로컬 오버레이다.
- 유닛 잔량이 250 이상인지 먼저 본다(홈의 잔량 표시 또는 `/api/credit`).
- 영상에 나오는 얼굴은 본인 또는 동의받은 모델뿐이다. `public/demo/model-a|b`는 Pexels License, `model-c`는 Unsplash License 스톡 사진이다.
- "저는 홑꺼풀이에요"는 #28 원문 대사다. 본인 눈이 실제로 홑꺼풀이고 API가 Single-lid로 읽는지 확인 필요. 다르게 읽히면 분석 결과 화면의 수정 시트에서 고칠 수 있다(0 유닛). 거짓 대사가 되지 않게 대사를 실제 결과에 맞춘다.
- 채점 점수 "78"은 시나리오의 예시 값이다. 화면에 실제로 나온 값을 말하고 자막도 그 값으로 쓴다.

## 샷 리스트

시간은 편집 후 기준. 화면: 데스크톱 = OBS 녹화(브라우저 폭 390 모바일 뷰), 폰 = 갤럭시 화면 녹화.

| # | 시간 | 화면 / 라우트 | 폰에서 할 일 | 나레이션 (EN) | 자막 (KO) |
|---|---|---|---|---|---|
| 1 | 0:00-0:08 | 폰: 튜토리얼 따라 하는 손(제3자 영상 화면 노출 금지, 손거울이나 빈 화면만) -> 내 눈 클로즈업 | 거울 보며 눈에 라인 긋는 장면 직접 촬영 | "Tutorials are filmed on someone else's face. I have monolids." | 튜토리얼은 그 사람 얼굴 기준이에요. 저는 홑꺼풀이에요. |
| 2 | 0:08-0:15 | `/grade` 결과 화면(이전 테이크의 결과를 먼저 보여 줌). 부위별 점수, 신뢰도 | 결과 화면 스크롤 없이 점수와 한 줄 교정을 보여 줌 | "Mirror Tutor builds the answer on my own face, then grades what I actually drew." | Mirror Tutor는 내 얼굴로 정답을 만들고, 내가 그린 걸 채점합니다. |
| 3 | 0:15-0:30 | `/capture` 가이드 실패(어두움 또는 얼굴 작음) -> 통과 | 불을 끈 채로 촬영해 "얼굴 폭 xx% / 필요 60%" 실패 문구를 보이고, 불을 켜서 통과 | "It guides the shot to YouCam's input requirements first, so no unit is wasted," | YouCam 입력 조건에 맞게 촬영을 안내해서 유닛 낭비를 막아요. |
| 4 | 0:30-0:50 | `/analyze` 분석 중 -> 결과(눈꺼풀, 입술 등) -> 수정 시트 열기 -> "규칙표 보기" 잠깐 노출 | 결과 칩을 탭해 수정 시트를 열었다 닫고, 규칙표(눈꺼풀 -> 기법)를 2초 보여 줌 | "YouCam Face Analyzer reads eyelid, eye shape, lips, face and brows, 10 units. If it's wrong, I can correct it, and a rule table maps each feature to a technique." | Face Analyzer가 눈꺼풀·눈·입술·얼굴형·눈썹을 읽어요(10 유닛). 틀리면 고치고, 규칙표가 기법을 정해요. |
| 5 | 0:50-1:25 | `/lesson?lesson=daily-k` 단계 1 -> 4, 전/후 슬라이더, "왜 당신은" 근거 칩 확대 | 단계마다 다음 탭, 단계 3(눈)에서 슬라이더를 50%로 두고 근거 칩 확대 | "Makeup VTO draws each step on my face as the answer key, one unit per step. Because these are monolids, the liner goes sideways and the shadow spreads horizontally. The rules change with the face." | Makeup VTO가 단계마다 내 얼굴에 정답을 그려요(단계당 1 유닛). 홑꺼풀이라 섀도는 가로로, 라인은 눈을 뜨고 보이게. 얼굴이 다르면 규칙도 달라져요. |
| 6 | 1:25-1:40 | `/compare` 두 얼굴 비교(model-a 쌍꺼풀, model-b 속쌍). 단계 탭 전환, 규칙 차이 표 | 단계 4 탭, 같음/다름 표시 보여 줌 | "Same look, two faces, two techniques." | 같은 룩, 다른 얼굴, 다른 기법. |
| 7 | 1:40-2:00 | 폰: 실제로 그리는 컷(빠르게) -> `/grade` 시도 촬영 -> 채점 -> 한 줄 교정 | 그린 얼굴을 촬영하고 채점 결과의 신뢰도 문구를 보여 줌 | "Then I draw it for real. Per-region scores, a one-line correction, and a confidence level that drops when my lighting differs." | 직접 그린 뒤 채점해요. 부위별 점수와 한 줄 교정, 조명이 다르면 신뢰도도 같이 보여 줘요. |
| 8 | 2:00-2:15 | `/shop` 단계 스와치 hex -> 제품 카드, 색차 ΔE | 스와치 탭, ΔE 표시와 "데모 데이터" 문구 | "The exact colors from each step map to products by color difference. The tutorial becomes the cart. The catalog is a demo; real SKUs would come from a partner feed." | 단계에서 쓴 색이 그대로 제품이 돼요. 카탈로그는 데모이고, 실제 SKU는 제휴 피드로 교체합니다. |
| 9 | 2:15-2:30 | `/share` 공유 카드 -> `docs/architecture.svg` 1장(3초) -> 로고 카드 | 공유 카드 저장 후 아키텍처 이미지 | "Photos are never stored, units are capped per session. Mirror Tutor: learn K-beauty on your own face." | 사진은 저장하지 않고 유닛은 세션당 상한. Mirror Tutor, 내 얼굴로 배우는 K-메이크업. |

원래 촬영안은 150초. 실제 제출용 자동 녹화본은 아래 "자동 녹화"·"재합성" 절(약 2:55)을 따른다. 나레이션이 시간보다 길면 4번과 5번 문장부터 줄인다(심사 기준: API를 어떻게 쓰는지가 보여야 하므로 8번보다 4·5번을 남긴다).

## 테이크와 유닛 예산

기본값: 세션 상한 20u, 일일 상한 120u(`DAILY_UNIT_CAP`, 서버 인스턴스 메모리 기준). 한 테이크 = 분석 10 + VTO 4단계 4 + 진하기 조절 재생성 2 = 16u.

| 테이크 | 내용 | 유닛 |
|---|---|---|
| 1 | 폰 전체 플로우(샷 3-5, 7-9). 가장 중요. 라이트 켠 상태, 정면 | 16 |
| 2 | 1이 실패했을 때 재촬영(조명, 표정) | 16 |
| 3 | 샷 7용 시도 재촬영(분석은 프로필 재사용이라 VTO만) | 4 |
| 4 | 예비 | 16 |
| 합계 | 최대 4테이크 | 52 (이슈 상한 70 이내) |

- 샷 2(결과 먼저 보여 주기)와 스크린샷은 테이크 1의 결과를 재사용한다(0u).
- 샷 6 `/compare`는 사전 생성 이미지라 0u.
- 일일 상한 120u에 가까워지면 세션이 막힌다. 막히면 Vercel의 `DAILY_UNIT_CAP`을 올리고 재배포하거나 서버가 재시작된 뒤 다시 찍는다.
- 세션 상한 20u를 넘기 전에 홈의 "세션 종료"로 세션을 끊으면 새 세션으로 시작할 수 있다. 같은 테이크 안에서 끊으면 정답 이미지가 사라지니 테이크 사이에서만 한다.

## 촬영 팁

- 데스크톱 샷(5, 6, 8, 9): Mac에서 OBS로 녹화. 브라우저를 폭 390 내외 모바일 뷰로 맞추고 북마크바·확장 아이콘·알림을 숨긴다. 해상도 1080p, 30fps.
- 폰 샷(1, 3, 4, 7): 갤럭시 기본 화면 녹화(빠른 설정 > 화면 녹화). 방해 금지 모드를 켜서 알림이 안 뜨게 한다. 카카오톡 등 다른 앱 알림, 상단 상태바의 통신사·앱 아이콘이 보이면 편집에서 잘라낸다.
- 제3자 상표 금지: 화장품 실물, 파우치, 튜토리얼 영상 화면, 로고가 보이지 않게 한다. 제품은 앱의 "MT Select"와 일반명만 노출한다.
- 음악: 무음 + 자막. 음악을 넣어야 하면 YouTube 오디오 라이브러리의 저작권 프리 곡만 쓴다.
- 얼굴: 본인만 나오게 한다. 샷 6의 샘플 모델은 스톡 사진이므로 공개 가능 라이선스(Pexels)지만 인물 사진이라는 점을 설명란에 출처로 적는다.
- 나레이션은 한 번에 읽지 말고 샷별로 녹음해 길이를 맞춘다. 영어 자막은 나레이션과 같은 문장으로 넣는다.
- 업로드: YouTube 공개(Unlisted 아님), 제목에 "Mirror Tutor - YouCam API VTO Hackathon", 설명에 라이브 URL과 저장소 URL.

## 자동 녹화(얼굴 없는 버전)

실제 얼굴 없이 앱 화면만으로 데모 영상을 만드는 녹화기. 헤드리스 Chrome(CDP, 추가 패키지 없음)이 390폭 모바일 화면에서 실제 플로우(홈 → 동의 → 스톡 사진 업로드 → 분석·베이스 색 → 레슨 슬라이더 → 두 얼굴 비교(홑꺼풀 vs 쌍꺼풀, 분석기 수정 칩) → 채점 → 샵(스토어 시트) → 홈 스트릭 → 공유)를 조작하고, macOS `say`(Samantha) 영어 나레이션과 영어 자막을 입혀 1920x1080 MP4 한 개로 합친다. 음악 없음. 얼굴은 `public/demo/model-a`(Pexels License 스톡 사진)만 쓰고, 채점용 시도 사진은 `model-a/step-3.jpg`(눈만 완성, 입술 생략)가 대신한다(영상 안에 그렇게 표시).

- 샷·나레이션: `scripts/demo/video-shots.mjs` (문장 하나 = 자막 하나, 샷 길이는 나레이션 길이를 따른다)
- 녹화기: `scripts/demo/record-video.mjs` (Chrome, ffmpeg/ffprobe, `say` 필요)

```bash
# mock: 유닛 0, YouCam 호출 없음(로컬 오버레이). Claude도 호출하지 않음(ANTHROPIC_API_KEY를 빈 값으로 덮음)
node scripts/demo/record-video.mjs --mode mock
# live: .env의 실제 키 사용. 약 14유닛(분석 10 + VTO 4단계 4), 채점 한 줄 교정은 Claude
node scripts/demo/record-video.mjs --mode live
```

- 녹화기가 `next dev -p 3611`을 `YOUCAM_MODE=<mode>`로 직접 띄우고 끝나면 끈다(명령줄 env가 `.env`보다 우선). 이미 떠 있는 서버를 쓰려면 `--base http://localhost:3611`. 그 밖의 옵션: `--port`, `--work <작업 폴더>`, `--out <mp4>`, `--voice`, `--rate`, `--stills <장 수>`.
- live 안전장치: 시작 전에 `/api/credit`이 `mode: "live"`, 데모 모드 아님, 잔량 150 이상이 아니면 중단. 실패한 단계는 재시도하지 않고 바로 중단하며, 세션 사용량이 20유닛을 넘으면 중단(앱 자체 세션 상한 20u도 그대로 적용). 한 번 돌릴 때마다 유닛이 나가므로 live는 꼭 필요할 때 한 번만 돌린다.
- 결과: `.local/video/mirror-tutor-demo-<mode>.mp4` (`.local/`은 gitignore). 프레임·음성·스테이지 이미지·`summary.json`(구간 길이, 시작/끝 잔량)은 기본값 `.local/video/work-<mode>/`에 남는다.
- 분석·렌더 대기 시간은 영상에서 잘라내고(0.8초만 남김) 각 구간 길이는 나레이션 길이에 맞춘다. 2026-11-01 live 녹화본은 `recomposite.mjs` 재합성 후 2분 51초(171초).

## 재합성(유닛 0, 새 녹화 없음)

`record-video.mjs`가 남긴 작업 폴더(`<work>/segments/*-phone.txt`, `<work>/frames`)만으로 레이아웃·나레이션·타임라인을 다시 짠다. 개발 서버와 YouCam 호출이 없다.

```bash
node scripts/demo/recomposite.mjs --src <record-video 작업 폴더> --work <임시 폴더> --out <mp4> [--stills 12] [--only intro,compare]
```

- 레이아웃: 왼쪽 제목·칩·콜아웃, 가운데 폰 462x1000, 오른쪽 같은 프레임의 1.85배 확대 패널 + 자막. 확대 창의 위치는 장면별 `zoom` 키프레임.
- 타임라인: 장면별 `timeline` 앵커로 원본 구간을 재생하거나 한 프레임을 유지한다. 어두운 "카메라 없음" 구간을 줄이는 데 쓴다.
- 나레이션(영어, `say`): 첫 장면은 홑꺼풀 문제 제기, 비교 장면은 두 얼굴의 기법 차이(콜아웃 6초), 공유 장면은 사진 미저장·세션 20유닛 상한을 말한다. 저장 프레임이 390x844라 확대는 해상도가 늘지 않는다(unsharp로 보정).
- 영상 세그먼트별 합계: 인트로 20초, 촬영 16초, 분석 27초, 레슨 24초, 비교 21초, 채점 20초, 샵 13초, 홈 13초, 공유 18초.

## 2026-11-02 C1 재녹화본 (175.6초)

- 소스 폴더: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c1` (work-live2를 복사한 뒤 intro·compare만 다시 녹화, 나머지 장면은 work-live2 프레임 그대로). 재합성 작업 폴더는 `recomp-oai`(TTS 캐시 공유), 출력은 `.local/video/mirror-tutor-demo-live.mp4`(직전 판 `-c1prev.mp4`).
- compare: `record-video.mjs --mode mock --sample --only compare`(0 유닛). 눈 단계에서 열리고, 분석기 수정 칩("Analyzer read Double-lid → corrected to Monolid")과 규칙표(홑꺼풀 2colors1·Upper6 / 쌍꺼풀 2colors3·Upper11)를 보여 준다. what-if 마무리 문장은 뺐다. 나레이션 2줄만 새 marin TTS(총 4건, 센트 단위).
- intro: 데모 모드 배너 없이 찍으려고 YOUCAM_MODE=live 로컬 서버(홈 화면만, API 호출 0)에 `--mode live --only intro --base`로 녹화. 첫 8초 안에 홑꺼풀 vs 쌍꺼풀 히어로가 보이고 왼쪽에 "Your eyelid → your technique". 나레이션은 그대로.
- home(스트릭) 장면은 실제 프로필이 필요해 work-live2 프레임을 재사용(히어로와 무관).
- 길이: 장면별 `lead`/`tail` 무음을 줄여(0.5→0.35, 0.9→0.5) 182.9초 → 175.6초. 180초 미만 유지.

## 2026-11-02 C2 영상 (175.9초)

- 소스 폴더: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c2` (work-c1을 복사하고 phone 타임라인 경로를 work-c2로 바꿈, 재녹화 없음 0 유닛). 재합성 작업 폴더 `recomp-oai`, 출력은 `.local/video/mirror-tutor-demo-live.mp4`(직전 판 `-c2prev.mp4`).
- 새 "hook" 장면(0-7.6초): compare 녹화 프레임을 맨 앞에 두고 자막 "Same look, different lids, different technique."로 시작한 뒤 앱 인트로가 이어진다. 단계 번호(How it works / Step n of 8)는 hook을 세지 않는다.
- compare: "Here's the proof" 줄을 빼고, 첫 줄을 "The analyzer missed the monolid, so we let the user correct it and the lesson changes."로 바꿈. 칩 "Analyzer read Double-lid, corrected to Monolid"이 줄 내내(약 6초) 확대 창에 보이고 두 얼굴의 눈 단계 결과가 나란히 나온다. 나머지 줄은 그대로.
- 새 marin TTS 줄 3개(hook 2줄, compare 1줄), 센트 단위. 길이 175.9초(< 180초).
- 한계: 캡처/채점 장면의 어두운 "Camera unavailable" 프레임은 이전 판과 같다(이번 변경 범위 밖).

## 2026-11-02 C3 영상 (약 168초, /partner 장면 포함)

- 소스 폴더: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c3` (work-c2를 복사한 뒤 capture·grade·partner만 다시 녹화, 나머지 장면은 기존 프레임 그대로). 재합성 작업 폴더 `recomp-oai`(TTS 캐시 공유), 출력은 `.local/video/mirror-tutor-demo-live.mp4`(직전 판 `-c3prev.mp4`). YouCam 유닛 0.
- 도입 압축: hook 한 줄("Same look, different lids, different technique.") + intro 한 줄(결과 문장: Face Analyzer가 읽고, Makeup VTO가 단계마다 그리고, 한 레슨은 14유닛)로 줄였다. 첫 15초 안에 문제·결과·비용이 다 나온다.
- 모든 장면에 배지 "YouCam Face Analyzer + Makeup VTO, live"와 유닛 카운터("YouCam units used n / 20 cap")를 확대 패널 아래에 고정했다. 값은 장면별 `units`(hook·intro·capture 0, analyze 10, 이후 14)이고 실제 live 테이크의 사용량(분석 10 + 렌더 4)과 같다.
- capture: 어두운 "Camera unavailable" 화면을 없앴다. `record-video.mjs --mode live --only capture --fake-cam <mjpeg>`(live 모드 로컬 서버, API 호출 0)로 Chrome 가짜 카메라에 스톡 사진(`public/demo/model-a/original.jpg`, Pexels License)을 작게 넣어 실제 품질 게이트를 보여 준다. 얼굴 폭 44%("Come a little closer")에서 디지털 줌으로 74%("Looks good")가 된다. 셔터는 누르지 않는다(누르면 10유닛 분석). 화면 노트에 "카메라 피드는 스톡 사진"이라고 밝힌다.
- grade: `--mode mock --sample --only grade`(0 유닛). 레슨 4단계에서 "Grade a sample try"로 샘플 시도를 채점한다(점수 91, 입술 63 교정). 카메라 화면 없이 결과로 바로 간다. 이전 live 판의 87점과 다른 값이며 샘플 모델 결과다.
- partner(신규, 약 8.5초): `--mode live --only partner --base <로컬 live 서버>`(정적 페이지, 0 유닛). 위젯과 유닛 미터("첫 레슨 14, 다음 4")를 보여 주고 "concept widget on a fictional product page"라고 밝힌다. FLOW 목록은 9단계(Retailer 추가).
- `record-video.mjs` 추가 옵션: `--fake-cam`, 액션 `{ js }`, 세그먼트별 `sample: { prep, actions }`(샘플 변형). 새 marin TTS는 intro 1줄과 partner 2줄 등 센트 단위.

## 사이클 4 재합성 (173.8초)

- 소스 프레임 디렉터리: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c4` (사이클 3 `work-c3` 복사본 + `record-video.mjs --mode mock --sample --only compare`로 /compare만 재촬영, 0 유닛). 재합성 작업 디렉터리: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/recomp-oai`.
- 훅(0:00-0:07): 제목 카드 없이 /compare 화면 위에 "Makeup tutorials fit someone else's eyes." V.O., 분석기가 홑꺼풀을 쌍꺼풀로 읽음(틀린 기법) -> 수정 -> 레슨이 달라짐을 표시.
- /compare: 눈꺼풀 규칙 아래 근거 박스(경험칙, 검증된 결과 아님)가 보이는 새 프레임, 칩에 "Basis: rule of thumb, not validated".
- /partner(10.9초): "A retailer swaps in its own SKUs; about four VTO renders per lesson." 추가. 마지막 정지 화면에서 유닛 미터(14 -> 4, 20 상한)와 KPI 가설 칩("Hypothesis - not measured")이 폰 화면과 왼쪽 설명에 함께 보임.
- 마지막 장면: URL(mirror-tutor.vercel.app)과 CTA("Try with a sample model - 0 units").
- 새 TTS 두 줄(marin, 수 센트). YouCam 유닛 0 사용. 이전 버전: `.local/video/mirror-tutor-demo-live-c4prev.mp4`.

## 사이클 5 재합성 (173.8초, 0 YouCam 유닛, TTS 비용 0)

- 소스 프레임 디렉터리: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c5` (work-c4 복사본). 재합성 작업 디렉터리 `recomp-oai`(나레이션 문구 그대로라 TTS 캐시만 사용), 직전 판은 `.local/video/mirror-tutor-demo-live-c5prev.mp4`.
- 다시 녹화(유닛 0): compare(`--mode mock --sample`), share(`--mode mock --sample`, 점수 91은 grade 장면과 같고 "Next: retailer view" 카드까지 스크롤), intro·partner(`--mode live`, 홈 하단 바의 "Retailer view (concept)" 버튼을 눌러 파트너 화면으로 들어감, API 호출 없음), home(`--mode mock --setup full`, 업로드 흐름으로 만든 복귀 사용자 홈, 모의 채점이라 점수가 sample 장면과 다름).
- 영상 뱃지: hook·intro·compare·grade·shop·partner는 "YouCam VTO, pre-generated (0 units)", 분석·레슨만 "live", capture·home·share는 각각 온디바이스/기기 저장/샘플 체험(0 유닛)으로 표기. compare 규칙 행은 원시 토큰 대신 평어 라벨.

## 사이클 6 재합성 (174.4초, YouCam 유닛 10 사용, TTS 새 줄 3개)

- 소스 프레임 디렉터리: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c6` (work-c5 복사본). 재합성 작업 디렉터리 `recomp-oai`(marin TTS 캐시 공유), 직전 판은 `.local/video/mirror-tutor-demo-live-c6prev.mp4`. 교체 전 백업: `scratchpad/win/backup`.
- 새 오프닝(약 7초): 몽타주 5.4초(레슨 단계 -> 전후 슬라이더 -> 점수 91 -> 상품 카드, V.O. "A makeup lesson, rendered on your own eyelid.") + 제목 카드 1.5초(YouCam AI Face Analyzer, YouCam Makeup Virtual Try-On). 이어서 홑꺼풀 vs 쌍꺼풀 훅. 몽타주는 기존 프레임만 재사용(`recomposite.mjs` 타임라인 항목의 `from`으로 다른 녹화 참조).
- 길이를 맞추려고 intro 문장을 줄이고("Face Analyzer reads your face. Makeup Virtual Try-On paints each step. A full lesson costs fourteen units."), analyze 마지막 줄을 줄이고, 무음 꼬리 0.5 -> 0.35초. 175.9 -> 174.4초.
- analyze: 규칙표 시트에 평어("2-color shadow, style 3 · upper liner, style 11")가 보이도록 live 모드로 다시 녹화(10 유닛, 잔량 900 -> 890). `record-video.mjs --mode live --setup upload --only analyze`(새 `upload` 설정: 스톡 사진 업로드 후 분석 시작에서 멈춤).
- home: `--mode mock --setup full91 --only home`(새 설정: 연습 기록에 샘플 점수 91을 미리 넣고 업로드 흐름 진행). 지난 결과가 91로 grade·share 장면과 일치. 화면 노트에 "sample score"라고 밝혔다. grade 노트에도 "sample score (91)".
- 푸터: analyze·lesson만 "live YouCam API (this scene)", 나머지는 "sample model, pre-generated YouCam results".
- 알려진 문제(앱, 영상 범위 밖): 현재 HEAD의 /compare에서 nowrap 칩("Analyzer read Double-lid → corrected to Monolid")이 열 폭을 넘어 오른쪽 열 글자와 겹친다. 그래서 compare·hook은 겹침 없는 C5 프레임을 그대로 썼다(칩이 줄바꿈된 옛 모양). 앱 수정 후 `--mode mock --sample --only compare`로 다시 찍으면 된다.

## 사이클 7 재합성 (169.7초, YouCam 유닛 3 사용, 새 TTS 줄 6개 이하, 센트 단위)

- 소스 프레임 디렉터리: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c7` (work-c6 복사본 + `record-video.mjs --mode mock --sample --only compare`만 재촬영, 0 유닛). 재합성 작업 디렉터리 `recomp-oai`(marin TTS 캐시 공유), 직전 판 `.local/video/mirror-tutor-demo-live-c7prev.mp4`.
- 첫 9초: 몽타주(5.4초)와 제목 카드(1.5초)를 뺐다. 0:00부터 /compare 화면(분석기가 쌍꺼풀로 읽음 -> 홑꺼풀로 수정 칩)에 V.O. "Makeup tutorials fit someone else's eyes." -> "Mirror Tutor redraws the look for your lid, monolid or double."(약속 + 홑꺼풀/쌍꺼풀 결과). YouCam 이름은 푸터 배지와 다음 intro 장면이 말한다.
- capture: 마지막 줄("licensed stock photo")을 빼고 같은 내용을 화면 노트와 콜아웃에 남겼다(어두운 카메라 구간 약 3.7초 감소). grade 첫 줄을 짧게.
- 새 비교: 홑꺼풀 얼굴(model-c)의 눈 단계를 가로 그라데이션(섀도 패턴 2colors1, 우리 규칙)과 세로 그라데이션(2colors3, 일반 튜토리얼 기법)으로 나란히 보여 주는 섹션이 /compare에 생겼다. 기존에 없던 렌더라 `scripts/demo/generate-vertical.ts`로 Makeup VTO 2회(2 유닛) + 처음 시험 1회(1 유닛, 폐기) = 3 유닛, 잔량 890 -> 887. 두 렌더 모두 섀도 진하기 100(50에서는 차이가 거의 안 보임). 가로/세로는 YouCam 패턴 스타일에 우리가 붙인 이름이라는 점, 경험칙이며 검증되지 않았다는 점, 눈꺼풀을 수정 시트에서 홑꺼풀로 고쳤다는 점을 화면 문구와 나레이션("Both are real YouCam renders")에 그대로 썼다. 렌더를 보면 세로(스타일 3) 쪽이 눈두덩 위 음영이 더 눈에 띈다. 규칙표의 "세로는 사라진다" 설명은 경험칙일 뿐이라는 문구를 유지했다.
- compare 장면 20.7초(+5.8): V.O. 2줄 교체/신규. chip 겹침은 HEAD의 줄바꿈 칩으로 새로 촬영해 해소.
- 검증: 장면 전환 감지(select gt(scene,0.08)) 20곳은 세그먼트 경계와 의도한 디졸브뿐, 스켈레톤/빈/배너 프레임 없음.

## 사이클 8 재합성 (173.9초, YouCam 유닛 0 사용, 새 TTS 줄 1개, 센트 단위)

- 소스 프레임 디렉터리: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c8` (work-c7 복사본 + `record-video.mjs --mode mock --sample --only compare`만 재촬영, 0 유닛). 재합성 작업 디렉터리 `recomp-oai`(marin TTS 캐시 공유), 직전 판 `.local/video/mirror-tutor-demo-live-c8prev.mp4`.
- compare 재촬영 이유: C7 프레임의 근거 박스에 "vertical gradient disappears" 옛 문구가 있었는데, 바로 뒤 장면의 세로 렌더에는 띠가 보여 서로 어긋났다. 현재 HEAD 문구(가로가 더 깔끔한 깊이로 읽힌다는 경험칙, 둘 다 렌더되며 차이는 미묘함, 검증된 결과 아님)로 교체. gradientNote도 새 문구.
- home(스트릭·지난 결과): 두 줄을 한 줄로 줄여 11.3 -> 9.0초(새 TTS 한 줄).
- 마지막 5.5-8초 구간: 6.5초 무음 마감 카드(제목 "Learn makeup, on your own face", 칩 "4 VTO calls per lesson" / "Retailer SKUs at the end" / "No pilot claimed", URL과 해커톤 프로토타입 표기). 360p 크기에서도 칩과 자막이 읽힘을 확인.
- 검증: 장면 전환 감지 24곳은 세그먼트 경계, 의도한 디졸브, compare 스크롤 구간뿐. 스켈레톤/빈/배너 프레임 없음.

## 2026-11-02 C9 앱 변경 (영상 장면 영향)

- 홈: 첫 방문 하단 바가 바뀌었다(채운 기본 버튼 "Try with a sample model · 0 units", 한 줄 "No selfie needed - 30 s walk-through", 보조 "Use my own selfie" + "Retailer view (concept)"). 기존 영상의 intro/home 장면은 이전 하단 바(Get started 기본 버튼)를 보여 준다. `video-shots.mjs`의 탭 대상은 새 라벨로 바꿨다.
- grade/share/home 점수: 샘플 시도가 시뮬레이션 사진(`sample-attempt.jpg`)으로 바뀌어 점수가 91 -> 79(눈 라인 77, 눈두덩 85, 볼 93, 립 62)가 됐고 부위마다 ΔE와 색 스와치가 보인다. 기존 영상의 91, 입술 63 장면은 오래된 값이다. 다시 녹화 시 `--setup full91`은 이제 79를 심는다. 영상 끝 카드 문구는 `recomposite.mjs`에서 "No selfie needed · 30 s walk-through"로 바꿨다.
- /partner 390폭 가로 넘침을 고쳤다(스니펫 줄바꿈). 영상 partner 장면은 넘침이 있던 판이다.


## 사이클 9 재합성 (171.6초, YouCam 유닛 0 사용, 새 TTS 줄 1개, 센트 단위)

- 소스 프레임 디렉터리: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c9` (work-c8 복사본). 재합성 작업 디렉터리 `recomp-oai`(marin TTS 캐시 공유), 직전 판 `.local/video/mirror-tutor-demo-live-c9prev.mp4`.
- 오프닝: 몽타주와 제목 카드는 C7에서 이미 뺐다. 0:00부터 /compare 화면(분석기가 쌍꺼풀로 읽음 -> 홑꺼풀 수정 칩)과 "Makeup tutorials fit someone else's eyes."가 나오고, 첫 분석 얼굴 렌더가 화면에 계속 보인다. 이번에는 오프닝을 바꾸지 않았다.
- 다시 녹화(0 유닛): grade·share(`--mode mock --sample`, 점수 79, 시뮬레이션 시도 안내문, 부위별 ΔE와 스와치), home(`--mode mock --setup full91`, 지난 결과 79), intro·partner(`--mode live`, API 호출 없음, 새 하단 바와 줄바꿈된 스니펫).
- `record-video.mjs`: `full91`은 업로드 흐름이 모의 채점(80)을 저장한 뒤 다시 79를 심고 새로고침한다(새로고침 때문에 지난 결과 썸네일 사진은 빈 칸). 영상 노트는 "Past result seeded to the sample score (79) ... for this demo"로 밝혔다.
- 나레이션 1줄 변경: grade 첫 줄 "Now draw the look, snap it. A simulated attempt stands in."(샘플 시도가 시뮬레이션이므로). 끝 카드는 5.0초, URL "mirror-tutor.vercel.app"을 124px 버튼으로 키우고 "Tap Try with a sample model · 0 units"를 함께 둠(6.5 -> 5.0초).
- 검증: 장면 전환 감지(select gt(scene,0.08)) 23곳은 세그먼트 경계, 의도한 디졸브, compare·shop 스크롤뿐. 스켈레톤/빈/배너 프레임 없음. 자막은 나레이션 줄과 같은 문자열.

## 사이클 10 재합성 (175.3초, YouCam 유닛 0 사용, 새 TTS 줄 3개, 센트 단위)

- 소스 프레임 디렉터리: `/private/tmp/claude-501/-Users-lsh-workspace/694b9d85-0502-4f7f-aee6-d069c0ec771f/scratchpad/submit/mirror-tutor/work-c10` (work-c9 복사본 + `record-video.mjs --mode mock --sample --only cold`로 새 콜드 오픈 장면만 재촬영, 0 유닛). 재합성 작업 디렉터리 `recomp-oai`(marin TTS 캐시 공유), 직전 판 `.local/video/mirror-tutor-demo-live-c10prev.mp4`.
- 콜드 오픈(0-약 10초, `hook` 장면 교체): 샘플 모델 얼굴에 실제 YouCam Makeup VTO 결과(레슨 4단계 answer 렌더, 사전 생성)가 그려지는 전후 슬라이더. 자막 겸 큰 캡션 "Tutorials are filmed on someone else's face. This one is rendered on yours." 폰은 프레임 높이의 80%(864/1080 px, 프레임 약 1:1), 오른쪽에 얼굴 클로즈업. 이어서 "Mirror Tutor redraws the look for your own lid." 이전 hook의 분석기 오독·수정 칩은 이 장면에서 빠졌고 compare 장면이 그대로 설명한다. `recomposite.mjs`에 장면별 `geo`(폰/확대 창 크기)와 `cold` 레이아웃 추가, `record-video.mjs`에 `sampleOnly` 세그먼트 추가.
- grade(약 20.6초): 정답/시도 썸네일 위에 앱이 실제로 채점하는 영역 폴리곤(눈 라인·눈두덩·볼·입술)을 겹쳐 그림(`scripts/demo/grade-overlay.ts`, 기존 프레임 재사용, 약 10초). "YouCam render = answer key" 캡션과 큰 "SIMULATED ATTEMPT" 라벨(프레임 안 + 왼쪽 열). 이어서 Eyeliner ΔE2000 5.8, #876250 vs #98715D 줄을 상자로 강조해 약 10초 확대(확대 창 높이 560 px로 줄여 글자 잘림 없음). 나레이션 새 줄 2개("The YouCam render is our answer key. Each region is compared by color difference.", "Eyeliner: five point eight apart. Make it a bit stronger.").
- 시간 보전: share 꼬리 1.0 -> 0.4초, partner 꼬리 0.35 -> 0.2초.
- home/intro 등 모바일 폭으로 녹화한 장면은 홈 데스크톱 레이아웃 변경과 무관해 재촬영하지 않았다.
