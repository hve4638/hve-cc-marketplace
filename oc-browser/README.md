# oc-browser

Docker 컨테이너 안의 격리된 headed Chromium을 호스트에서 한 줄로 조작하는 Claude Code 플러그인. `oc-as <name> browser <action>`이면 끝.

이름에 prefix를 붙이면 표시 방식이 바뀝니다:

- `host:<rest>` — 호스트 X 서버에 Chromium을 직접 그림
- `vnc:<rest>` — 빈 포트(6080-6099)에 noVNC 자동 노출
- `vnc:<port>:<rest>` — 포트 명시
- `<rest>` — 헤드리스(레거시)

각 resolved 이름이 별도 컨테이너이고 프로젝트 단위로 자동 분리됩니다 (`oc-browser-<projTag>-<name>`).

## 요구 사항

- Linux 호스트 + Docker (rootless 가능)
- `host:` 모드를 쓸 거면 호스트에 X 서버(`:0`)가 있고 사용자가 GUI 세션으로 로그인되어 있어야 함

## 설치

```bash
/oc-setup      # Claude Code 안에서
```

또는 수동:

```bash
bash scripts/install.sh
```

`openclaw-browser:local` 이미지를 빌드하고, `oc-as`/`oc-list`/`oc-rm`/`oc`를 PATH(`~/.local/bin`)에 심링크합니다. 멱등.

## 빠른 시작

```bash
# 호스트 모니터에 Chromium 창 띄우기
sudo -u <your-user> env DISPLAY=:0 XAUTHORITY=$HOME/.Xauthority xhost +SI:localuser:<your-user>
oc-as host:work browser open https://example.com --label demo

# noVNC로 보기
oc-as vnc:work browser open https://example.com --label demo
# stderr에 출력된 http://127.0.0.1:<port>/vnc.html 열기

# 헤드리스 자동화
oc-as auto browser open https://example.com --label demo
oc-as auto browser snapshot --target-id demo --format aria
oc-as auto browser screenshot --full-page
```

스크린샷/PDF는 자동으로 `<project>/.agent-memory/oc-volume/<resolved>/media/browser/<uuid>.<ext>`에 저장됩니다.

## 명령어

### `oc-as <name> <openclaw browser args...>`

컨테이너 lazy 생성 + `openclaw browser`로 forward. 같은 이름은 같은 컨테이너에 attach. `<name>` 정규식: `[a-zA-Z0-9][a-zA-Z0-9_.-]{0,24}` (prefix 제외).

### `oc-list`

이 호스트의 모든 `oc-browser-*` 컨테이너와 그 상태/바인드된 호스트 디렉토리 표시.

### `oc-rm [flags] <name>... | --all`

컨테이너 + docker home 볼륨 제거. `<name>` 형식은 `oc-as`와 동일. 호스트측 `.agent-memory/oc-volume/<resolved>/`는 기본 보존.

```bash
oc-rm host:work                      # 기본 (공유 dir 유지)
oc-rm vnc:research                   # 'research'의 모든 포트 매칭
oc-rm -f --rm-shared host:demo       # 공유 dir까지 nuke
oc-rm --keep-volume vnc:5901:fixed   # 쿠키/프로파일 보존
oc-rm --all                          # 이 프로젝트 통째로
```

매칭 0건이면 silent 성공 대신 명시적 에러로 실패합니다 (오타 가드).

### `oc browser <openclaw browser args...>`

이미 격리된 환경(예: 컨테이너 안에서 도는 Claude) 전용. Docker 우회하고 `npx -y openclaw@<핀>`으로 그냥 forward. `<name>`/프로젝트 스코핑 없음 — 둘러싼 컨테이너가 격리 단위.

```bash
oc browser open https://example.com --label demo
oc browser snapshot --target-id demo --format aria
```

- `/.dockerenv` 없으면(= 호스트 환경) 경고 + 3초 sleep. `OC_NO_HOST_WARN=1`로 끔.
- `npx`/Chromium(`chromium`/`chromium-browser`/`google-chrome`) 부재 시 설치 안내 후 실패.
- 핀 override: `OC_PIN=<버전> oc browser ...` (기본 `2026.4.27`).
- `oc-list`/`oc-rm`은 `oc`를 모름 — 정리할 컨테이너/볼륨이 없고, 둘러싼 컨테이너 종료가 곧 정리.

## 동작 원리 (요약)

- 컨테이너: Debian 12 기반, Chromium + Xvfb(`:99`) + openclaw gateway. `OC_VIEW=1`이면 x11vnc + noVNC 추가.
- 프로젝트 분리: `oc-as`는 PWD에서 위로 walk-up하여 `.agent-memory/oc-volume/`을 찾고, 그 부모 디렉토리 basename을 `<projTag>`로 사용.
- 데이터 위치:
  - 컨테이너 home(쿠키/프로파일) → docker volume `oc-browser-home-<projTag>-<resolved>`
  - 호스트 공유 + media → `<project>/.agent-memory/oc-volume/<resolved>/{shared,media}/`
- 동시 실행: 호스트 X는 multi-client라 여러 컨테이너가 동시에 호스트 화면에 창을 그려도 충돌 없음. VNC는 컨테이너마다 다른 포트.

## 디렉토리 구조

```
oc-browser/
├── .claude-plugin/plugin.json     # 플러그인 매니페스트
├── CLAUDE.md                      # 에이전트 가드레일 (시행착오 메모)
├── README.md                      # 이 문서
├── scripts/
│   ├── Dockerfile                 # 이미지 레시피
│   ├── entrypoint.sh              # Xvfb + gateway + (선택) VNC
│   ├── install.sh                 # 빌드 + 심링크
│   ├── oc-as                      # 메인 wrapper (Docker 격리)
│   ├── oc-list                    # 활성 인스턴스 표시
│   ├── oc-rm                      # 정리
│   └── oc                         # native passthrough (이미 격리된 환경 전용)
└── skills/
    ├── oc-as/                     # /oc-as 스킬 (en + ko)
    └── oc-setup/                  # /oc-setup 스킬 (en + ko)
```

## 알려진 한계

- `upload`/`download`/`waitfordownload`가 쓰는 `/tmp/openclaw-<uid>/{uploads,downloads}/`는 bind-mount되지 않습니다. 호스트와 파일을 주고받으려면 `docker cp`를 쓰거나 `/home/oc/shared/`에 stage하세요.
- VNC 자동 포트 범위는 6080-6099(20개). 그 이상 동시에 띄우려면 `vnc:<port>:<rest>`로 명시.
- `OC_VIEW=1` 환경변수는 prefix 모드와의 호환을 위한 레거시. 다음 메이저에서 제거 예정 — 새 코드에서는 `vnc:<rest>` 사용 권장.
- Strict 사이트(Cloudflare, Google login, X/Twitter 등)는 데이터센터 IP / `navigator.webdriver=true` 때문에 자주 차단. 차단을 보고하고 루프 재시도는 하지 말 것.

## 라이선스

MIT.
