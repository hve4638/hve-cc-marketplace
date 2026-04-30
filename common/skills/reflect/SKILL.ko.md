---
name: reflect
disable-model-invocation: true
argument-hint: "[선택사항: 회고 주제 슬러그 힌트]"
---

<reflect_instruction>
# reflect

세션에서 사용자가 정정한 것과 사실 오류를 추출해, 각 항목을 자식 가드레일 스킬 (`reflect-<slug>/SKILL.md`) 로 만든다. 다음 세션에서 description 매칭으로 자동 트리거되어 같은 실수를 막는다.

전제: description-matching auto-trigger 가 있는 런타임 (Claude Code, Codex CLI 등). 없는 환경에서는 자식이 단순 문서로만 남는다.

## reflect 와 자식 분리

- reflect: 명시 호출 (`disable-model-invocation: true`). 회고 사고를 수행.
- reflect-* 자식: 자동 트리거 후보. 미래 행동 지시문만 담는다 (회고 서술 금지).

회고 4슬롯 (Step 1) 은 reflect 의 내부 사고 도구. **자식 출력에 박지 않는다**.

---

## 저장 규격

- 경로: `.claude/skills/reflect-<slug>/SKILL.md` (프로젝트 로컬 강제, 사용자 글로벌 금지)
- 자식 prefix: `reflect-`
- 자식 언어: 영문 단일 (자식에 `SKILL.ko.md` 만들지 않음)
- 슬러그: kebab-case, 30자 이내, 영문, 트리거 맥락을 가장 좁게

---

## 자기 탐색 원칙

회고 항목 추출 (Step 1) 은 세션 컨텍스트만 근거로 한다. git, grep, web, 파일 재읽기 금지. 외부 정보가 필요한 항목은 회고 대상에서 제외 (추측·재해석 차단 목적).

이후 단계의 카탈로그 / 기존 자식 SKILL.md 읽기·쓰기는 기록 관리 동작이므로 본 원칙 대상 아님.

---

## 회고 카테고리

해당 없는 축은 비운다 (억지로 채우지 않음).

### 1. 사용자가 지적한 것

사용자가 명시적으로 정정·반박·재지시한 발화에서 추출.

- 예: "그게 아니라", "no, X 가 맞아", "그렇게 말고"
- Agent 의 잘못된 행동·가정에 대한 교정만. 단순 우선순위 변경·방향 전환은 제외.
- 칭찬·확인 발화는 제외.

### 2. 잘못 알려졌거나 오래된 것

세션에서 객관적으로 드러난 사실 오류.

- 존재하지 않는 함수·옵션·경로를 호출하고 오류로 확인된 것
- 도구·API·모델의 옛 동작을 가정했다가 실제 출력과 어긋난 것
- 1번이 우선. 사용자 지적이 곧 사실 오류면 1번에만 (중복 회피)

---

## 워크플로우

### Step 1. 회고 항목 추출

세션 컨텍스트를 훑어 두 카테고리 항목을 모두 꺼낸다. 내부 사고 도구로 4슬롯 사용 (자식에 박지 않음):

1. `Past action` — 이전 행동·가정 (한 줄)
2. `Signal` — 잘못이 드러난 경위 (사용자 발화 / 오류 메시지 / 출력 어긋남)
3. `Correct form` — 무엇이 옳은가
4. `Generalization` — 같은 실수가 재현될 만한 이웃 상황

### Step 2. 슬러그 결정

각 항목의 트리거 맥락을 가장 좁게 표현하는 영문 슬러그를 자동 선정.

- 좋음: `git-rebase-no-edit-flag`, `bash-find-regex-order`, `tsx-jsx-key-prop`
- 나쁨: `general-tips`, `mistakes`, `learning-20260430`

### Step 3. 병합 판정

새 항목과 카탈로그의 기존 자식이 같은 가드레일로 묶이는지 검사한다.

판정 기준: 두 항목의 `Correct form` 이 한 줄에 정확히 들어가는가.

- 한 줄에 둘 다 정확히 들어감 → 병합 후보
- 합치면 어느 쪽 정답이 흐려짐 → 분리

병합 후보면 합친 한 줄을 사용자에게 제시하고 병합 / 분리 / skip 중 하나를 질의한다. 정확히 같은 슬러그가 이미 있으면 무조건 사용자 확인 (자동 덮어쓰기 금지).

#### 판정 예

| A 의 Correct form | B 의 Correct form | 합친 한 줄 시도 | 판정 |
|---|---|---|---|
| `git rebase` 의 유효 플래그인지 확인 | `git rebase` 의 유효 플래그인지 확인 | rebase 옵션은 유효 플래그인지 확인 후 사용 | 병합 |
| `'foo' in d` 사용 | `np.float64` 사용 | deprecated 면 대안 사용 | 분리 (한 줄이 두 정답을 못 담음) |

