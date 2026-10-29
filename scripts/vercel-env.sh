#!/usr/bin/env bash
# 로컬 .env 값을 Vercel production 환경변수로 올린다. 값은 화면·히스토리·로그에 출력하지 않는다
# (표준입력으로만 `vercel env add`에 넘김). 사용자가 직접 실행한다.
#
#   bash scripts/vercel-env.sh                     # 4개 키 모두 (.env에 값이 있는 것만)
#   bash scripts/vercel-env.sh YOUCAM_MODE         # 지정한 키만
#   YOUCAM_MODE_OVERRIDE=live bash scripts/vercel-env.sh YOUCAM_MODE   # .env와 다른 모드를 올릴 때
#
# 주의: YOUCAM_MODE=live 로 올리면 배포 사이트가 실제 유닛을 쓴다(세션 20u·일일 DAILY_UNIT_CAP(기본 120u) 가드,
#       잔량 150u 미만이면 샘플 모델 모드). 심사 기간 전까지는 mock 권장. 올린 뒤 재배포해야 반영된다:
#       npx vercel --prod --yes
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/.."

ENV_FILE=".env"
TARGET="production"
KEYS=(YOUCAM_API_KEY YOUCAM_SECRET_KEY ANTHROPIC_API_KEY YOUCAM_MODE)
[ $# -gt 0 ] && KEYS=("$@")

[ -f "$ENV_FILE" ] || { echo ".env 가 없습니다 (bash scripts/setup-env.sh 로 먼저 저장)"; exit 1; }
[ -d .vercel ] || { echo ".vercel/ 이 없습니다. 먼저 'npx vercel link --yes' 를 실행하세요."; exit 1; }

read_env() { # name → value on stdout (never echoed to the terminal by this script)
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  # strip one pair of surrounding quotes
  if [[ "$line" == \"*\" || "$line" == \'*\' ]]; then line="${line:1:${#line}-2}"; fi
  printf '%s' "$line"
}

for name in "${KEYS[@]}"; do
  case "$name" in
    YOUCAM_API_KEY|YOUCAM_SECRET_KEY|ANTHROPIC_API_KEY|YOUCAM_MODE|DAILY_UNIT_CAP|SESSION_UNIT_CAP|DEMO_MODE_THRESHOLD|GRADER_MODEL) ;;
    *) echo "  건너뜀: $name (허용 목록에 없음)"; continue ;;
  esac
  value="$(read_env "$name")"
  if [ "$name" = "YOUCAM_MODE" ] && [ -n "${YOUCAM_MODE_OVERRIDE:-}" ]; then value="$YOUCAM_MODE_OVERRIDE"; fi
  if [ -z "$value" ]; then echo "  건너뜀: $name (.env에 값 없음)"; continue; fi
  # replace if it already exists (rm fails harmlessly when absent)
  npx --yes vercel env rm "$name" "$TARGET" --yes >/dev/null 2>&1 || true
  if printf '%s' "$value" | npx --yes vercel env add "$name" "$TARGET" >/dev/null 2>&1; then
    echo "  올림: $name (${#value}자)"
  else
    echo "  실패: $name — 'npx vercel whoami' 로그인·'npx vercel link' 연결을 확인하세요"
  fi
  unset value
done

echo
echo "현재 $TARGET 환경변수 이름 목록:"
npx --yes vercel env ls "$TARGET" 2>/dev/null | awk 'NR>2 {print "  " $1}' || true
echo "반영하려면 재배포: npx vercel --prod --yes"
