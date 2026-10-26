**4** 추천 4순위 · YouCam API Skin AI & eCommerce VTO Hackathon

## Mirror Tutor — 남의 얼굴로 찍은 튜토리얼을 내 얼굴로 다시 만들고, 내가 그린 결과를 채점한다

- **마감(KST)**: 11/3(화) 01:45 D-9 · 원문 11/2 11:45am EST

- **상금**: 총 $6,000 1st $2,500 · 2nd $1,000 · 3rd $500 · Women in Tech / Rising Star 각 $1,000

- **타겟 상**: 1st $2,500 현실 목표 Top 3 · Special은 비대상

- **등록자**: 1,213명 1라운드 1,280명·238작

- **필수 요건**: YouCam API 1개+ 동작하는 웹/모바일 프로토타입 · 소비자/리테일 가치 · "not surface-level wrappers"

- **제출물**: 저장소·설명·스크린샷·영상 1~3분 YouTube(제3자 상표·음악 금지) · 데모 링크

- **무료 유닛**: 1,000u + SNS 공유 500u×2(심사 무관)

- **심사**: 4기준 동일 가중 Tech · Design · Impact · Idea

출처: [대회 페이지](https://youcam-api-skin-ai-ecommerce.devpost.com/) [공식 규정](https://youcam-api-skin-ai-ecommerce.devpost.com/rules) [Face Analyzer 문서](https://docs.perfectcorp.com/reference/ai_face_analyzer) [Makeup VTO 문서](https://docs.perfectcorp.com/reference/makeup_vto) [SNS 보너스 폼](https://forms.gle/JwMFYMpaExckupEk7)

01

### 전제 정리 · 대회 조건과 쓸 수 있는 API
1인 · 가용 약 8일 · 1,000u

#### 대회 조건

- 트랙 2개: **Skin AI**("right before a purchase, right after a breakout, deciding whether a product is working" 순간) / **eCommerce VTO**("bring Virtual Try-On together into one seamless experience").
- "first-time user instantly grasps its value". 신규 프로젝트이거나 대폭 업그레이드한 것이어야 함.
- 제출: 공개 저장소(또는 testing@devpost.com 공유) + 텍스트 설명 + 스크린샷 + 1~3분 YouTube 영상(API 사용 설명, 실기기 구동 장면).
- 상은 한 팀당 Placement 1개 또는 Special 1개만.
- SNS 보너스: 데모 영상 공유 시 플랫폼당 500u, 최대 2개. 조건은 @YouCam API 태그, 사용 API 설명, "Received API credits for sharing" 문구, 30일 공개 유지, **제출 기간 시작 전에 만든 계정**. 폼 마감 11/2 11:45 ET.

#### 공통 호출 흐름 (모든 V2 API)

서버 `https://yce-api-01.makeupar.com`, Bearer API Key.

1. `POST /s2s/v2.0/file`로 presigned URL을 받는다
1. 그 URL로 바이너리를 `PUT`한다(빠뜨리면 500/404)
1. `POST /s2s/v2.0/task/{feature}`
1. `GET …/task/{feature}/{task_id}`로 폴링한다(`running|success|error`)

유닛은 **success일 때만 차감**, error는 무과금. 단 폴링하지 않아 타임아웃되면 차감된다는 문구가 있음(Skin Tone/Face Analyzer 문서). 결과 URL 2시간 유효, 파일·task_id 30일 보관 후 삭제. 레이트 리밋 IP·토큰별 **250 req / 300초**. 잔량 조회 `GET /s2s/v1.0/client/credit`, 기능별 단가 조회 `GET /s2s/v2.0/credit/feature-cost`.

   ``````````````
[](https://docs.perfectcorp.com/reference/ai_skin_analysis) ``[](https://docs.perfectcorp.com/reference/ai_skin_simulation) ````[](https://docs.perfectcorp.com/reference/ai_skin_tone_analysis) ``````````

[](https://docs.perfectcorp.com/reference/ai_face_analyzer) ``[](https://docs.perfectcorp.com/reference/ai_fitzpatrick_skin_type) [](https://docs.perfectcorp.com/reference/ai_aging_simulation) ````````````[](https://docs.perfectcorp.com/reference/makeup_vto) ````[](https://docs.perfectcorp.com/reference/ai_look_vto) [](https://docs.perfectcorp.com/reference/ai_makeup_transfer) ``[](https://docs.perfectcorp.com/reference/ai_hair_color) ````[](https://docs.perfectcorp.com/reference/ai_hairstyle) ````[](https://docs.perfectcorp.com/reference/ai_clothes)[](https://github.com/nickthelegend/swipefit) ``[](https://docs.perfectcorp.com/reference/ai_watch) [](https://docs.perfectcorp.com/reference/ai_photo_enhance) [](https://yce.perfectcorp.com/document/index.html)

| API | 엔드포인트(task) | 핵심 입력 | 출력 | 유닛/호출 | 출처 |
|---|---|---|---|---|---|
| AI Skin Analysis V2.0/2.1 | task/skin-analysis | dst_actions SD 16종(wrinkle, droopy eyelid, acne, moisture, pore, redness, skin_type 등) 또는 HD 16종(hd_*, 섞어 쓸 수 없음). SD는 짧은 변 ≥480px, HD는 ≥1080px. 얼굴 폭 >60% | 항목별 ui_score(1–100), raw_score, mask_urls[], 종합, skin_age | SD 9/12/14/16HD 12/16/20/22 | docs |
| AI Skin Simulation | task/skin-simulation | 고민 10개 강도 0.0–1.0, 개선 방향만 가능 | 결과 이미지 | 4 / 6 | docs |
| AI Skin Tone Analysis | task/skin-tone-analysis | file_id, face_angle_strictness_level | 피부·눈·입술·눈썹·머리 색 hex | 20 | docs |
| AI Face Analyzer (선정안 사용) | task/face-attr-analysis | 속성 16종(faceShape, eyeShape, eyelid, lipShape, eyebrowShape 등) + 비율 10종. 얼굴 폭 >60%, 이마가 보여야 함 | faceshape(Oval/Round/Square/Heart…), eyelid.*, lipshape[], eyebrow.*, 비율값 | 1–5개 106–14개 2015–28개 30 | docs |
| AI Fitzpatrick Skin Type | task/fitzpatrick-scale-analyzer | file_id | Type I–VI | 10 | docs |
| AI Aging Simulation | (OpenAPI 참조) | jpg, 정면 yaw ±30° | 연령대별 이미지 시리즈 | 2 | docs |
| AI Makeup VTO V1.0 (선정안 사용) | task/makeup-vto | effects[](한 호출에 효과 여러 개), 카테고리 13종(foundation, blush, eye_liner, eye_shadow, lip_color 등). palettes:["#RRGGBB"], 강도 0–100, 텍스처(matte/satin/shimmer/metallic/gloss). pattern.name은 카탈로그 label과 같아야 하고, blush/eye_shadow는 팔레트 수 = colorNum. 긴 변 <1920px | download_url 결과 이미지 | 1 | docs |
| AI Look VTO | task/look-vto | template_id(예: all_rosy_chic) | 이미지 | 2 | docs |
| AI Makeup Transfer | (참조 이미지 메이크업 이식) | src + ref | 이미지 | 2 | docs |
| AI Hair Color | task/hair-color | preset 또는 pattern+palettes, Full/Ombre | 이미지 | 1 | docs |
| AI Hairstyle v2.1 | /s2s/v2.1/task/hair-transfer | template_id 또는 ref 이미지, 긴 변 ≤1024 | 이미지 | v2.0 1/2 · v2.1 2 | docs |
| AI Clothes VTO | task/cloth-v4 | 인물 + 의류(상품컷/착용컷/template), garment_category | 이미지(참가자 실측 8–13초) | V2/V3 2 · v4 미기재 | docs · swipefit |
| AI Watch VTO | task/2d-vto/watch | 손목 사진 + 시계 정면컷(+마스크, 앵커 4점) | 이미지 | 1 | docs |
| AI Photo Enhance | (OpenAPI 참조) | 이미지 | 이미지 | 2 | docs |
| 기타 | Ring/Bracelet/Earrings/Necklace, Bag/Shoes/Hat/Scarf, Nail, Eye Color Lens, Beard, Hair 속성 감지, Face Swap/Headshot/Avatar, Video 계열 | 미확인 | 메뉴 |  |  |

확인하지 못한 것: 공식 가격 페이지(api-pricing, unit-calculator)는 텍스트를 추출할 수 없었다. 그래서 위 단가는 각 API 레퍼런스 표에서 옮겼다. Makeup VTO/Hair Color 지연 시간과 Makeup VTO 패턴 카탈로그 조회 방법은 문서에 없어 Day 1에 확인해야 한다.

#### 1,000 유닛 배분 Face Analyzer 10u + VTO 1u×단계

         

| 용도 | 계산 | 유닛 |
|---|---|---|
| Day 1 API 탐색·단가 확인 | Face Analyzer 3회(30) + Makeup VTO 20회(20) + Hair Color 3회(3) | 55 |
| 개발·통합 테스트(Day 2–6) | Face Analyzer 12회(120) + VTO 180회(180). 캐시 키 = (이미지 해시, effects 해시). UI 작업은 모의 모드로 | 300 |
| 영상 촬영(Day 7) | 4테이크 × (10 + 4단계 + 재생성 2) = 64 | 70 |
| 스크린샷 | 영상 테이크 결과 재사용 | 0 |
| 심사 기간 라이브 데모(11/3–11/24) | 풀 플로우 14u × 20세션 | 280 |
| 비상 버퍼 | API 오류·재촬영·실수 | 295 |
| 합계 |  | 1,000 |

가드레일: 세션당 상한 20u, 전역 일일 상한, 잔량 표시. 잔량이 150 미만이면 자동으로 "샘플 모델 모드"(미리 만든 결과 재생)로 바꾼다. 추가 확보: SNS 2건 +1,000u. 참고로 1라운드 SwipeFit은 세션 상한 400u·동시성 4·렌더 캐시를 뒀고, SkinProof는 분석 43회에 약 600u를 썼다. 캐시·모의 모드 없이는 금방 바닥난다.

#### 지난 라운드 수상작과 레드오션

- **1위 Aloud**: 시각장애인용 음성 우선 스킨케어 도우미(Skin Analysis + Skin Tone). 조명 체크를 먼저 하고, iPhone 10회 스캔이 모두 30초 이내.
- **2위 ShadeSpan**: 옷 1벌을 피부톤 6개에 입혀 색 유지력을 점수화. "데모 카탈로그의 14.3%만 전 톤 통과".
- **CASTING**: 상품 1장을 피부톤이 측정된 8명에게 28초 안에 합성(머천다이저용, API 4개).
- KeepMe(생성형 VTO가 바꾸면 안 되는 부위 보호), ConfidFit(Shopify 의류 VTO, "fit 보증 아님" 라벨).
- 심사위원은 **측정·정직성·명확한 대상**에 점수를 줬다. "AI 스타일리스트 + try-on 래퍼" 류는 떨어졌다.
- 레드오션 피부 분석 → 제품 추천·추적(Skinova, SkinTruth, SkinProof…), 퍼스널컬러 + 의류 VTO(DrapeIt, SwipeFit…), 의류 VTO 쇼핑.

#### 한국 맥락 근거

- 올리브영이 2026-09에 모바일 피부진단을 출시했다(분석 → 상품·루틴 추천 → 재측정). 1위 유통사가 이미 기본 기능으로 제공한다.
- 올리브영 2025 상반기 오프라인 외국인 매출 비중 26.4%, 글로벌 관광상권 매장 110여 개.
- TIRTIR 쿠션: 2023년 3색 출시 → 해외 비판 → 40색으로 확대(기사마다 40/45색으로 다름).
- 홑꺼풀·hooded 눈에는 튜토리얼이 맞지 않는다는 당사자 증언이 있다(공식 통계는 못 찾음). 조회수 최다 튜토리얼 주제는 스모키 브라이덜 1.11억, 레드립 1.08억 뷰(Tajmeeli, 연도 불명).

출처: [파일 보관](https://docs.perfectcorp.com/develop/file_retention_period) [레이트 리밋](https://docs.perfectcorp.com/develop/rate_limit) [유닛 시스템](https://docs.perfectcorp.com/reference/unit_system) [SkinProof](https://github.com/fujiken1016/skinproof) [1라운드 수상 발표](https://www.perfectcorp.com/business/news/YouCam-API-Hackthon-eCommerce) [1라운드 Devpost](https://youcam-api.devpost.com/) [GitHub youcam-api](https://github.com/topics/youcam-api) [StyleSense 분석](https://github.com/ihddirmas/StyleSense/pull/34) [올리브영 피부진단](https://news.mtn.co.kr/news-detail/2026091509334725588) [외국인 매출 26.4%](https://www.kukinews.com/article/view/kuk202507220050) [CTV TIRTIR](https://www.ctvnews.ca/lifestyle/article/k-pop-broke-taboos-by-being-inclusive-now-k-beauty-is-starting-to-do-the-same/) [JoongAng Daily](https://www.koreajoongangdaily.com/korea/do-kbeauty-products-let-customers-down-with-limited-shades/10395629) [monolid 증언 1](https://theeverygirl.com/4-tips-for-monolid-makeup/) [monolid 증언 2](https://www.beautylish.com/t/aiaca/what-to-do-for-monolids) [Tajmeeli](https://www.skininc.com/business/trends/news/22197911/tajmeeli-top-10-makeup-tutorial-topics)

02

### 선정안

Selected

Mirror Tutor (미러 튜터)

내 얼굴로 배우는 K-메이크업. 내 얼굴형·눈꺼풀·입술에 맞게 바꾼 단계별 "정답 이미지"를 내 얼굴 위에 보여 주고, 내가 실제로 그린 결과를 채점하는 메이크업 코치.

"Makeup tutorials are filmed on someone else's face. Mirror Tutor rebuilds the tutorial on yours — step by step with YouCam Makeup VTO, adapted to your eye shape and lips by YouCam Face Analyzer — then grades what you actually drew."

**해결하는 문제** 튜토리얼의 기법(아이라인 두께, 그라데이션 방향, 블러셔 위치)은 만든 사람의 얼굴 구조에 맞춰져 있다. 눈꺼풀이나 얼굴형이 다르면 그대로 따라 해도 결과가 달라진다. 사용자는 "내 얼굴에서는 어떻게 보여야 정답인지"도, "지금 얼마나 비슷하게 했는지"도 알 수 없다.

- **타겟 유저**: ① K-뷰티 룩을 따라 하고 싶지만 "내 눈엔 안 된다"를 겪는 해외 팬(홑꺼풀·hooded·얇은 입술) ② 메이크업 1~2년차 한국 20대 ③ B2B: 자사 SKU로 레슨을 출판하려는 브랜드·크리에이터
- **핵심 가치**: "내 얼굴 기준 정답"을 보고, 실제로 그린 결과를 측정한다. 단계별 hex가 곧 제품 셰이드라서 튜토리얼이 그대로 장바구니가 된다.
- **노리는 상**: 1st $2,500 현실 목표 Top 3
- **트랙**: eCommerce VTO (Skin AI는 Face Analyzer에 한해 보조로 언급)
- **YouCam API**: Face Analyzer(속성 5개 `eyelid · eyeShape · lipShape · faceShape · eyebrowShape`, 10u) → 기법 규칙표 분기 → Makeup VTO(단계당 1u)가 분기된 hex·강도·텍스처·패턴으로 단계별 누적 정답을 렌더

03

### 승리 근거 · 심사 기준 대응
4기준 동일 가중

Technological ImplementationAPI를 얼마나 깊게, non-trivial하게

API 2종을 파이프라인으로 묶는다(분석 결과가 VTO 파라미터를 결정). 단계별 VTO 4~5회를 병렬 호출하고, 폴링·캐시·유닛 가드·실패 상태까지 처리한다. 실제 시도 사진은 LLM 비전으로 채점하고, Should 단계에서 랜드마크 정렬 ΔE로 수치화한다. "API 1회 호출" 수준의 코드가 아니다.

Design완결된 제품 경험

촬영 가이드 → 분석 확인 → 레슨 → 시도 채점 → 쇼핑 → 공유가 한 흐름이다. 모바일 우선이고, 가이드 실패·분석 중·결과 상태를 모두 설계했다. 처음 쓰는 사람도 30초 안에 가치를 알 수 있다.

Potential Impact실제 대상·실제 문제의 근거

대상이 구체적이다(눈꺼풀·얼굴형별). 당사자 증언과 K-뷰티 글로벌 수요(올리브영 외국인 매출 26.4%)를 근거로 든다. 데모에서 같은 룩이 홑꺼풀·쌍꺼풀 두 얼굴에 서로 다른 기법으로 렌더되어, 문제를 실제로 푸는 장면을 보여 준다.

Quality of the Ideanon-obvious API 활용

VTO를 정답지로, Face Analyzer를 기법 분기 근거로 쓰는 비자명한 용법이다. 1·2라운드 공개 저장소에 튜토리얼형은 없다. "피부분석→추천", "톤→옷색"과 거리가 멀고, 심사위원이 점수를 준 "측정·정직성" 문법(채점 점수, 신뢰도, 분류 확인 단계)을 이어받는다.

04

### 아이디어 회의 기록
19개 발산 → 3개 심층 → 1개 선정

#### #1 Mirror Tutor 선정 · 29/30

튜토리얼을 내 얼굴로 다시 만들고, 내가 그린 결과를 채점한다.

**non-obvious** VTO를 쇼핑 미리보기가 아니라 학습의 정답지로, Face Analyzer를 기법 분기 근거로 쓴다. 선례가 없다.

**문제 실재성** 홑꺼풀·hooded 당사자 증언이 많다. 해외 K-뷰티 팬과 서구 튜토리얼을 보는 한국인 양쪽에 해당한다.

**8일 1인** API 2종, 단가 1u라 반복 테스트 부담이 없다. 주된 비용은 규칙표·레슨 3개 콘텐츠 작성.

**영상·커머스** 내 얼굴이 단계별로 완성되고 실제 시도가 채점된다. 단계 색 = 제품(hex 동일), 브랜드가 레슨을 출판하는 B2B로 확장할 수 있다.

**치명 리스크** Face Analyzer 분류 오류 → 사용자 확인 단계로 완화. 패턴 카탈로그 확인 필요.

#### #2 Cushion Match 2순위 · 24/30

Skin Tone hex와 K-뷰티 호수(13/21/23)를 ΔE로 매칭하고, 파운데이션 VTO와 브랜드별 커버리지 표를 보여 준다.

**non-obvious** ShadeSpan의 색 과학 문법을 베이스에 적용한 것이라 "본 적 있는" 느낌이다.

**문제 실재성** 실재한다(TIRTIR 3색→40색). 다만 셀피 톤 측정은 조명에 따라 달라져서 "매칭"을 약속하면 과장이 된다.

**8일 1인** Skin Tone이 20u라 테스트 50회면 1,000u가 소진된다. 호수 DB는 수작업.

**치명 리스크** 실제 브랜드 호수를 영상에 쓰면 **상표 규정 위반**, 가명으로 바꾸면 가치가 사라진다.

→ Mirror Tutor의 Stretch(X1 베이스 호수 안내)로 일부 흡수

#### #13 중고 시계 피팅 탈락 · 24/30

중고 거래 사진으로 내 손목 착용컷을 만들고, 러그 폭과 손목 둘레로 fit을 안내한다.

**non-obvious** Watch VTO 하나만 쓴다. 기능이 API 데모와 같아서 "wrapper" 판정 위험이 있다.

**문제 실재성** 실재하지만 니치다. 상품 사진 품질(정면, 스트랩 크롭) 요구가 까다로워 실패율이 높다.

**8일 1인** 가장 쉽다(API 1개). 영상은 손목 합성 한 장면뿐이다.

**치명 리스크** 시계 브랜드 상표 문제가 똑같이 생긴다.

전체 발산 목록과 평가 매트릭스 (19개)

(a) API 필수성 (b) 심사 4기준 종합 (c) 8일·1,000u 현실성 (d) 차별화 (e) 영상·스크린샷 임팩트 (f) 소비자/커머스 가치 설득력. 1~5점, 30점 만점. 유닛은 1사용자 1회 핵심 플로우 기준 추정.

   

| # | 아이디어 | 한 줄 | YouCam API | 유닛 | a | b | c | d | e | f | 합 | 메모 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Mirror Tutor | Face Analyzer로 눈꺼풀·입술·얼굴형을 읽어 기법을 바꾸고, 단계마다 VTO로 정답을 만든 뒤 시도를 채점 | Face Analyzer(5) + Makeup VTO | 10+4~5 | 5 | 5 | 5 | 5 | 5 | 4 | 29 | VTO를 정답지로, Face Analyzer를 개인화 근거로 쓰는 비자명한 용법. 단가 1u로 저렴 |
| 2 | Cushion Match | Skin Tone hex ↔ 호수 ΔE + 파운데이션 VTO, 브랜드 커버리지 표 | Skin Tone + VTO(foundation) | 20+3 | 5 | 4 | 3 | 3 | 4 | 5 | 24 | 조명 오차, 실제 호수 DB = 상표 노출, 퍼스널컬러와 겹침 |
| 3 | Derm Pre-Consult | 방한 외국인 환자용 HD 피부 분석 → 4개 국어 사전문진 시트 | Skin Analysis HD 16 | 22 | 5 | 4 | 4 | 5 | 3 | 2 | 23 | 이번 라운드는 eCommerce 초점, 의료 표현 리스크 |
| 4 | Shelf Audit | 피부 분석 + 화장대 사진(LLM 비전) → 유지/보류/기부 판정 | Skin Analysis SD 8 | 12 | 3 | 4 | 4 | 4 | 4 | 4 | 23 | 핵심 판단은 LLM, YouCam은 보조라 (a)가 약함 |
| 5 | Skin Twin Reviews | 측정된 피부 프로파일이 비슷한 사람 리뷰만 필터 | Skin Analysis SD 12 | 14 | 4 | 3 | 2 | 4 | 3 | 4 | 20 | 사용자 수 필요, 데모는 시드 데이터 |
| 6 | Glass-Skin Goal | Skin Simulation으로 현실적 목표 이미지, 재측정으로 격차 추적 | Skin Analysis + Simulation | 12+4 | 5 | 3 | 4 | 3 | 4 | 3 | 22 | 추적 계열(SkinTruth/SkinProof)과 겹침 |
| 7 | 미용실 상담 카드(B2B) | 염색·스타일 3안 + 피부톤 근거 → 상담 카드 PDF | Hair Color + Hairstyle + Skin Tone | 3+4+20 | 4 | 3 | 4 | 3 | 4 | 4 | 22 | 흔한 B2B, Skin Tone 20u 부담 |
| 8 | 웨딩 D-day 플래너 | 피부 루틴 카운트다운 + 당일 룩 VTO + 헤어 | Skin + Look VTO + Hair | 12+2+1 | 4 | 3 | 2 | 2 | 4 | 3 | 18 | 기능 과다, "스타일리스트 래퍼" 위험 |
| 9 | Future Face 선케어 | 노화 시뮬레이션으로 자외선 습관 경고 | Aging + Skin(age_spot) | 2+9 | 4 | 2 | 5 | 3 | 5 | 2 | 21 | 재미는 있으나 Impact 약함 |
| 10 | 남성 5분 그루밍 | 최소 루틴 + 수염 스타일 | Skin SD 4 + Beard | 9+? | 3 | 3 | 4 | 3 | 3 | 3 | 19 | 추천 계열의 변형 |
| 11 | 시니어 보호자 체크 | 건조·색소 변화 주간 체크를 보호자에게 요약 | Skin SD 4 | 9 | 3 | 3 | 4 | 4 | 2 | 2 | 18 | 민감, 커머스 약함 |
| 12 | 라이브커머스 동시 체험 | 방송 중 같은 룩을 시청자 얼굴에 | Look VTO | 2/명 | 4 | 3 | 1 | 4 | 4 | 5 | 21 | 시청자당 유닛, 실시간 인프라는 8일 안에 불가 |
| 13 | 중고 시계 피팅 | 중고 사진으로 손목 착용컷 + fit 안내 | Watch VTO | 1 | 5 | 3 | 4 | 4 | 4 | 4 | 24 | 단일 API 래퍼 위험, 시계컷 품질 의존 |
| 14 | 선물 주얼리 추천 | 받는 사람 사진으로 귀걸이·목걸이 착용컷 | Earrings/Necklace | ? | 4 | 2 | 3 | 3 | 3 | 3 | 18 | 타인 얼굴 사용 = 개인정보 문제 |
| 15 | Mirror Tutor Pro(B2B) | 크리에이터 튜토리얼 1개 → 시청자 얼굴형별 변형본 자동 생성 | Face Analyzer + VTO | 10+N | 5 | 4 | 3 | 5 | 3 | 4 | 24 | #1의 확장(Stretch X3로 흡수) |
| 16 | 음성 메이크업 점검 | 발린 상태를 음성으로 확인 | Makeup VTO 비교 | — | 4 | 3 | 3 | 1 | 3 | 3 | 17 | Aloud 복제 |
| 17 | Skin Weather | 주간 측정 + 날씨 API로 오늘 루틴 조정 | Skin SD 8 | 12/주 | 3 | 3 | 4 | 3 | 3 | 3 | 19 | YouCam 주기 호출, 장식적 |
| 18 | ₩30,000 루틴 | 예산 내 최소 루틴 조합 최적화 | Skin SD 8 | 12 | 3 | 3 | 5 | 3 | 3 | 4 | 21 | 추천 계열 |
| 19 | 메이크업 챌린지 | 같은 룩을 각자 얼굴에 적용해 투표 | Look VTO | 2/명 | 4 | 2 | 3 | 3 | 4 | 2 | 18 | 소셜 효과를 데모로 증명하기 어려움 |

05

### 기능 리스트
유닛 = 사용자 1회 기준

#### MVP Day 1–5 · 9개

- **F1 촬영 가이드 + 품질 사전검사**얼굴 폭 >60%, 밝기, 정면을 클라이언트에서 체크하고 API 오류 코드를 안내 문구로 매핑
API —LLM —0u난도 중

- **F2 얼굴 구조 분석 + 사용자 확인**faceShape, eyeShape, eyelid, lipShape, eyebrowShape
Face Analyzer 5속성LLM: 쉬운 한/영 한 줄 설명10u난도 하

- **F3 기법 규칙표**눈꺼풀·눈 모양·입술·얼굴형 → 단계별 VTO 파라미터·설명문 (JSON)
API —LLM: 초안 생성, 사람이 검수0u난도 중

- **F4 레슨 3종 단계별 정답 이미지**데일리 K-룩 / 음영 메이크업 / 그라데이션 립. 단계 k = effects[1..k] 누적 1호출
Makeup VTOLLM —4~5u난도 중

- **F5 레슨 플레이어**전/후 슬라이더, 단계 설명, "왜 당신은 이렇게" 근거 카드
API —LLM —0u난도 중

- **F6 내 시도 촬영 → 채점**부위별 0–100 + 한 줄 교정
API —LLM: Claude 비전, 부위 크롭 비교 → 고정 루브릭 JSON0u난도 중

- **F7 Shop the step**단계별 hex = 제품 셰이드, 가명 카탈로그 12 SKU
API —LLM —0u난도 하

- **F8 유닛 가드·캐시·모의 모드·잔량 표시**세션 상한 20u, 잔량 <150이면 샘플 모델 모드
client/creditLLM —0u난도 중

- **F9 개인정보**동의 화면, 메모리 처리, EXIF 제거, 세션 폐기
API —LLM —0u난도 하

#### Should Day 6 · 5개

- **S1 랜드마크 정렬 ΔE 채점**브라우저에서 MediaPipe Face Landmarker를 실행해 입술·볼·눈두덩 폴리곤의 CIELAB ΔE로 수치 근거를 만든다
API —LLM: 수치 해석 문장만0u난도 상

- **S2 "두 얼굴 비교" 데모 모드**홑꺼풀과 쌍꺼풀 샘플 모델에 같은 레슨을 렌더
Makeup VTOLLM —사전 생성난도 하

- **S3 공유 카드 PNG**원본/정답/내 시도 3분할 + 점수
API —LLM —0u난도 하

- **S4 레슨 난이도 조절**강도 −20% / +20%로 다시 생성
Makeup VTO 1회LLM —1u난도 하

- **S5 영어 UI 토글**해외 K-뷰티 팬 대상
API —LLM: 번역 검수0u난도 하

#### Stretch 시간 남을 때 · 4개

- **X1 베이스 단계 호수 안내**Skin Tone hex → 가명 카탈로그 호수 중 ΔE 최근접
Skin Tone AnalysisLLM —20u난도 중

- **X2 풀 룩 마무리: 헤어 컬러 1안**
Hair ColorLLM —1u난도 하

- **X3 크리에이터 모드**레슨 JSON 편집기(B2B 출판)
API —LLM: 자연어 → 레슨 JSON0u난도 상

- **X4 연습 기록**로컬 저장, 점수 추이
API —LLM —0u난도 중

06

### 유저 플로우

플로우 A · 첫 사용: 분석 → 레슨 → 채점 (핵심, 영상의 뼈대)

1. **앱 열기, "시작"**동의 문구 표시(이미지 저장 안 함, YouCam 30일 보관)→ M1 온보딩
1. **셀피 촬영/업로드**얼굴 검출과 폭 비율·밝기 체크. 통과하면 긴 변 1600으로 리사이즈하고 EXIF 제거→ M1 촬영 가이드
1. **품질 실패**QualityGate fail이면 다시 촬영(가이드 문구). Analyze error면 오류 코드를 안내로 매핑→ M1 실패 상태
1. **대기**File API 업로드 → Face Analyzer(5속성) 폴링 → 결과 정규화→ M2 분석 중
1. **"맞아요" 또는 항목 수정**규칙표로 기법 분기를 확정하고, 레슨 3종 중 추천 1개를 강조. 수정해도 재분기만 하므로 0u→ M2 결과·확인
1. **레슨 선택**단계 1~4 effects 생성 → VTO 4건 병렬 발주 → 폴링 → 캐시. 일부만 끝나면 완료된 단계부터 표시→ M3 스켈레톤→순차 공개
1. **슬라이더로 전/후 비교, "다음"**단계 k 이미지와 근거 카드→ M3
1. **"내 시도 찍기"**품질 체크 → 정답(단계 4)과 시도의 부위 크롭 → LLM 루브릭 채점 JSON→ M4 채점
1. **점수 확인 → 다시 시도 / 제품 보기**재채점은 0u, 아니면 커머스로 이동→ M4 → M6
1. **공유**3분할 카드 PNG 생성(얼굴 포함 여부 선택)→ M7 공유

플로우 B · 재방문: 다른 레슨 (유닛 절약 경로)

1. **앱 열기**로컬 얼굴 프로파일(속성만, 이미지 없음)을 불러와 Face Analyzer를 다시 부르지 않음(0u)→ M2 축약
1. **프로파일 없음**Home에 프로파일이 없으면 Analyze로→ M2 분석
1. **새 셀피 촬영**품질 체크→ M1
1. **레슨 선택**프로파일로 바로 분기, VTO 4건(4u)→ M3
1. **시도·채점**0u→ M4

플로우 C · 커머스: Shop the step → 외부 결제

1. **M3/M4에서 "이 단계 제품"**단계 effects의 hex·텍스처로 카탈로그 매칭(ΔE 최근접, 같은 텍스처)→ M6
1. **스와치 탭**이미 만든 정답 이미지에서 해당 hex 부위를 하이라이트(0u)→ M6 ↔ M3
1. **"담기" / "스토어에서 보기"**외부 링크로 넘김. 결제는 구현하지 않으며 화면에 그렇게 밝힘→ 외부 스토어

[07 화면 목업: 아티팩트 참조]

08

### 실행 계획

#### 아키텍처
 flowchart LR B["브라우저
getUserMedia · Canvas 리사이즈
품질 체크"] -->|multipart| A["/api/analyze"] A -->|"sharp EXIF 제거"| F["YouCam File API
presigned PUT"] F --> FA["Face Analyzer
5속성 · 10u"] FA -->|"폴링 1.5s"| R["규칙표
techniques.json"] R --> RD["/api/render"] RD -->|"같은 file_id · 4건 병렬"| V["Makeup VTO
1u × 단계"] V -->|"download_url 서버 fetch"| C["LRU 캐시
TTL 2h"] C -->|"base64 응답"| B B --> G["/api/grade"] G --> L["Claude 비전
루브릭 JSON"] U["유닛 가드
세션 20u · 잔량 <150 → DEMO_MODE"] -.-> A U -.-> RD

**스택** Next.js 15(App Router, TS) + Tailwind, Vercel 배포(가능하면 icn1). 상태는 클라이언트 세션 + 로컬스토리지(속성만). MVP에는 DB 없음. LLM은 Claude 비전 모델이고, 모델 ID·단가는 공식 문서로 확정한다.

1. 브라우저: 캡처 → 긴 변 1600, JPEG q0.9 → 얼굴 폭·밝기 히스토그램 체크(Should: MediaPipe) → `POST /api/analyze`
1. 서버: sharp로 EXIF 제거·재인코딩 → file → PUT → face-attr-analysis → 1.5초 간격 폴링(최대 30초) → 정규화 JSON. 버퍼는 응답 후 해제
1. `/api/render`: effects 4세트 → 같은 file_id 재사용 → VTO 4건 병렬 → download_url(2시간 유효)을 서버가 바로 받아 응답 바디로 전달하고 YouCam URL은 노출하지 않음 → 캐시 키 sha256(이미지)+sha256(effects)
1. `/api/grade`: (MVP) 부위 크롭 4쌍 + 루브릭 → JSON `{region, score, tip, confidence}`. (Should) 랜드마크 ΔE 수치를 넘기고 설명만 LLM이 쓴다
1. 유닛 가드: 세션 쿠키별 카운터 20u, 전역 일일 상한(env), credit 조회 결과 5분 캐시, 잔량이 150 미만이면 `/public/demo/*`를 반환

**개인정보 원칙** ① 원본·결과 이미지를 디스크/DB에 저장하지 않고, 로그에 이미지·URL을 남기지 않는다 ② EXIF 제거 ③ presigned PUT으로 보내고 결과 URL은 노출하지 않는다 ④ 동의 화면에 YouCam 30일 보관을 밝힌다 ⑤ 로컬스토리지에는 속성값만 두고 "프로파일 삭제" 버튼을 둔다 ⑥ 공유 카드는 클라이언트 Canvas에서 만든다 ⑦ 영상·스크린샷에는 본인 또는 동의받은 샘플 모델만 쓴다 ⑧ 저장소에 키를 두지 않는다(`.env.example`)

저장소: `app/(flow)/capture|analyze|lesson|grade|shop|share`, `app/api/{analyze,render,grade,credit}`, `lib/youcam/{client,file,faceAnalyzer,makeupVto,poll}.ts`, `lib/rules/techniques.json`, `lib/lessons/*.json`, `lib/catalog/products.json`(가명 12 SKU), `public/demo/*`

#### 일정 (8일, 하루 3~5시간, KST)

D1 · 10/26(일)**계정·리딤, feature-cost로 단가 재확인, Face Analyzer·VTO 실호출**패턴 카탈로그 확보, 지연 실측, 결과 샘플 저장, 저장소 생성 → 유닛 55 이하, docs/api-notes.md

D2 · 10/27**YouCam 클라이언트(file→task→poll), 캐시·유닛 가드·모의 모드**/api/analyze, /api/render, 테스트 스크립트

D3 · 10/28**규칙표 + 레슨 3종 JSON**눈꺼풀 4종 × 눈 모양 × 입술 × 얼굴형 → 파라미터·문구. LLM 초안 → 수기 검수

D4 · 10/29**M1·M2·M3 UI**촬영 가이드, 분석 확인, 플레이어 슬라이더·상태 → 플로우 A1–A6 동작

D5 · 10/30**M4 채점, M6 커머스, M7 공유 카드**루브릭·크롭·Claude 비전, 카탈로그 → 플로우 A 끝까지

D6 · 10/31**Should: 두 얼굴 비교, 영어 토글, (여유 시) ΔE**접근성·상태·360/390 검증, 개인정보 문구 → 배포 URL, README 초안

D7 · 11/1**영상 4테이크 촬영·편집, 스크린샷 10장**README·Devpost 설명문, MIT 라이선스, YouTube 공개 업로드

D8 · 11/2**버퍼 · 11/2 20:00 KST까지 제출 완료**버그 수정, 데모 모드 점검, SNS 공유 2건 + 보너스 폼. 실제 마감은 11/3 01:45

#### 데모 영상 시나리오 (150초)

저작권 프리 음악 또는 무음 + 자막, 상표 미노출, 실기기 구동 장면 포함.

0:00–0:08직접 찍은 튜토리얼 흉내 장면 → 내 눈 클로즈업. "튜토리얼은 그 사람 얼굴 기준입니다. 저는 홑꺼풀이에요."

0:08–0:15M4 채점 결과를 먼저 보여 줌(78점, 부위별). "Mirror Tutor는 내 얼굴로 정답을 만들고, 내가 그린 걸 채점합니다."

0:15–0:30M1 촬영 → 가이드 실패(어두움) → 통과. "YouCam API 요구조건에 맞게 촬영을 안내하고,"

0:30–0:50M2 분석 중 → 결과(홑꺼풀·얇은 입술) → 수정 시트. "Face Analyzer가 눈꺼풀·입술·얼굴형을 읽습니다. 틀리면 고칠 수 있어요. 10 유닛."

0:50–1:25M3 단계 1→4, 슬라이더, 근거 칩 확대. "Makeup VTO가 단계마다 내 얼굴에 정답을 그립니다. 홑꺼풀이라 라인은 가로로, 얇은 입술이라 그라데이션으로 — 규칙이 바뀝니다. 단계당 1 유닛."

1:25–1:40S2 두 얼굴 비교(홑꺼풀 vs 쌍꺼풀 샘플). "같은 룩, 다른 얼굴, 다른 기법."

1:40–2:00실제로 그린 뒤 M4 촬영 → 채점 → 교정. "부위별 점수와 한 줄 교정. 조명이 다르면 신뢰도도 같이 보여줍니다."

2:00–2:15M6 hex 스와치 → 제품, ΔE. "단계에서 쓴 색 그대로 제품으로 — 튜토리얼이 장바구니가 됩니다."

2:15–2:30M7 공유 카드 → 아키텍처 1장 → 로고. "사진은 저장하지 않고, 유닛은 세션당 상한. Mirror Tutor — 내 얼굴로 배우는 K-메이크업."

#### 리스크와 완화

**유닛 소진**
완화: 배분표대로 쓴다. 캐시 키(이미지+effects 해시), 세션 상한 20u, 잔량 <150이면 샘플 모델 모드, UI 개발은 모의 모드, 영상은 4테이크 안에. SNS 보너스로 +1,000 확보를 시도한다.

**API 지연·정확도**
완화: Day 1에 VTO 지연을 실측한다. 4단계는 레슨 시작 때 병렬로 발주하고(250req/300s 이내), 스켈레톤을 띄운 뒤 순서대로 공개한다. Face Analyzer 분류는 "홑꺼풀로 읽었어요, 맞나요?" 확인 화면에서 고칠 수 있다. 촬영 실패 코드는 가이드 문구로 매핑한다.

**얼굴 이미지 개인정보**
완화: 메모리에서만 처리, EXIF 제거, presigned PUT, 세션이 끝나면 결과 폐기. 동의 화면에 YouCam 30일 보관을 밝히고, 로그에 식별정보를 남기지 않으며, 영상에는 본인 얼굴만 쓴다.

**상표 규정(영상)**
완화: 가명 브랜드 "MT Select"와 일반명(벨벳 틴트, 쿠션 21N)만 쓴다. README에는 "실제 SKU는 제휴 피드로 교체"라고 적는다.

**"스타일리스트 래퍼"로 오해받을 위험**
완화: 영상 첫 15초에 채점 장면을 먼저 보여 주고, 규칙표(눈꺼풀 → 기법)를 화면에 노출한다.

#### Day 1에 닫아야 할 미확인 5건

1. Makeup VTO `pattern.name` 카탈로그 조회 경로와 eye_shadow/blush의 `colorNum`
1. Makeup VTO·Face Analyzer 실제 지연(초)
1. `GET /s2s/v2.0/credit/feature-cost` 응답과 위 단가표 대조
1. Face Analyzer `eyelid.left_eyelid` 값 집합(monolid/double/hooded 표기)
1. 1,000 유닛 리딤 코드 수령 여부(Devpost 등록 메일)

#### 제출 체크리스트

- 저장소 공개(MIT). README에 문제·해결·사용 YouCam API(엔드포인트·유닛)·아키텍처 그림·실행 방법(.env.example)·개인정보 원칙·한계(채점 오차, 데모 카탈로그)
- 배포 URL(Vercel) + 데모 모드 안내(유닛 보호) + 테스트용 샘플 이미지 2장(본인/동의 모델)
- Devpost 설명문: 기능, 소비자/커머스 가치, API 사용의 구체 기술, "Built with" 태그
- 영상 1~3분 YouTube 공개, 제3자 상표·음악 없음, 실기기 구동 장면 포함
- 스크린샷(최소 8): ① M1 가이드 실패 ② M1 통과 ③ M2 결과(수정 시트 열림) ④ M3 단계3 슬라이더 50% ⑤ M3 근거 칩 확대 ⑥ S2 두 얼굴 비교 ⑦ M4 채점 ⑧ M6 Shop the step ⑨ M7 공유 카드 ⑩ 아키텍처 다이어그램
- 트랙 선택: eCommerce VTO(Skin AI는 Face Analyzer에 한해 보조로 언급)
- 유닛 잔량 250 이상 확인(심사 기간 데모용), 데모 모드 폴백 동작 확인
- SNS 공유 2건(@YouCam API 태그, 사용 API 설명, "Received API credits for sharing", 제출 전에 만든 계정) + 폼 제출
- 수상 시 인터뷰·블로그 협조 동의 확인

출처: [공식 규정](https://youcam-api-skin-ai-ecommerce.devpost.com/rules) [Makeup VTO](https://docs.perfectcorp.com/reference/makeup_vto) [Face Analyzer](https://docs.perfectcorp.com/reference/ai_face_analyzer) [유닛 시스템](https://docs.perfectcorp.com/reference/unit_system) [레이트 리밋](https://docs.perfectcorp.com/develop/rate_limit) [SwipeFit](https://github.com/nickthelegend/swipefit) [글래스 가독성](https://setproduct.com/blog/liquid-glass-vs-glassmorphism)
