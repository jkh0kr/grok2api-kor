# grok2api-kor — grok2api 한글 패처

[chenyme/grok2api](https://github.com/chenyme/grok2api)를 **한국어 패치한 프로젝트를 별도 폴더에 생성**하는 패처입니다.
이 저장소에는 원본 소스가 없습니다. `patch.sh`를 실행하면 upstream을 자동으로 가져와 번역을 적용해
완전한 한글판 프로젝트를 만들어 줍니다.

> 이 프로젝트는 기술 연구와 학습 목적으로만 제공됩니다. 사용 시 Grok 공식 이용약관과
> 해당 지역 법률을 반드시 준수하세요. 모든 결과에 대한 책임은 사용자에게 있습니다.

## 사용법

```bash
git clone https://github.com/jkh0kr/grok2api-kor.git
cd grok2api-kor
bash patch.sh
```

실행 결과:

```
grok2api-kor/               # 이 패처 (원본 소스 없음)
grok2api-kor-patched/       # ← 한글패치된 완성 프로젝트가 여기 생성됨
```

옵션:

```bash
bash patch.sh /path/to/output     # 출력 폴더 지정
G2AK_REF=v3.1.5 bash patch.sh     # upstream 태그/브랜치/커밋 고정
G2AK_NO_COMMIT=1 bash patch.sh    # 패치 커밋 생략
```

- 출력 폴더가 없으면 **clone 후 패치**하고, 있으면 **upstream 최신본으로 갱신 후 패치를 다시 적용**합니다.
  (출력 폴더의 로컬 변경 사항은 초기화됩니다. 번역은 이 저장소의 `ko/`에서만 수정하세요.)
- 생성된 프로젝트 사용법은 출력 폴더의 `README.ko.md`를 참고하세요.
- 요구 사항: `git`, `node` 18+ (upstream 체크아웃에 맞춰 Node 22 권장)

## 무엇을 패치하나

| 대상 | 내용 |
| :-- | :-- |
| `frontend/src/shared/i18n/index.ts` | `ko` 로케일 추가(1,791 문구 전체 번역), 기본 언어 한국어, fallback en→zh-CN |
| `frontend/src/app/app-shell.tsx` | 언어 메뉴에 "한국어" 항목 추가 |
| `frontend/index.html` | `lang="ko"` |
| `docker-compose.yml` | 타임존 기본값 `Asia/Seoul`, 포트 매핑 기본값 `13256:8000` (시놀로지 등 8000 불가 환경 대응) |
| `Dockerfile` | `TZ=Asia/Seoul` |
| `README.ko.md` | 한국어 사용 안내 배치 |
| `.env` | `GROK2API_IMAGE=ghcr.io/jkh0kr/grok2api-kor:latest` — `docker compose up -d`만으로 한글 이미지 배포 |

upstream의 zh-CN/en 리소스는 그대로 보존되며, 바이너리·로직은 전혀 건드리지 않습니다.
번역 누락 문구는 자동으로 영어로 표시되고, `{{placeholder}}` 집합이 달라진 문구는 렌더링 보호를 위해
영어 원문으로 대체되며 경고가 출력됩니다.

## 구조

```text
patch.sh              # 진입점: upstream fetch → 외부 폴더에 패치 프로젝트 생성
lib/extract-i18n.mjs  # upstream i18n 리소스 추출기 (TS 샌드박스 평가)
lib/apply-patch.mjs   # 패치 적용기 + 사전 검증(누락/placeholder/드리프트)
ko/*.json             # 한국어 번역 사전 (섹션별 — en 트리와 같은 구조)
assets/README.ko.md   # 출력 프로젝트에 복사되는 한국어 README
```

## 번역 수정하기

1. `ko/<섹션>.json`을 편집합니다. (키 구조는 upstream `en` 트리와 동일)
2. `bash patch.sh`로 재적용해 확인합니다. — 누락·placeholder 불일치·제거된 키가 자동 보고됩니다.
3. PR 환영입니다.

## 사전 빌드 이미지

이 저장소의 CI가 `patch.sh` 실행 결과를 빌드해 `ghcr.io/jkh0kr/grok2api-kor`로 발행합니다
(`linux/amd64`, `linux/arm64`). 태그 `v{upstream}-kor.N`은 해당 upstream 버전 기준 한글판입니다.

```bash
docker pull ghcr.io/jkh0kr/grok2api-kor:latest
```

## 라이선스

MIT License. 패치 대상 프로젝트의 원 저작권은 [Chenyme](https://github.com/chenyme)에게 있습니다.
