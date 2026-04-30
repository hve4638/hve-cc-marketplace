---
name: oc-as
description: Docker 컨테이너 안의 격리된 headed Chromium을 `oc-as <name> browser <action>`으로 조작합니다. `<name>`에 prefix를 붙여 표시 모드 선택 가능: `host:<rest>`는 호스트 X 서버에 직접 그림, `vnc:<rest>`는 빈 포트에 noVNC 자동 노출(`vnc:<port>:<rest>`로 포트 명시 가능), prefix 없으면 헤드리스(레거시). 각 resolved 이름이 별도 컨테이너(쿠키·캐시·프로파일). 프로젝트 자동 분리 — 같은 `<name>`이라도 다른 프로젝트에선 다른 컨테이너. 라이프사이클 수동: 첫 호출 시 생성, `oc-rm <name>`으로 제거. `oc-list`로 살아있는 인스턴스 확인. 형제 명령 `oc browser <action>`은 이미 격리된 환경(예: 컨테이너 안에서 도는 Claude)을 위한 것 — Docker를 건너뛰고 `npx openclaw`를 그 환경에 바로 forward. URL 열기/스크린샷/JS 렌더링 페이지 스크래이프/폼 작성/웹 자동화/사이트 로그인/PDF 출력/클릭·타이핑/그 외 진짜 브라우저 구동이 필요할 때 사용. `WebFetch`/`curl`로 충분한 단순 HTML/JSON에는 사용 금지. `oc-as`가 `command not found`이면 /oc-setup으로 라우팅 후 중단.
---

# oc-as

`oc-as <name> browser <action>`은 컨테이너 `oc-browser-<projTag>-<name>` 안의 격리된 headed Chromium을 조작합니다. 컨테이너는 첫 호출 시 lazy하게 생성되고, 사용자가 명시적으로 제거하기 전까지 유지됩니다.

## 프로젝트 스코프 동작

호출마다 `oc-as`는:

1. 현 PWD부터 위로 walk-up하며 `.agent-memory/oc-volume/`를 찾음.
2. 없으면 PWD에 생성 (생성 시 stderr로 한 줄 알림).
3. 그 디렉토리의 부모 (= 프로젝트 root) basename을 `<projTag>`로 사용.
4. `<volume-root>/<name>/`의 `shared/`는 `/home/oc/shared/`에, `media/`는 `/home/oc/.openclaw/media/`에 각각 bind-mount (상세 매핑은 아래 '파일 교환' 표).

결과:
- 같은 프로젝트 + 같은 이름 → 같은 컨테이너 (재부착)
- 같은 프로젝트 + 다른 이름 → 다른 컨테이너 (쿠키/탭 분리)
- 다른 프로젝트 + 같은 이름 → 다른 컨테이너 (프로젝트 basename이 다름)
- 호스트측 상태는 전부 `<project>/.agent-memory/oc-volume/` 아래. gitignore 권장.

전 프로젝트 통틀어 살아있는 것 확인:

```bash
oc-list
```

## 이름 정하기

`<name>`은 프로젝트 안에서 자유 선택. 후속 호출에서 같은 이름 재사용.

- 작업 단위로 한 개 이름: `work`, `research`, `demo`, `signup-test`.
- 같은 이름 → 같은 프로젝트 내에서 같은 컨테이너.
- 같은 프로젝트의 여러 Claude 호출(또는 여러 세션)이 같은 이름을 쓰면 그 컨테이너를 공유 — 공유가 의도된 경우에만.

`<rest>` 이름 규칙: `[a-zA-Z0-9][a-zA-Z0-9_.-]{0,24}`.

## 표시 모드 (prefix)

`oc-as`의 첫 인자에 prefix를 붙이면 Chromium을 어떻게 보여줄지 선택할 수 있습니다. prefix는 resolved 컨테이너 이름에 그대로 박혀서, 같은 `<rest>`에 모드만 다르면 다른 컨테이너가 되어 충돌 안 납니다.