### Step 4. 자식 SKILL.md 작성

회고 슬롯 중 `Correct form` 과 `Generalization` 만 자식으로 넘긴다. description 의 WHY 는 `Past action` / `Signal` 에서 실패 유형을 추상화해 작성한다.

골격:

```yaml
---
name: reflect-<slug>
description: "<트리거 + WHY. 룰은 박지 않음>"
---

# Rule
<해야 할 것 / 하지 말 것. 본문이 중심>

# Not a violation
<이 룰이 적용되지 않는 정상 케이스 1~2개. 비우면 통째 생략>
```

#### description 작성 규칙

- 명령형으로 쓴다 (`Use this skill when ...`, `Consult this skill to ...`). 평서문 (`This skill does X`) 금지.
- Agent 가 하려는 작업 (intent) 을 서술한다. 스킬 내용 (구현) 을 서술하지 않는다.
- 트리거 카테고리를 명시한다: `"... when the task involves {trigger A}, {trigger B}, or {trigger C}"`.
- WHY 절을 박는다: `"Consult it to avoid {invalid flag, unknown switch error, ...}"`. 회고 슬롯의 `Past action` / `Signal` 에서 추출.
- 도구명·명령어·에러 메시지 중 최소 하나 포함 (다른 스킬과의 구별).
- 100~200 words 권장, 1024 chars 이하. `<` `>` 사용 금지.
- 구체 쿼리를 길게 늘어놓지 않는다. 트리거 카테고리만.

#### description 에 쓰지 않는 것

- 대문자 `MUST` / `ALWAYS` / `NEVER` 누적 (노이즈)
- safety-net 절 (`"even when the user doesn't explicitly ask ..."`) — over-trigger 유발
- 행동 룰 자체 — body 의 존재 의미 상실

#### body 작성 규칙

session 에서 실제로 마주친 항목·메커니즘만 담는다. session 밖 일반 지식 (마주치지 않은 다른 deprecated 항목, 다른 잘못된 플래그 등) 도입 금지 — 짐작이 아닌 검증된 정정만 담는다.

메커니즘 추상화 (e.g., "호출 전 실제 존재 여부 확인") 는 session 사례의 일반화이므로 허용.

#### 예

❌ description 에 룰까지 박은 경우 (body 무의미):

```
"Use this skill when writing git rebase commands. The --no-edit flag is invalid for git rebase — omit it. Consult it to avoid an unknown switch error."
```

⭕ trigger + WHY 만 (body 가 룰을 담음):

```
"Use this skill when writing or proposing `git rebase` commands. Consult it to avoid passing an invalid flag combination that aborts the rebase with an 'unknown switch' error."
```

후자에서 "어떤 플래그가 invalid 인가" 는 body 의 Rule 섹션이 담는다.

### Step 5. 카탈로그 갱신

이 `SKILL.md` 본문 하단의 카탈로그 테이블에 행 추가 (병합이면 기존 행의 `Last updated` 갱신). 카탈로그는 인덱스만 — 룰 자체는 자식 SKILL.md 가 single source.

### Step 6. 보고 후 종료

사용자에게 짧게 보고하고 종료한다. 추가 회고를 제안하지 않는다.

- 항목 N개 → 자식 스킬 N개 (병합 M개, 신규 K개, skip L개)
- 각 자식의 슬러그와 description 한 줄

---

## 빈 회고 처리

지적도 사실 오류도 없으면 자식 스킬을 만들지 않고 그 사실을 한 줄로 보고한다. 형식 채우기만의 회고는 시스템 노이즈가 된다.

---

## 경계

- handoff (세션 작업 맥락 인계) 와 다르다 — reflect 는 handoff 로 보내지 않는다.
- MEMORY.md (사람·프로젝트 영구 지식) 와 다르다 — reflect 는 MEMORY.md 를 수정하지 않는다.
- manage-skills 류 (검증 스킬·메타 문서 관리) 와 다르다 — reflect 는 메타 문서 (CLAUDE.md 등) 를 손대지 않고 가드레일 자식 스킬만 만든다.

자식 (`reflect-*`) 은 description 매칭 자동 트리거 대상이므로 frontmatter 에 `disable-model-invocation` 을 박지 않는다.

---

## 카탈로그

reflect 가 생성한 자식 스킬 인덱스. Step 5 에서 자가 갱신. 룰 자체는 자식 SKILL.md 가 single source — 카탈로그는 빠른 룩업용 인덱스만.

`Scope key` = 자식이 트리거되는 도구·명령·API 이름.

| Slug | Scope key | Last updated |
|------|-----------|--------------|

(아직 생성된 reflect-* 가 없습니다)

<!-- 자식이 추가되면 위 테이블에 행 추가:
| `reflect-git-rebase-flag-validation` | `git rebase` flags | 2026-04-30 |
-->
</reflect_instruction>

$ARGUMENTS
