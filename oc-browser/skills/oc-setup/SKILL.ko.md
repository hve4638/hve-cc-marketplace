---
name: oc-setup
description: oc-browser 플러그인의 1회성 글로벌 설치. Docker 설치/구동 가능 여부를 검증하고, `openclaw-browser:local` Docker 이미지를 빌드하고, `oc-as`/`oc-list`/`oc-rm`/`oc`를 PATH에 올립니다. 프로젝트별 상태(`.agent-memory/oc-volume/`)는 여기서 만들지 않고 나중에 `oc-as`가 첫 호출 시 lazy하게 생성. 사용자가 명시적으로 oc-browser를 setup/install/configure/initialize 해달라고 한 경우, /oc-setup이 호출된 경우, 또는 `oc-as` 스킬이 `oc-as` 부재를 감지한 경우에만 사용.
---

# oc-setup

멱등 **1회성 글로벌 설치**: Docker 점검 → 이미지 빌드 → `oc-as`·`oc-list`·`oc-rm`·`oc` PATH symlink.

프로젝트 볼륨은 만들지 않습니다. `.agent-memory/oc-volume/`은 `oc-as`가 첫 호출 시 lazy하게 생성합니다.

이 스킬이 실행되면 **아래 워크플로를 직접 실행**하세요. 단순 요약만 하지 말 것.

## Phase 1 — 사전 점검

### 1a. Docker 설치 여부

```bash
docker --version
```

실패(`command not found`)면 STOP, 사용자에게:

```
Docker가 설치되어 있지 않습니다. Ubuntu에서 설치 방법:

    sudo apt-get update && sudo apt-get install -y docker.io
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"

이후 로그아웃/재로그인 후 /oc-setup을 다시 실행하세요.
```

Docker는 **직접 설치하지 말 것.**

### 1b. 현 사용자가 Docker 데몬에 접근 가능?

```bash
docker info >/dev/null 2>&1
```

실패하면 원인별:

- `permission denied ... docker.sock` → `sudo usermod -aG docker "$USER"` 후 재로그인. STOP.
- `Cannot connect to the Docker daemon` → `sudo systemctl start docker`. STOP.
- 그 외 → stderr를 그대로 보여주고 STOP.

## Phase 2 — install 스크립트 실행

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh"
```

이 스크립트(멱등):

1. `oc-as`, `oc-list`, `oc-rm`, `oc`, `entrypoint.sh`, `install.sh`에 `chmod +x`.
2. PATH상의 install dir 선택 (`~/.local/bin` 우선).
3. 플러그인의 `scripts/`에서 `openclaw-browser:local` 이미지 빌드.
4. `oc-as`, `oc-list`, `oc-rm`, `oc`를 install dir에 symlink.
5. install dir이 PATH에 없으면 경고.

빌드가 실패하면 stderr를 사용자에게 보여주고 멈출 것. 자동 재시도 X.

## Phase 3 — Smoke 테스트

```bash
oc-as --help
oc-list
```

`oc-as`가 `command not found`이면 PATH 미반영 상태. 새 터미널을 열거나 `export PATH="<install-dir>:$PATH"`를 안내한 뒤 재실행.

`oc-list`는 갓 설치한 상태라면 `(no oc-browser-* containers)`를 출력해야 정상.

선택적 end-to-end 확인 (일회성 디렉토리에서 `.agent-memory/oc-volume/smoke/` 생성):

```bash
mkdir -p /tmp/oc-smoke && cd /tmp/oc-smoke
oc-as smoke browser doctor
oc-list                           # oc-browser-oc-smoke-smoke 한 줄 보여야 함
```

성공하면 정리:

```bash
oc-rm -f --rm-shared smoke
```

`oc-as smoke browser doctor`가 실패하면 에러를 보여주고 STOP. 흔한 원인:

- 이미지 빌드는 성공했지만 user namespace가 좁아 Chromium이 못 뜸 → unprivileged user namespace 활성화, 또는 `cap-drop` 완화 (고급).
- 빌드 중 `npm i -g openclaw@latest`가 실패 → `docker rmi openclaw-browser:local` 후 install.sh 재실행.

## Phase 4 — 결과 보고

smoke 통과 후 사용자에게:

- ✓ 이미지: `openclaw-browser:local` (`docker image ls`로 사이즈 확인)
- ✓ CLI: `<install-dir>/oc-as`, `<install-dir>/oc-list`, `<install-dir>/oc-rm`, `<install-dir>/oc` (마지막 `oc`는 이미 격리된 환경 안에서만 사용)
- 프로젝트별 상태는 `<project>/.agent-memory/oc-volume/<name>/`에 위치, `oc-as <name> ...` 첫 호출 시 자동 생성.
- `.agent-memory/`를 `.gitignore`에 추가 권장.
- 예시: `cd <your-project> && oc-as host:work browser open https://example.com --label demo` (호스트 X) / `oc-as vnc:work browser ...` (VNC) / `oc-as work browser ...` (헤드리스).
- 정리 패턴: `oc-list`로 활성 확인 → `oc-rm <name>`으로 제거 (컨테이너 + docker 볼륨 삭제, 필요 시 `--rm-shared`로 호스트 파일도 삭제, `--keep-volume`으로 쿠키/프로파일 보존, `--all`로 프로젝트 전체 일괄 삭제).

권한 prompt 줄이려면 `~/.claude/settings.json` permissions에 `Bash(oc-as *)`, `Bash(oc-list)`, `Bash(oc-rm *)` 추가를 **제안만** (자동 X).

## 재실행

멱등합니다. 다시 실행하면:

- Docker 설치 단계 건너뜀.
- 이미지 입력 변경 시에만 재빌드 (Docker 레이어 캐시).
- symlink 재생성 (`ln -sf`).
- 기존 `oc-browser-*` 컨테이너·볼륨은 그대로.

완전 초기화:

```bash
# 모든 oc-browser-* 컨테이너 + 홈 볼륨 제거
docker ps -a --filter name=oc-browser- -q | xargs -r docker rm -f
docker volume ls --filter name=oc-browser-home- -q | xargs -r docker volume rm
docker rmi openclaw-browser:local 2>/dev/null
# 프로젝트별 공유 디렉토리:
#   rm -rf <project>/.agent-memory/oc-volume   (oc-as를 쓴 프로젝트 각각에서)
```

후 `/oc-setup` 재호출.
