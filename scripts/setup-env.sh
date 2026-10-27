#!/usr/bin/env bash
# 키를 .env에 안전하게 저장한다. 입력값은 화면·히스토리·로그에 남지 않는다.
# 사용: bash scripts/setup-env.sh                 (모든 키를 차례로 묻는다; Enter = 기존 값 유지)
#       bash scripts/setup-env.sh ANTHROPIC_API_KEY (지정한 키만 묻는다)
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/.."

ENV_FILE=".env"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# 키 이름|설명|비밀 여부(1이면 입력이 화면에 안 보임)
KEYS=(
  "YOUCAM_API_KEY|YouCam API Key(클라이언트 ID)|1"
  "YOUCAM_SECRET_KEY|YouCam Secret Key (V1 잔량 조회용, 없으면 Enter)|1"
  "ANTHROPIC_API_KEY|Claude API Key (채점용, 워크스페이스에 묶인 키, 없으면 Enter)|1"
  "YOUCAM_MODE|YouCam 모드: mock | live (기본 mock)|0"
)

set_kv() { # name value
  local name="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -v -E "^${name}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$name" "$value" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
}

ONLY=("$@")
wanted() { [ ${#ONLY[@]} -eq 0 ] && return 0; for k in "${ONLY[@]}"; do [ "$k" = "$1" ] && return 0; done; return 1; }

echo "값을 붙여넣고 Enter. 건너뛰려면 그냥 Enter (기존 값 유지)."
for row in "${KEYS[@]}"; do
  IFS='|' read -r name desc secret <<< "$row"
  wanted "$name" || continue
  printf '%s [%s]: ' "$desc" "$name"
  if [ "$secret" = "1" ]; then read -rs v; echo; else read -r v; fi
  # 붙여넣기 마커(ESC[200~ / ESC[201~)·제어문자·비ASCII 바이트 제거 (키 값은 ASCII)
  v="$(printf '%s' "$v" | LC_ALL=C tr -cd '\041-\176')"
  [ -z "$v" ] && continue
  set_kv "$name" "$v"
  echo "  저장 (${#v}자)"
done

grep -q -E '^YOUCAM_MODE=' "$ENV_FILE" || printf 'YOUCAM_MODE=mock\n' >> "$ENV_FILE"
mkdir -p .local

echo
echo "저장 완료: $ENV_FILE (권한 600). 설정된 키 이름:"
grep -o -E '^[A-Z_]+' "$ENV_FILE" | tr '\n' ' '; echo