| 형식 | resolved suffix | 동작 |
|---|---|---|
| `<rest>` | `<rest>` | 헤드리스 게이트웨이만. 디스플레이도 VNC도 없음. 스크립트에서 자동화/스크린샷용. (레거시 기본 — 호환 유지.) |
| `host:<rest>` | `host_<rest>` | 호스트 X 서버에 Chromium 직접 그림. `$DISPLAY` 우선, 없으면 `/tmp/.X11-unix/X0` 보고 `:0`로 폴백. `/tmp/.X11-unix:ro` 마운트. 호스트 X에 닿을 수 없으면 안내문과 함께 빠르게 실패. |
| `vnc:<rest>` | `vnc_<port>_<rest>` | `6080-6099` 중 빈 포트 자동 선택해 noVNC 노출. 같은 `vnc:<rest>`로 재호출하면 기존 컨테이너 찾아 같은 포트로 attach. |
| `vnc:<port>:<rest>` | `vnc_<port>_<rest>` | 같지만 포트 명시. 충돌이면 실패. 범위: `1024-65535`. |

`host:` 모드는 컨테이너 UID(1000, `oc` 사용자)가 호스트 X 서버에 허용돼 있어야 합니다. 가장 간단한 방법: 호스트 GUI 세션에서 한 번 `xhost +SI:localuser:<your-user>` — 단 호스트 사용자 UID가 1000일 때만 깔끔히 통합니다. UID가 다르면 `xhost +local:` 같은 더 느슨한 옵션이나 별도 UID 매핑이 필요합니다.

VNC 모드는 매 호출마다 stderr로 `oc-as: VNC at http://127.0.0.1:<port>/vnc.html`을 출력 — URL이 바로 보입니다.

`vnc:<rest>`(포트 미명시)가 권장 진입점입니다. 빈 포트를 자동으로 잡아주니 여러 VNC 인스턴스를 수동 포트 관리 없이 동시에 띄울 수 있습니다.

예시:
```bash
oc-as host:work browser open https://example.com --label demo
oc-as vnc:research browser doctor              # 6080부터, 점유돼있으면 6081, ...
oc-as vnc:5901:fixed browser status             # 포트 명시
oc-as headless browser screenshot               # 그대로 <rest>, 디스플레이 없음
```

## 추가 docker 플래그

GPU 패스스루나 메모리 제한 같은 추가 docker run 플래그가 필요하면 `OC_DOCKER_EXTRA="-e KEY=val --gpus all"` 환경변수로 넘길 수 있습니다. **컨테이너 생성 시점에만** 적용 — 이미 있는 컨테이너에는 무시되므로, 변경하려면 `oc-rm <name>`으로 지운 뒤 재생성하세요.

## 컨테이너 없이 forward: `oc`

호출자가 **이미 컨테이너 안**(dev container, 샌드박스된 Claude 환경 등)일 때는 또 한 겹 Docker를 띄우는 게 낭비거나 불가능합니다. 이런 케이스를 위해 형제 명령을 같이 제공합니다:

```bash
oc browser <action> [args...]
```

`oc`는:

- Docker 우회. 현재 환경에 `npx -y openclaw@<핀 버전>`을 그대로 forward.
- **`<name>` 인자 없음, 프로젝트 스코핑 없음** — 둘러싼 컨테이너 자체가 격리 단위라서 추가 state-dir 분기는 게이트웨이 소켓 충돌만 부름.
- openclaw 기본 프로파일(`~/.openclaw/`) 그대로 사용 — 컨테이너 안이면 그 home이 이미 격리됨.
- 매 비-readonly 호출에서 `/.dockerenv` 체크. 없으면(즉 진짜 호스트) 경고 + 3초 sleep 후 forward. `OC_NO_HOST_WARN=1`로 끔.
- `npx`와 Chromium 바이너리(`chromium` / `chromium-browser` / `google-chrome`)가 PATH에 있는지 사전 확인. 없으면 설치 안내와 함께 빠르게 실패.
- 한 호출만 다른 버전을 쓰고 싶으면 `OC_PIN=<버전> oc browser ...`로 핀 override.

언제 어느 쪽:

| 호출자 환경 | 선택 |
|---|---|
| 베어 호스트, 작업별 격리 필요 | `oc-as <name> browser ...` |
| 이미 컨테이너 안(Claude 등) | `oc browser ...` |
| 호스트 X / VNC 표시 모드 필요 | `oc-as host:<name>` / `oc-as vnc:<name>` (컨테이너 전용) |

`oc`는 `oc-list`/`oc-rm`과 무관 — 그 둘은 Docker 전용으로 유지. 정리할 게 없고, 둘러싼 컨테이너가 끝나는 게 곧 정리입니다.

## 운영 루프

다단계 작업에서 항상:

