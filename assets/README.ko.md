# Grok2API 한국어판

[chenyme/grok2api](https://github.com/chenyme/grok2api)에 **한국어 패치**를 적용한 빌드입니다.
이 폴더는 [grok2api-kor 패처](https://github.com/jkh0kr/grok2api-kor)의 `patch.sh`가 자동 생성했습니다.

> 이 프로젝트는 기술 연구와 학습 목적으로만 제공됩니다. 사용 시 Grok 공식 이용약관과
> 해당 지역 법률을 반드시 준수하세요. 모든 결과에 대한 책임은 사용자에게 있습니다.

## 원본과의 차이

| 항목 | upstream (chenyme) | 이 빌드 |
| :-- | :-- | :-- |
| 관리 콘솔 언어 | 중국어(기본) / 영어 | **한국어(기본)** / 영어 / 중국어 |
| 첫 방문 언어 | zh-CN | **ko** (브라우저 저장값이 있으면 유지) |
| 언어 메뉴 | 简体中文, English | **한국어**, 简体中文, English |
| 나머지 기능 | — | upstream과 동일 (바이너리/로직 무변경) |

변경 파일은 `frontend/src/shared/i18n/index.ts`(ko 로케일 추가), `app-shell.tsx`(언어 메뉴),
`index.html`(lang=ko), `README.ko.md`, `.env`(한국어 이미지 지정)뿐입니다. `git log -1`으로 패치 시점의 upstream 커밋을 확인할 수 있습니다.

## 빠른 시작

```bash
cp config.example.yaml config.yaml
```

`config.yaml`에 시크릿과 관리자 계정을 넣습니다.

```bash
openssl rand -hex 32        # jwtSecret
openssl rand -base64 32     # credentialEncryptionKey
```

```yaml
secrets:
  jwtSecret: "위에서 생성한 hex 값"
  credentialEncryptionKey: "위에서 생성한 base64 값"

bootstrapAdmin:
  username: "admin"
  password: "강한 비밀번호"
```

실행 (패처가 `.env`에 한국어 이미지를 지정해 두므로 그대로 올리면 됩니다):

```bash
docker compose pull && docker compose up -d
docker compose logs -f grok2api
```

> `.env`의 `GROK2API_IMAGE=ghcr.io/jkh0kr/grok2api-kor:latest`가 한국어 패치 이미지를 가리킵니다.
> 이 줄을 지우면 upstream 원본 이미지(`ghcr.io/chenyme/grok2api`)가 올라갑니다.
> 소스에서 직접 빌드하려면: `docker build -t grok2api-kor:local .` 후
> `.env`에 `GROK2API_IMAGE=grok2api-kor:local`을 지정하세요.

브라우저에서 `http://127.0.0.1:8000` 을 열면 한국어 관리 콘솔이 나타납니다.
**이전에 중국어/영어로 사용하던 브라우저라면 언어 메뉴에서 "한국어"를 한 번 선택하세요.**
(언어 선택이 브라우저 localStorage에 저장되어 이전 값이 유지됩니다.)

자세한 설정(계정 연결, 모델 라우팅, 프록시, 품질 가드 등)은
[upstream README](https://github.com/chenyme/grok2api#readme)를 참고하세요.

## upstream 업데이트 반영

이 폴더에서 직접 수정하지 말고, 패처 저장소에서 다시 실행하세요:

```bash
cd grok2api-kor        # 패처 저장소
bash patch.sh          # 이 폴더를 upstream 최신본으로 갱신 + 패치 재적용
```

## 라이선스

upstream과 동일한 [MIT License](LICENSE)를 따릅니다. 원 저작권은 [Chenyme](https://github.com/chenyme)에게 있습니다.
