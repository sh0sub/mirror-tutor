# YouCam API notes (D1 스파이크)

상태: 2026-10-27 기준 **문서 확인 + 공개 카탈로그(0u)만 완료**. API 키가 없어 실호출(#2 지연, #3 feature-cost·잔량, #4 eyelid 실값)은 아직 하지 않았다.
실호출은 `.env`에 `YOUCAM_API_KEY`를 넣고 `.local/face.jpg`(본인 또는 동의받은 모델 정면 셀피)를 둔 뒤 `npm run spike -- all` 한 줄로 실행한다. 결과는 이 파일 끝의 자동 섹션과 `fixtures/youcam/live/`에 저장된다(URL·ID 제거, 얼굴 이미지 미저장). 유닛 상한: 1회 실행·누적 모두 `SPIKE_MAX_UNITS`(기본 55u), 계획된 `all` 실행은 최대 40u.

## 문서로 확정한 것 (OpenAPI 번들, docs.perfectcorp.com/_bundle/reference/*.yaml, 2026-10-27)

| 항목 | 값 |
|---|---|
| 서버 / 인증 | `https://yce-api-01.makeupar.com`, `Authorization: Bearer <API Key>` (V2) |
| 업로드 | `POST /s2s/v2.0/file` body `{files:[{content_type,file_name,file_size}]}` → `data.files[0].{file_id, requests[0].{url,method,headers}}` → 그 URL로 PUT (생략 시 500/404) |
| Face Analyzer | `POST /s2s/v2.0/task/face-attr-analysis` body `{src_file_id, features:[...], face_angle_strictness_level}` · features 이름: `eyelid, eyeShape, lipShape, faceShape, eyebrowShape` · 1–5개 10u / 6–14개 20u / 15–28개 30u |
| Face Analyzer 결과 | `eyelid.{left,right}_eyelid` ∈ Hooded-lid · Single-lid · Double-lid · Deep-Set / `eyelid.{left,right}_shape` ∈ Narrow · Round · Almond / `faceshape` ∈ Triangle · Diamond · Heart · InvTriangle · Oblong · Oval · Round · Square · Unknown / `lipshape[]` ∈ Bow · Downturned · Full · Heavy Lower Lip · Heavy Upper Lip · Narrow · Round · Thin · Wide · Average / `eyebrow.{left,right}_shape` ∈ Hard Angled · Soft Angled · Straight · Rounded · Obscured |
| Makeup VTO | `POST /s2s/v2.0/task/makeup-vto` body `{src_file_id, effects:[...], version:"1.0"}` · 1u · 긴 변 < 1920, 얼굴 폭 ≥ 100px |
| 폴링 | `GET …/task/{feature}/{task_id}` → `data.task_status` ∈ running · success · error, `data.error` 엔진 코드. 오류는 무과금, 폴링 안 한 타임아웃은 과금 |
| 잔량 / 단가 | `GET /s2s/v1.0/client/credit` → `results[].amount_dec` · `GET /s2s/v2.0/credit/feature-cost` → `result.skus[]{description, amount, unit, proc_unit, run_task_url}`, `next_token` 페이지 |

## 실호출로 정정한 것 (2026-10-27, 오류 응답 `error_message` 기준 · 오류는 무과금)

| 항목 | 문서 | 실제 서버 |
|---|---|---|
| `face_angle_strictness_level` | enum strict(pitch≤4°·yaw≤6°·roll≤4°) · high(≤10°, 기본) · medium(≤15°) · low(≤20°) · flexible(≤30°) | `high`에서 스톡 사진 2장 모두 `error_face_angle_leftward/downward` → **`flexible`로 변경 후 성공**(응답 `face_quality.faceangle: good`). 각도 오류 코드는 `lib/quality/messages.ts`의 재촬영 안내(turn/angle_up/angle_down/tilt)로 매핑돼 있음 |
| eyebrows `pattern.type: "shape"` | `curvature`·`thickness`·`definition` 선택 | **셋 다 필수** (`effects.eyebrows.pattern.curvature is required` …). 레슨 기본값 0 / 0 / 50 |
| lip_color `style.type: "ombre"` | 본문 예시 `innerRatio`·`featherStrength`, 스키마 `innerColorRatio`·`blendStrength` | **스키마 쪽 이름만 허용** + **palettes 2개 필수**(`palettes length is insufficient`). 레슨은 [바깥(같은 색, 강도 ×0.4), 안쪽(레슨 색)]으로 만든다 (바깥/안쪽 순서는 결과 이미지 눈 확인 필요) |
| blush / eye_shadow colorNum | palettes 수 = colorNum | blush는 불일치 거부, eye_shadow는 허용 — 검증기는 셋 다 강제 |

실제 성공 본문: `fixtures/youcam/live/makeup-vto.success-bodies.json` (tests/unit/render.test.ts가 요청 빌더와 대조).

## 판단·매핑 (실호출로 재확인 필요)

- **eyelid → 규칙표 키**: Single-lid → monolid, Double-lid → double, Hooded-lid → hooded, **Deep-Set → hooded**(둘 다 눈 뜨면 눈두덩이 가려져 같은 기법), 좌우가 Single/Double로 갈리면 **inner_double(속쌍)**. 속쌍은 API 값이 아니라 M2 수정 시트의 선택지이기도 하다.
- **lipshape(배열) → thin/average/full**: Thin·Narrow가 있으면 thin(우선), Full·Heavy*·Round면 full, 나머지 average.
- **VTO 결과 필드 모순**: 스키마는 `results.url`, 본문 예시는 `results[].download_url`. 코드는 둘 다 받는다(`extractResultUrl`). 스파이크가 실제 모양을 기록한다.
- **credit 인증 모순**: `/s2s/v1.0/client/credit`은 문서상 v1 access_token 인증. V2 API 키로 되는지 미확인 — 실패하면 잔량은 "알 수 없음"으로 두고 데모 모드를 강제하지 않는다.
- **오류 코드 별칭**: 계획서 목업의 `error_src_face_too_small`, `error_lighting_dark`, `error_src_face_out_of_bound`는 현재 문서에 없다. 문서 코드(`error_face_position_too_small` 등)와 함께 별칭으로 매핑해 두었다.

## #1 패턴 카탈로그 — 해소(0u)

`pattern.name`은 공개 카탈로그 JSON의 `label`과 같아야 하고, blush·eye_shadow·eye_liner는 팔레트 수 = `colorNum`. 카탈로그는 인증 없이 받을 수 있어 `npm run catalog:fetch`로 `lib/catalog/patterns.json`에 축약 저장했다(라벨·colorNum·태그). 레슨 3종에 쓰는 label:

| 용도 | label | colorNum |
|---|---|---|
| 섀도: 홑꺼풀 / 속쌍 / 쌍꺼풀 / 덮이는 눈 | 2colors1 / 2colors2 / 2colors3 / 2colors5 (Fan shape · Only upper lid) | 2 |
| 라인: 홑꺼풀 / 속쌍 / 쌍꺼풀 / 덮이는 눈 / 동그란 눈 보정 | Upper6 / Upper10 / Upper11 / Upper30 / OpenWings1 | 1 |
| 블러셔: 달걀 / 둥근 / 긴 / 각진 / 하트 / 다이아 / 삼각 | Circle1 / Oblique1 / Oblong1 / Round1 / Heart1 / Round2 / Triangle1 | 1 |
| 컨투어 | OvalFace6 · RoundFace4 · OvalFace10 · OvalFace11 · HeartFace2 · Invtriangle1 · TriangleFace2 | — |
| 눈썹(type shape) | Straight1 · SoftArch1 · SoftArch2 · Curved7 · Original2 | — |
| 립 shape | original (lipshape.json) | — |

남은 확인: 이 label들이 실제로 의도한 모양(가로 그라데이션 등)으로 렌더되는지는 VTO 실호출 이미지로 눈으로 확인해야 한다. colorNum 불일치를 서버가 거부하는지는 스파이크의 프로브 2건이 기록한다.

## 쓴 유닛

| 날짜 | 내용 | 유닛 |
|---|---|---|
| 2026-10-27 | 문서·공개 카탈로그 확인 | 0 |

## 실호출 결과 (scripts/spike/run.ts)

<!-- spike:auto:start -->

_자동 생성: 2026-10-27T14:59:47.588Z · 이번 실행 14u · 누적 18u / 20u_

### #3 잔량 (GET /s2s/v1.0/client/credit, 0u)

잔량 합계: **1036u**

```json
{
  "status": 200,
  "results": [
    {
      "id": "[redacted]",
      "type": "ApiPaygToken",
      "amount": 996,
      "amount_dec": 996,
      "expiry": 1800835199000
    },
    {
      "id": "[redacted]",
      "type": "ApiPaygToken",
      "amount": 40,
      "amount_dec": 40,
      "expiry": 1824595199000
    }
  ]
}
```

### #3 feature-cost 대조 (GET /s2s/v2.0/credit/feature-cost, 0u)

| SKU | task | 단가 | 계획서 대비 |
|---|---|---|---|
| AI Photo Enhance V1.0 | enhance | 2 / 1 result_image | — |
| AI Object Removal (Standard) | obj-removal | 1 / 1 result_image | — |
| AI Object Removal (Professional) | generative-fill | 2 / 1 result_image | — |
| AI Photo Background Removal V1.0 | sod | 1 / 1 result_image | — |
| AI Photo Colorize V1.0 | colorize | 2 / 1 result_image | — |
| AI Image Generator V1.0 | text-to-image | 2 / 1 result_image | — |
| AI Image Generator V2.0 (Text to Image) | text-to-image/youcam | 1 / 1 result_image | — |
| AI Image Generator V2.0 (Image to Image) | image-to-image/youcam | 1 / 1 result_image | — |
| AI Hair Style Virtual Try-On V1.0 | hair-style | 1 / 1 result_image | — |
| AI Hair Style Virtual Try-On V2.0 (Custom) | hair-transfer | 2 / 1 result_image | — |
| AI Hair Style Virtual Try-On V2.0 (Custom) | hair-transfer | 2 / 1 result_image | — |
| AI Hair Style Virtual Try-On V2.0 (Preset) | hair-transfer | 2 / 1 result_image | — |
| AI Hair Extension Virtual Try-On V1.0 | hair-ext | 1 / 1 result_image | — |
| AI Bangs Filter Virtual Try-On V1.0 | hair-bang | 1 / 1 result_image | — |
| AI Hair Volume Virtual Try-On V1.0 | hair-vol | 2 / 1 result_image | — |
| AI Wavy Hair Virtual Try-On V1.0 | hair-curl | 1 / 1 result_image | — |
| AI Image Extender V2.0 | out-paint | 2 / 1 result_image | — |
| AI Photo Lighting V2.0 | lighting | 2 / 1 result_image | — |
| AI Replace V1.0 | obj-replace | 1 / 1 result_image | — |
| AI Photo Background Change V1.0 | sod/change-background | 1 / 1 result_image | — |
| AI Photo Background Blur V1.0 | sod/blur-background | 1 / 1 result_image | — |
| AI Photo Background Blur V2.0 | bg-blur | 1 / 1 result_image | — |
| AI Color Correction V1.0 | colorize/color-correct | 2 / 1 result_image | — |
| AI Face Swap V1.0 | face-swap | 1 / 1 result_image | — |
| AI Video Enhancer V1.0 | video-sr | 1 / 2 second | — |
| AI Makeup Transfer V1.0 | mu-transfer | 2 / 1 result_image | — |
| AI Headshot Generator V1.0 | headshot | 1 / 2 result_image | — |
| AI Studio Generator V3.0 | ai-studio | 1 / 2 result_image | — |
| AI Avatar Generator V3.0 | ai-avatar | 1 / 4 result_image | — |
| AI Video Style Transfer V1.0 | video-trans | 4 / 1 second | — |
| AI Video Face Swap V1.0 | face-swap-vid | 1 / 5 second | — |
| AI Skin Analysis V2.0 HD (1-4 concerns) | skin-analysis | 12 / 1 result_image | — |
| AI Skin Analysis V2.0 HD (5-8 concerns) | skin-analysis | 16 / 1 result_image | — |
| AI Skin Analysis V2.0 HD (9-12 concerns) | skin-analysis | 20 / 1 result_image | — |
| AI Skin Analysis V2.0 HD (13-16 concerns) | skin-analysis | 22 / 1 result_image | — |
| AI Skin Analysis V2.0 SD (1-4 concerns) | skin-analysis | 9 / 1 result_image | — |
| AI Skin Analysis V2.0 SD (5-8 concerns) | skin-analysis | 12 / 1 result_image | — |
| AI Skin Analysis V2.0 SD (9-12 concerns) | skin-analysis | 14 / 1 result_image | — |
| AI Skin Analysis V2.0 SD (13-16 concerns) | skin-analysis | 16 / 1 result_image | — |
| AI Skin Analysis V2.1 HD (1-4 concerns) | skin-analysis | 12 / 1 result_image | — |
| AI Skin Analysis V2.1 HD (5-8 concerns) | skin-analysis | 16 / 1 result_image | — |
| AI Skin Analysis V2.1 HD (9-12 concerns) | skin-analysis | 20 / 1 result_image | — |
| AI Skin Analysis V2.1 HD (13-16 concerns) | skin-analysis | 22 / 1 result_image | — |
| AI Skin Analysis V2.1 SD (1-4 concerns) | skin-analysis | 9 / 1 result_image | — |
| AI Skin Analysis V2.1 SD (5-8 concerns) | skin-analysis | 12 / 1 result_image | — |
| AI Skin Analysis V2.1 SD (9-12 concerns) | skin-analysis | 14 / 1 result_image | — |
| AI Skin Analysis V2.1 SD (13-16 concerns) | skin-analysis | 16 / 1 result_image | — |
| AI Video Generator (Professional) V1.0 | image-to-video | 6 / 1 second | — |
| AI Video Generator (Standard) V1.0 | image-to-video | 3 / 1 second | — |
| AI Video Generator (Image to Video) V2.0 (480p) | image-to-video/youcam | 1 / 1 second | — |
| AI Video Generator (Image to Video) V2.0 (720p) | image-to-video/youcam | 2 / 1 second | — |
| AI Video Generator (Image to Video) V2.0 (1080p) | image-to-video/youcam | 3 / 1 second | — |
| AI Video Generator (Text to Video) V2.0 (720p) | text-to-video/youcam | 2 / 1 second | — |
| AI Video Generator (Text to Video) V2.0 (1080p) | text-to-video/youcam | 3 / 1 second | — |
| AI Clothes Virtual Try-On V2.0 | cloth | 2 / 1 result_image | — |
| AI Clothes Virtual Try-On V3.0 | cloth-v3 | 2 / 1 result_image | — |
| AI Clothes Virtual Try-On V4.0 | cloth-v4 | 2 / 1 result_image | — |
| AI Fabric Virtual Try-On V1.0 | fabric | 2 / 1 result_image | — |
| AI Hair Color Virtual Try-On V1.0 (Full) | hair-color | 1 / 1 result_image | 일치 |
| AI Hair Color Virtual Try-On V1.0 (Ombre) | hair-color | 1 / 1 result_image | 일치 |
| Face Attribute & Ratio Analysis (1-5 features) | face-attr-analysis | 10 / 1 result_image | 일치 |
| Face Attribute & Ratio Analysis (6-14 features) | face-attr-analysis | 20 / 1 result_image | **불일치 (계획 10)** |
| Face Attribute & Ratio Analysis (15-28 features) | face-attr-analysis | 30 / 1 result_image | **불일치 (계획 10)** |
| AI Facial Color Tones Analyzer V1.0 | skin-tone-analysis | 20 / 1 result_image | 일치 |
| AI Hair Length Detection V1.0 | hair-length-detection | 2 / 1 result_image | — |
| AI Hair Type Detection V1.0 | hair-type-detection | 2 / 1 result_image | — |
| AI Hair Frizziness Detection V1.0 | hair-frizziness-detection | 2 / 1 result_image | — |
| AI Beard Style Generator V1.0 | beard-style | 2 / 1 result_image | — |
| AI Aging Simulation V1.0 | aging | 2 / 16 result_image | — |
| AI Look Virtual Try-On V1.0 | look-vto | 2 / 1 result_image | — |
| AI Makeup Virtual Try-On V1.0 | makeup-vto | 1 / 1 result_image | 일치 |
| AI Earrings Virtual Try-On V1.0 (Stacked) | 2d-vto/earring | 2 / 1 result_image | — |
| AI Earrings Virtual Try-On V1.0 (Single) | 2d-vto/earring | 1 / 1 result_image | — |
| AI Necklace Virtual Try-On V1.0 | 2d-vto/necklace | 1 / 1 result_image | — |
| AI Ring Virtual Try-On V1.0 (Stacked) | 2d-vto/ring | 2 / 1 result_image | — |
| AI Ring Virtual Try-On V1.0 (Single) | 2d-vto/ring | 1 / 1 result_image | — |
| AI Bracelet Virtual Try-On V1.0 (Stacked) | 2d-vto/bracelet | 2 / 1 result_image | — |
| AI Bracelet Virtual Try-On V1.0 (Single) | 2d-vto/bracelet | 1 / 1 result_image | — |
| AI Watch Virtual Try-On V1.0 | 2d-vto/watch | 1 / 1 result_image | — |
| AI Bag Virtual Try-On V2.0 | bag | 2 / 1 result_image | — |
| AI Scarf Virtual Try-On V2.0 | scarf | 2 / 1 result_image | — |
| AI Shoes Virtual Try-On V2.0 | shoes | 2 / 1 result_image | — |
| AI Hat Virtual Try-On V2.0 | hat | 2 / 1 result_image | — |
| AI Face Reshape V1.0 | face-reshape | 1 / 1 result_image | — |
| AI Body Reshape V1.0 | body-reshape | 1 / 1 result_image | — |
| AI Nail Virtual Try-On V1.0 | nail-vto | 1 / 1 result_image | — |
| AI Abs Filter V1.0 | abs-shape | 1 / 1 result_image | — |
| AI Breast Augmentation Simulator V1.0 | breast-shape | 1 / 1 result_image | — |
| Skin Simulation (1-4 concerns) | skin-simulation | 4 / 1 result_image | — |
| Skin Simulation (5-10 concerns) | skin-simulation | 6 / 1 result_image | — |
| AI Teeth Whitening V1.0 | teeth-whiten | 1 / 1 result_image | — |
| AI Eye Color Lens Virtual Try-On V1.0 | eye-color-vto | 1 / 1 result_image | — |
| AI Hair Density Detection V1.0 | hair-density-detection | 1 / 1 result_image | — |
| AI Face Lift V1.0 | face-lift | 1 / 1 result_image | — |
| AI Smile V1.0 | ai-smile | 1 / 1 result_image | — |
| AI Fitzpatrick Skin Type Analysis V1.0 | fitzpatrick-scale-analyzer | 10 / 1 result_image | — |
| AI Photo Background Change V2.0 | bg-replace | 4 / 1 result_image | — |
| AI Video Background Change V2.0 | bg-replace-vid | 2 / 1 second | — |
| AI Video Object Removal V2.0 | obj-rem-vid | 2 / 1 second | — |
| AI Nail Transfer V1.0 | ai-nail | 1 / 1 result_image | — |
| AI Watermark Removal V1.0 | wmk-removal | 1 / 1 result_image | — |
| AI Shoes Virtual Try-On V3.0 | shoes-transfer | 2 / 1 result_image | — |

Face Analyzer는 SKU가 속성 수 구간별로 나뉠 수 있음 — 1~5개 구간이 10u인지 확인.

### #1 패턴 카탈로그 (0u)

조회 경로: `https://plugins-media.makeupar.com/wcm-saas/patterns/{blush,eyeshadow,eyeliner,eyebrows,contour,highlighter,lipliner}.json`, 입술 모양은 `/shapes/lipshape.json` (공개 JSON, 인증 불필요).

- eye_shadow: 1색 98개, 2색 221개, 3색 530개, 4색 443개, 5색 314개
- blush: 1색 227개, 2색 9개, 3색 10개
- eye_liner: 1색 1030개, 2색 15개, 3색 6개

규칙표·레슨이 쓰는 label은 tests/unit/rules.test.ts가 전수 검증한다.

### #2 / #4 Face Analyzer 실측

요청: face_angle_strictness_level=`flexible` · 성공 1회 / 시도 1회

지연(초, 업로드 제외, task 생성~success): {"n":1,"min":6.3,"avg":6.3,"max":6.3}

eyelid 값 집합(관측): Double-lid (문서 enum: Hooded-lid, Single-lid, Double-lid, Deep-Set)

정규화 결과: {"eyelid":"double","eyeShape":"almond","lipShape":"average","faceShape":"triangle","eyebrowShape":"rounded"}

첫 응답:
```json
{
  "nose": {},
  "agegender": {},
  "eyelid": {
    "left_eyelid": "Double-lid",
    "right_eyelid": "Double-lid",
    "left_shape": "Almond",
    "right_shape": "Almond"
  },
  "eyebrow": {
    "left_shape": "Rounded",
    "right_shape": "Hard Angled"
  },
  "color": {},
  "face_quality": {
    "has_face": true,
    "area": "good",
    "frontal": "good",
    "lighting": "good",
    "faceangle": "good"
  },
  "cheekbone": {},
  "faceshape": "Triangle",
  "facialratio": {},
  "lipshape": [
    "Average"
  ]
}
```

### #2 Makeup VTO 실측 (데일리 K-룩 홑꺼풀 분기, 같은 file_id)

단건 순차 지연(초): {"n":4,"min":5.8,"avg":7.5,"max":10.8} · 성공 4/4단계 (SPIKE_VTO_MODE=seq: 병렬·프로브 생략)

결과 필드 모양:
```json
{
  "url": "[redacted]"
}
```

라이브 확인 규칙(2026-10-27, 오류 응답 error_message): eyebrows shape 패턴은 curvature·thickness·definition 필수 / lip_color ombre는 style.innerColorRatio·blendStrength(문서 예시의 innerRatio·featherStrength 아님) + palettes 2개 필수 / blush는 palettes 수 = colorNum 강제(eye_shadow는 불일치 허용).

<!-- spike:auto:end -->
