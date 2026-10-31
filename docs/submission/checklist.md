# 제출 체크리스트 상태표 (이슈 #29 기준, 2026-10-30 작성)

마감: 2026-11-03(화) 01:45 KST (= 11/2 11:45am EST). 계획상 11/2 20:00 KST까지 제출 완료.
상태 표기: 완료 / 남음(사용자) / 남음(Claude). 이번 작업의 문서는 파일로만 작성했고 커밋·푸시는 하지 않았다.

## 저장소·문서

| 항목 | 상태 | 방법 / 메모 |
|---|---|---|
| README (문제·해결·API·아키텍처·실행·개인정보·한계·MIT·api-notes 링크) | 완료 | `README.md` 재작성. 읽어 보고 어색한 문장만 알려 주면 Claude가 고친다. |
| MIT 라이선스 파일 | 완료 | `LICENSE` 존재. |
| 아키텍처 그림 | 완료 | `docs/architecture.svg` + README의 Mermaid. 스크린샷 ⑩은 브라우저로 SVG를 열어 캡처(아래 참고). |
| 저장소 공개 | 완료 (10/31 공개) | 현재 PRIVATE. 공개 여부는 사용자가 결정한다. 공개 전 점검: `.env`·`.local/`이 커밋 이력에 없는지(`git log --all -- .env .local`), 사람 얼굴 사진 라이선스. 공개하지 않으려면 Devpost 안내대로 testing@devpost.com 에 저장소를 공유한다. |
| 문서 커밋·푸시 | 남음(사용자) | 요청하면 Claude가 커밋한다. 이번에는 하지 않음. |

## 배포·데모

| 항목 | 상태 | 방법 / 메모 |
|---|---|---|
| 배포 URL (Vercel) | 완료 | https://mirror-tutor.vercel.app — 10/31 live 모드 전환·재배포. `/api/credit` mode=live, 운영에서 model-b 분석 1회 성공(10u, 잔량 962u). |
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

## 영상 (이슈 #28) — 2026-10-31 갱신

| 항목 | 상태 | 방법 / 메모 |
|---|---|---|
| 데모 영상 (얼굴 없는 버전, 2:12) | 완료 | `.local/video/mirror-tutor-demo-live.mp4`. 로컬 서버를 live 모드로 띄워 실제 YouCam 호출로 녹화(14u). 스톡 사진만 나오고, 영어 나레이션(macOS 음성)과 영어 자막이 들어가며 음악은 없음. 다시 만들려면 `node scripts/demo/record-video.mjs --mode live` (video-script.md "자동 녹화" 절). |
| YouTube 공개 업로드 | 남음(사용자) | 위 mp4를 **공개**로 업로드. 제목 "Mirror Tutor - YouCam API VTO Hackathon", 설명에 라이브 URL·저장소 URL·"Sample faces: Pexels License stock photos". 링크를 알려 주면 devpost.md에 넣는다. |

## 스크린샷 — 완료

`.local/screenshots/01~10.png` (1920x1080, live 영상 프레임). 순서: 홈 → 촬영 가이드 → 분석 결과 → 규칙표 → 레슨 슬라이더 → 근거 칩 → 두 얼굴 비교 → 채점(88점, 입술 교정) → Shop the step → 공유 카드. Devpost 갤러리에 그대로 올리면 된다.
