# Mirror Tutor 디자인 기준

- 기준: Peerly 공통 디자인 시스템 v0.1.0 (`peerly-mockup/docs/design/05-design-system.md`, `design-tokens.json`, 2026-10-09)에서 **구조·치수·접근성 규칙만** 가져온다. Peerly 로고·제품명·파랑 primary는 쓰지 않는다.
- 제품 색: 계획서 보고서의 "디자인 방향: 따뜻한 코치 · 모바일 390×844"를 따른다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-primary` | `#C8325B` (로즈) | 화면당 CTA 하나, "정답" 라벨 |
| `--color-canvas` | `#FBF7F4` (크림) | 페이지 바탕 |
| `--color-panel` | `#FFFFFF` | 패널 |
| `--color-ink` | `#1F1B1A` | 본문 |
| `--color-muted` | `#6B605C` | 보조 텍스트 (크림 위 대비 ≥ 4.5) |
| `--color-peach` | `#F6C9B6` | 선택 surface |
| `--color-success` | `#3F8A6C` (세이지) + 체크 아이콘 | 통과·완료 |
| `--color-warning` | `#9A560C` (앰버) + 삼각형 아이콘 | 가이드 실패·주의 |
| `--color-danger` | `#B3261E` | 오류 |

- 치수(Peerly): 간격 4/8/12/16/20/24/32, radius panel 16 / button 16(목업 지정) / input 8 / sheet 22, 터치 영역 ≥ 48px, 좌우 여백 16.
- 타이포: 한글 Noto Sans KR, 점수·퍼센트·hex는 Manrope tabular-nums. 실사용 글자 12px 미만 금지.
- 상태는 색 + 아이콘을 같이 쓴다(색만으로 구분하지 않음). focus 3px / offset 3px, reduced-motion 시 애니메이션 제거.
- 모바일 단일 열, 주요 행동은 하단 엄지 영역에 하나.