1. **상태 먼저.** `oc-as <name> browser status` (의심 시 `doctor`).
2. **라벨 붙여 열기.** `oc-as <name> browser open <url> --label <l>` — 안정 핸들 확보.
3. **스냅샷 → 액션.** `oc-as <name> browser snapshot --target-id <l> --format aria`로 ref를 받고 그 ref로 액션.
4. **UI 변화마다 재스냅샷.** 네비게이션 / DOM 변경 클릭 / 모달 / 폼 제출 → 다시 스냅샷.
5. **stale ref → 1회 재시도.** 재스냅샷 후 다시. 그래도 실패하면 페이지 상태 보고.
6. **수동 차단은 멈추고 보고.** 로그인, 2FA, captcha, 카메라/마이크 권한, 계정 선택 등 — 자격증명 추측 금지, 루프 금지.

## 명령어 레퍼런스

브라우저 액션은 모두 `oc-as <name> browser <action> [플래그...]` 형태.

라이프사이클 (브라우저 프로세스 한정, 컨테이너가 아님):
```bash
oc-as <name> browser doctor [--deep]
oc-as <name> browser status
oc-as <name> browser start [--headless]
oc-as <name> browser stop
oc-as <name> browser reset-profile
```

탭:
```bash
oc-as <name> browser tabs
oc-as <name> browser open <url> --label <l>
oc-as <name> browser focus <l|t1|targetId>
oc-as <name> browser close <l|t1|targetId>
```

조사:
```bash
oc-as <name> browser snapshot --target-id <l> [--format aria] [--efficient] [--labels] [--limit <n>] [--urls]
oc-as <name> browser screenshot [--full-page | --ref <r> | --labels]
oc-as <name> browser pdf
```

`screenshot`/`pdf`는 컨테이너 안 `~/.openclaw/media/browser/<uuid>.<ext>`에 자동 저장 — bind-mount되어 호스트에서도 바로 보임 ("파일 교환" 섹션 참고). stdout으로 `MEDIA:` / `PDF:` 한 줄 출력.

액션 (같은 `--target-id` 위에서 최신 스냅샷의 ref 사용; 플래그 이름은 kebab — `--targetId`는 거부됨):
```bash
oc-as <name> browser navigate <url> --target-id <l>
oc-as <name> browser click <ref> --target-id <l> [--double]
oc-as <name> browser type <ref> "<text>" --target-id <l> [--submit]
oc-as <name> browser press <key> --target-id <l>
oc-as <name> browser hover <ref> --target-id <l>
oc-as <name> browser select <ref> "<option>"... --target-id <l>
oc-as <name> browser fill --fields '[{"ref":"1","value":"Ada"}]' --target-id <l>
oc-as <name> browser wait --text "<phrase>" --target-id <l>
oc-as <name> browser highlight <ref> --target-id <l>
```

파일 / 다이얼로그 / 다운로드 — 경로는 컨테이너측이고 openclaw가 `/home/oc/shared/`가 아니라 자체 디렉토리만 허용. `oc-as`는 이 경로들을 bind-mount하지 않으므로 호스트에서 직접 보이지 않음. 필요하면 `docker cp`로 옮기거나 `/home/oc/shared/`에 stage 후 참조:

```bash
oc-as <name> browser upload <container-path>          # /tmp/openclaw-<uid>/uploads/ 아래
oc-as <name> browser dialog --accept                  # 또는 --dismiss; 다음 다이얼로그를 arm
oc-as <name> browser download <ref> <container-path>  # /tmp/openclaw-<uid>/downloads/ 아래
oc-as <name> browser waitfordownload <container-path> # 같은 제약
```

디버그:
```bash
oc-as <name> browser console [--level error]
oc-as <name> browser errors
oc-as <name> browser requests
oc-as <name> browser trace start
oc-as <name> browser trace stop
oc-as <name> browser evaluate --fn '(el) => el.textContent' --ref <r>
```

대부분의 명령에 `--json`을 붙이면 기계 가독 출력. `openclaw browser --help`의 Examples가 표준 호출 형태의 source of truth — 이 문서와 다르면 그쪽이 맞습니다.

## 파일 교환

호스트에서 보이는 디렉토리는 두 개, 모두 `<project>/.agent-memory/oc-volume/<resolved>/` 아래:

| 용도 | 컨테이너 경로 | 호스트 경로 |
|---|---|---|
| 일반 공유 스크래치 (자유 사용) | `/home/oc/shared/` | `<project>/.agent-memory/oc-volume/<resolved>/shared/` |
| `screenshot` / `pdf` 산출물 (자동 저장) | `/home/oc/.openclaw/media/browser/<uuid>.<ext>` | `<project>/.agent-memory/oc-volume/<resolved>/media/browser/<uuid>.<ext>` |

