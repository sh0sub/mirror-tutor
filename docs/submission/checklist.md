# 제출 체크리스트 상태표 (이슈 #29 기준, 2026-11-01 갱신)

마감: 2026-11-03(화) 01:45 KST (= 11/2 11:45am EST). 계획상 11/2 20:00 KST까지 제출 완료.
상태 표기: 완료 / 남음(사용자) / 남음(Claude). 문서·코드는 모두 main에 커밋·푸시됨(최신 영상 재합성 커밋 포함).

## 저장소·문서

| 항목 | 상태 | 방법 / 메모 |
|---|---|---|
| README (문제·해결·API·아키텍처·실행·개인정보·한계·MIT·api-notes 링크) | 완료 | `README.md` 재작성. 읽어 보고 어색한 문장만 알려 주면 Claude가 고친다. |
| MIT 라이선스 파일 | 완료 | `LICENSE` 존재. |
| 아키텍처 그림 | 완료 | `docs/architecture.svg` + README의 Mermaid. 스크린샷 ⑩은 브라우저로 SVG를 열어 캡처(아래 참고). |
| 저장소 공개 | 완료 (10/31 공개) | PUBLIC 확인(11/1). 공개 전 점검 통과: `git log --all -- .env .local` 비어 있음, 추적 파일에 `.env*`(예시 제외)·`.local/`·영상·키·`*.db` 없음, 이력과 작업 트리의 사진은 `public/demo/model-a|b`의 Pexels 스톡뿐, 비밀값 패턴 검색 0건. |
| 문서 커밋·푸시 | 완료 | main에 푸시됨. 영상·스크린샷은 gitignore된 `.local/`에만 있다. |

## 배포·데모

| 항목 | 상태 | 방법 / 메모 |
|---|---|---|
| 배포 URL (Vercel) | 완료 (11/2 00:0x KST 재배포, d1ea775 기준) | https://mirror-tutor.vercel.app — `/api/credit` mode=live, 잔여 934u. 홈·/compare·/shop·/record 200, 390px 기기 에뮬레이션에서 가로 넘침 없음, /compare에 새 비교 화면 표시 확인. Vercel에 Git 연결이 없어 이후 커밋은 수동 재배포 필요. |
| Vercel을 `YOUCAM_MODE=live`로 전환 + 재배포 | 완료 (10/31) | |
| 라이브 전환 후 동작 확인 | 완료 (10/31) | 분석 API 운영 호출 성공. VTO·채점은 같은 코드의 로컬 live 녹화에서 확인. |
| 유닛 잔량 250 이상 확인 | 완료 (10/31 972u) | 마지막으로 기록된 값은 10/28 스파이크의 1000u(이후 사용량은 확인 필요). 홈 화면 잔량 또는 YouCam 콘솔에서 확인. 150 미만이면 앱이 자동으로 데모 모드가 된다. |
| 테스트용 샘플 이미지 2장 | 완료(확인 필요) | `public/demo/model-a`, `model-b`가 있다. 둘 다 Pexels 스톡 사진(Pexels License)이다. 규칙은 "본인 또는 동의받은 모델"이므로 스톡 사진을 그대로 써도 되는지 사용자가 판단하거나 본인 사진으로 교체한다. |
| 데모 모드 안내(유닛 보호) | 완료 | 앱 배너와 README의 "Demo mode and unit guard" 절. |

## Devpost 입력

| 항목 | 상태 | 방법 / 메모 |
|---|---|---|
| 설명문 | 완료(초안) | `docs/submission/devpost.md`. 항목별로 Devpost 칸에 붙여넣기는 남음(사용자). |
| 트랙 선택 | 남음(사용자) | eCommerce VTO 선택. Skin AI는 고르지 않는다. |
| Built with 태그 | 완료(초안) | devpost.md 하단. |
| Try it out 링크 | 남음(사용자) | 라이브 URL, 저장소 URL(공개 후), YouTube URL. |
| 소스 저장소 URL | 완료 | https://github.com/sh0sub/mirror-tutor |
| 수상 시 인터뷰·블로그 협조 동의 확인 | 남음(사용자) | Devpost/대회 규정 페이지에서 동의 항목 확인. |

## 영상 (이슈 #28) — 2026-11-01 재녹화·재합성

| 항목 | 상태 | 방법 / 메모 |
|---|---|---|
| 데모 영상 (얼굴 없는 버전, 2:51) | 완료 (11/1) | `.local/video/mirror-tutor-demo-live.mp4` (이전 판 `-prev.mp4`, `-prev2.mp4`). live 녹화(14u, 잔량 948 -> 934)의 저장 프레임을 `node scripts/demo/recomposite.mjs`로 다시 합성(0u): 폰 옆에 같은 화면의 1.85배 확대 패널과 장면별 콜아웃을 두고, 어두운 "카메라 없음" 장면은 품질 게이트 확대 화면 3.7초로 줄였다. 첫 장면은 "홑꺼풀이면 남의 눈 튜토리얼이 안 맞는다"는 문제 제기, 비교 화면은 쌍꺼풀 vs 속쌍 기법 차이 콜아웃을 6초 유지, 개인정보·세션 20유닛 상한은 나레이션으로도 말한다. 스톡 사진만, 영어 나레이션(macOS 음성)·자막, 음악 없음. |
| YouTube 공개 업로드 | 남음(사용자) | 위 mp4를 **공개**로 업로드. 제목 "Mirror Tutor - YouCam API VTO Hackathon", 설명에 라이브 URL·저장소 URL·"Sample faces: Pexels License stock photos". 링크를 알려 주면 devpost.md에 넣는다. |

## 스크린샷 — 완료 (11/2 재생성)

`.local/screenshots/01~12-*.png` (1920x1080, 11/1 재합성 영상에서 추출, 폰 + 1.85배 확대 패널 + 콜아웃 레이아웃). 순서: 홈(문제 제기) → 동의 시트 → 분석 결과 → 규칙표 → 레슨 슬라이더 → 근거 칩 → 두 얼굴 비교(기법 차이 콜아웃) → what-if 패널 → 채점(87점) → Shop the step → 홈 스트릭·지난 결과 → 공유(개인정보·20유닛 상한). 이전 갤러리는 `.local/screenshots-prev2/`. Devpost 갤러리에 올리면 된다.

## 테스트 현황 (11/1)

vitest 183개 통과(25개 파일), typecheck·lint 오류 0.
