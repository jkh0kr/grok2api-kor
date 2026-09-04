#!/usr/bin/env bash
# patch.sh — chenyme/grok2api 를 가져와 한글 패치를 적용한 프로젝트를
#            별도 폴더에 생성한다. (이 저장소에는 원본 소스가 섞이지 않는다)
#
# 사용법:
#   bash patch.sh                          # ../grok2api-kor-patched 에 생성/갱신
#   bash patch.sh /path/to/output          # 출력 폴더 지정
#   G2AK_REF=v3.1.5 bash patch.sh          # upstream 태그/브랜치/커밋 고정
#   G2AK_NO_COMMIT=1 bash patch.sh         # 패치 커밋 생략 (작업 트리 변경만)
#
# 출력 폴더 동작:
#   - 없다면: upstream 을 clone 해 생성하고 패치를 적용한다.
#   - 있다면: upstream 을 fetch 하고 하드 리셋한 뒤 패치를 다시 적용한다.
#             (출력 폴더의 로컬 변경 사항은 사라진다 — 패치 사전만 수정할 것)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DEFAULT="$(cd "$SCRIPT_DIR/.." && pwd)/grok2api-kor-patched"
OUT="${1:-$OUT_DEFAULT}"
OUT="$(cd "$(dirname "$OUT")" 2>/dev/null && pwd)/$(basename "$OUT")" || OUT="$OUT_DEFAULT"
UPSTREAM_URL="${G2AK_UPSTREAM:-https://github.com/chenyme/grok2api.git}"
REF="${G2AK_REF:-}"

echo "==> 출력 대상: $OUT"
mkdir -p "$(dirname "$OUT")"

if [ -d "$OUT/.git" ]; then
  if ! git -C "$OUT" remote get-url upstream >/dev/null 2>&1; then
    echo "오류: $OUT 이(가) 이 패처의 출력 폴더가 아닙니다 (upstream remote 없음)." >&2
    echo "       다른 경로를 지정하거나 해당 폴더를 제거하세요." >&2
    exit 1
  fi
  echo "==> upstream 갱신"
  git -C "$OUT" fetch upstream --tags --prune
  TARGET_REF="${REF:-$(git -C "$OUT" symbolic-ref --short refs/remotes/upstream/HEAD 2>/dev/null || echo upstream/main)}"
  echo "==> $TARGET_REF 로 하드 리셋 (로컬 변경 사항은 버려짐)"
  git -C "$OUT" checkout -q -B main "$TARGET_REF"
  git -C "$OUT" reset -q --hard "$TARGET_REF"
else
  if [ -e "$OUT" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then
    echo "오류: $OUT 이(가) 이미 존재하고 비어 있지 않습니다." >&2
    exit 1
  fi
  echo "==> upstream clone ($UPSTREAM_URL)"
  if [ -n "$REF" ]; then
    git clone --depth 50 --branch "$REF" "$UPSTREAM_URL" "$OUT"
  else
    git clone --depth 50 "$UPSTREAM_URL" "$OUT"
  fi
  git -C "$OUT" remote rename origin upstream
  git -C "$OUT" checkout -q -b main 2>/dev/null || git -C "$OUT" branch -m main
fi

echo "==> 한글 패치 적용"
node "$SCRIPT_DIR/lib/apply-patch.mjs" "$OUT"

UPSTREAM_SHA="$(git -C "$OUT" rev-parse --short HEAD)"
if [ "${G2AK_NO_COMMIT:-0}" != "1" ]; then
  git -C "$OUT" add -A
  if git -C "$OUT" diff --cached --quiet; then
    echo "==> 커밋 생략 (변경 사항 없음)"
  else
    git -C "$OUT" -c user.name="grok2api-kor patcher" \
      -c user.email="patcher@localhost" \
      commit -q -m "patch: 한국어 패치 적용 (upstream $UPSTREAM_SHA)"
    echo "==> 패치 커밋 생성: $(git -C "$OUT" rev-parse --short HEAD)"
  fi
fi

echo ""
echo "완료! 한글패치된 프로젝트: $OUT"
echo "  cd \"$OUT\""
echo "  cp config.example.yaml config.yaml   # 시크릿/관리자 설정 후"
echo "  docker compose up -d                 # .env 덕분에 한글 이미지로 배포됨"
echo ""
echo "  기본 접속: http://<호스트>:13256  (기본 포트 매핑 13256:8000, TZ=Asia/Seoul)"
echo "  포트 변경: .env 에 GROK2API_PORT=<포트> 추가"
echo ""
echo "주의: 이전에 중국어/영어로 사용하던 브라우저는 언어 메뉴에서 '한국어'를"
echo "      한 번 선택해야 합니다 (언어 선택이 브라우저에 저장되어 있음)."