`<resolved>`은 컨테이너 이름의 suffix (예: `host_work`, `vnc_6080_research`, 또는 plain `work`).

`screenshot`/`pdf`는 stdout으로 `MEDIA:`/`PDF:` 라인을 출력하는데 거기 적힌 건 **컨테이너** 경로. 호스트 경로는 같은 uuid 파일명을 `<project>/.agent-memory/oc-volume/<resolved>/media/browser/` 아래에서 찾으면 됨. 사용자에게는 호스트 경로를 안내할 것.

`upload`/`download`/`waitfordownload`가 쓰는 openclaw 내부 경로(`/tmp/openclaw-<uid>/{uploads,downloads}/`)는 현재 `oc-as`가 bind-mount하지 않습니다. 그 디렉토리로 파일을 넣거나 빼야 하면 `docker cp`로 resolved 컨테이너에 직접 옮기거나, `/home/oc/shared/`에 stage한 뒤 그 경로를 참조하세요.

산출물을 만든 뒤에는 컨테이너 경로가 아니라 **호스트 경로**(예: `.agent-memory/oc-volume/work/page.png`)를 사용자에게 안내할 것.

## 활성 인스턴스 확인

```bash
oc-list
```

`oc-browser-*` 컨테이너 전체와 docker 상태, 그리고 `/home/oc/shared/`에 바인드된 호스트 디렉토리를 한 줄씩 출력. `<name>`을 새로 잡기 전 이미 쓰이는지 확인용.

## 정리 (`oc-rm`)

`oc-rm`을 사용 — `oc-as`와 같은 naming을 받고, 세 단계(컨테이너, docker 볼륨, 선택적 호스트 디렉토리)를 한 명령으로 묶어 현재 프로젝트 범위에서 처리합니다.

```bash
oc-rm <name>                  # 확인 prompt
oc-rm -f <name>               # 확인 스킵
```

기본은 컨테이너 + docker home 볼륨(쿠키/프로파일) 삭제. 호스트측 `.agent-memory/oc-volume/<resolved>/`는 **유지** — `--rm-shared`를 줘야 같이 지웁니다. 스크린샷·다운로드는 기본적으로 살아남습니다.

이름 형식 (oc-as와 동일):

| 형식 | 매칭 |
|---|---|
| `<rest>` | 정확히 `<rest>` (plain 모드) |
| `host:<rest>` | 정확히 `host_<rest>` |
| `vnc:<port>:<rest>` | 정확히 `vnc_<port>_<rest>` |
| `vnc:<rest>` | 모든 `vnc_*_<rest>` (포트 무관) |

유용한 플래그:

- `--rm-shared` — `.agent-memory/oc-volume/<resolved>/`도 삭제.
- `--keep-volume` — docker home 볼륨 유지 (쿠키/프로파일 재사용).
- `--all` — 이 프로젝트의 모든 `oc-browser-<projTag>-*` 컨테이너 + stale 볼륨/디렉토리.
- `-f, --force` — y/N 확인 스킵.

예시:

```bash
oc-rm host:work                          # 기본: 컨테이너 + 볼륨; 공유 dir 유지
oc-rm vnc:research                       # 'research'의 모든 포트 제거
oc-rm -f --rm-shared host:demo           # host_demo 전부 nuke
oc-rm --keep-volume vnc:5901:fixed       # 다음에 쓸 쿠키 유지
oc-rm --all                              # 이 프로젝트 통째로 정리
```

매칭이 0개면 침묵하지 않고 명확한 에러로 실패 — 오타 가드.

## 봇 탐지 주의

컨테이너 안 Xvfb 위 headed Chromium입니다. `navigator.webdriver`는 true, IP는 데이터센터 대역, UA는 빌드에 따라 `HeadlessChrome` 누출 가능. 엄격한 사이트(X/Twitter, Cloudflare 게이팅, Google 로그인 등)는 자주 차단합니다 — 차단을 보고하되 재시도 루프는 돌리지 말 것.

## 사용하지 말 것

- 모델이 `WebFetch` / `curl`로 이미 처리하는 단순 HTML/JSON.
- 수백 페이지 대량 스크래이프 — 별도 스크립트.
- 브라우저가 아닌 GUI 앱.

## `oc-as`가 없을 때

`oc-as`가 `command not found`이면 즉흥적으로 설치하지 말 것. `/oc-setup`으로 라우팅하고 중단.
