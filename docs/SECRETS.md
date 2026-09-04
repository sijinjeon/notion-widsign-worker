# 환경변수(시크릿) 관리

Notion은 Worker의 시크릿을 저장 시 암호화하고, 실행 시점에 `process.env`로 노출합니다. 코드에서는 그냥 `process.env.WIDSIGN_API_KEY`처럼 읽으면 됩니다.

이 프로젝트가 쓰는 키: `WIDSIGN_API_ID`, `WIDSIGN_API_KEY`, `NOTION_API_TOKEN` (`.env.example` 참고).

## `ntn workers env` 하위 명령어

| 명령 | 하는 일 |
|---|---|
| `ntn workers env set KEY=value [KEY2=value2 ...]` | 배포된 Worker에 시크릿을 직접 설정 (여러 개 동시 가능). 기존 키는 덮어씀 |
| `ntn workers env list` | 설정된 키 이름만 표시 (값은 노출 안 됨) |
| `ntn workers env unset <KEY>` | 시크릿 삭제 |
| `ntn workers env push [--file=.env.local]` | 로컬 `.env` 파일 내용을 통째로 원격에 반영. 원격에만 있는 키는 지우지 않음 |
| `ntn workers env pull [--file=.env.local]` | 원격 시크릿을 로컬 `.env`로 받아옴. 기존 파일의 주석·공백은 보존 |

`--worker-id <id>`를 붙이면 현재 디렉토리에 바인딩된 Worker가 아닌 다른 Worker를 대상으로 실행할 수 있습니다. `--yes`는 비대화형(스크립트) 실행 시 확인 프롬프트를 건너뜁니다.

## 두 가지 설정 방법 중 선택

- **`env set`** — `.env` 파일을 로컬에 아예 만들지 않고, 키를 CLI 인자로 바로 원격에 설정. 파일로 남기고 싶지 않을 때.
- **`env push`** — `.env.example`을 복사해 `.env`로 채운 뒤 한 번에 반영. 키가 많거나 로컬에서도 같은 값으로 개발/테스트하고 싶을 때 (`.env`는 `.gitignore`에 이미 포함되어 있어 커밋되지 않음).

## 보안 원칙

- `.env`나 시크릿이 담긴 어떤 파일도 절대 커밋하지 않습니다. `.gitignore`에 `.env`, `.env.*`가 기본 포함되어 있고, 공개 템플릿인 `.env.example`만 예외(`!.env.example`)로 뒀습니다.
- `ntn workers env pull`로 받은 `.env`는 실제 값을 담고 있으므로 민감정보로 취급합니다.
- API 키나 토큰 값을 대화창, 커밋 메시지, 로그 출력에 남기지 않습니다.
