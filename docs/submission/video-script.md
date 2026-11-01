# 데모 영상 스크립트 (약 2:56)

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

원래 촬영안은 150초. 실제 제출용 자동 녹화본은 아래 "자동 녹화"·"재합성" 절(약 2:56)을 따른다. 나레이션이 시간보다 길면 4번과 5번 문장부터 줄인다(심사 기준: API를 어떻게 쓰는지가 보여야 하므로 8번보다 4·5번을 남긴다).

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
