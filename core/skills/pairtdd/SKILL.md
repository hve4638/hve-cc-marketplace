---
name: pairtdd
description: Use this skill when the user invokes `/pairtdd <task>` to start a GAN-style adversarial pair-TDD session under `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, where `tdd-adversary` writes failing tests and `tdd-implementer` makes them pass inside an isolated git worktree. Consult it to avoid contaminating the main working copy with experimental rounds, to refuse the run if the env var is unset, and to keep the spec under gitignored `.agent-memory/tdd-spec/` so it stays out of git history.
disable-model-invocation: true
argument-hint: "[수행할 task 설명]"
---

<pairtdd_instruction>

## Step 1: 스펙 확보

### 1.1 slug 도출

사용자가 제공한 task 와 현재 대화 맥락을 종합해 짧은 이름(`[a-zA-Z0-9_-]`)을 도출한다. 현재 시각을 `YYYYMMDD-HHMM` 포맷으로 prefix 해 slug 를 구성한다. 예: 이름이 `pricing-rules` 면 slug 는 `20260509-1234-pricing-rules`. 사용자 확인을 받지 않고 그대로 진행한다.

### 1.2 스펙 작성

현재 대화에 TDD 대상에 관한 충분한 컨텍스트(요구사항·도메인·입출력 형태)가 있는지 자체 판단한다.

- 충분 → 그 컨텍스트를 정리해 스펙 초안을 작성하고 사용자 검토·수정을 받는다. 인터뷰 생략.
- 부족 → 핵심 질문 3-5개로 짧게 인터뷰하고 답변을 정리해 스펙을 작성한다.

확정본을 `.agent-memory/tdd-spec/<slug>.md` 에 저장한다 (디렉토리 없으면 생성). 형식은 자연어 + 입출력 예시 + 경계 조건.

## Step 2: 워크트리 부트스트랩

`scripts/bootstrap.sh <slug>` 를 실행한다. 성공 시 stdout 으로 워크트리 절대경로가 반환된다. 실패 메시지(env 미설정, git 저장소 아님, 스펙 파일 부재 등)를 사용자에게 전달하고 중단한다.

이어서 `git -C <worktree> rev-parse HEAD` 로 시작 커밋 SHA 를 얻는다.

## Step 3: 팀 생성

자연어로 다음을 수행한다: `Create a team in <worktree path> with two members: tdd-adversary and tdd-implementer.` 멤버는 `core/agents/tdd-adversary.md` 와 `core/agents/tdd-implementer.md` 의 정의를 그대로 사용한다.

## Step 4: 첫 신호 송신

adversary 에게 다음 한 줄을 정확히 보낸다:

```
bootstrap: spec=<abs spec path> worktree=<wt path> base-sha=<start sha> — produce first red
```

abs spec path 는 메인 저장소의 `.agent-memory/tdd-spec/<slug>.md` 의 절대경로. base-sha 는 Step 2 의 시작 커밋 SHA.

## Step 5: 라운드 대기

다음 신호 중 하나가 올 때까지 대기한다:
- adversary 의 `converged: <reason>`
- 멤버 어느 쪽의 `escalation: <issue>` 또는 `blocker: <issue>`
- 사용자의 중단 신호

## Step 6: 종료 처리

수렴 또는 사용자 중단 시:
- `git -C <worktree> log --oneline` 출력으로 라운드 요약을 보여준다.
- 워크트리 경로를 안내한다.
- 머지/폐기 결정을 사용자에게 위임한다. 워크트리를 자동 삭제하지 않는다.

escalation 시: 메시지를 사용자에게 그대로 전달하고 결정을 기다린다.

## 가드레일

- 모든 작업을 워크트리 안에서만 수행한다.
- 스펙 파일은 메인 저장소의 `.agent-memory/tdd-spec/<slug>.md` 에 위치한다 (gitignored 가정으로 히스토리 미오염).
- 멤버 간 메시지에 leader 가 끼어들지 않는다. escalation 메시지만 사용자에게 중계한다.
- 사용자가 명시적으로 머지하지 않는 한 워크트리를 폐기하지 않는다.

</pairtdd_instruction>

Task: $ARGUMENTS
