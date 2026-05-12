# init-context 통합 설계 (인터뷰 기반)

## 개요

`/init-context` 단일 진입. 내부 모드 (Global / Project) 와 인터뷰 흐름 (플러그인 / rule / lang) 을 하나의 스킬로 통합. 산출물:

- **Global** → `~/.claude/CLAUDE.md` 의 마커 블록 (HVE 자동 생성 영역)
- **Project** → `<cwd>/CLAUDE.md` (전체 파일)

## 모드 결정

```
cwd === $HOME ?
  YES → Global 모드 (질문 없이 진입)
  NO  → AskUserQuestion 으로 사용자에게 선택
```

`cwd === os.homedir()` 정확 일치만 자동 진입. 그 외 (예: `~/projects/foo`) 는 항상 질문.

## 인터뷰 흐름

```
[Stage 1] 모드 결정 (자동 또는 AskUserQuestion)

[Stage 2] 플러그인 검출 + 인터뷰 (multiSelect)
  - 활성 플러그인 자동 검출
  - docs/AGENTS.partial.md 가 있는 것만 후보
  - 사용자가 어느 것을 합성에 포함할지 선택

[Stage 3] rule 인터뷰 (multiSelect)
  - rule-* fragment 전체 표시 (condition 무시)
  - 사용자 선별

[Stage 4] lang 인터뷰 (모드별)
  - Global:
      AskUserQuestion (단일):
        ├─ 적용 안 함  ← 권고: 각 프로젝트에 따로 두는 것을 추천
        └─ Global CLAUDE.md 에 추가 → 전체 lang-* multiSelect

  - Project:
      코드베이스 확장자 가볍게 탐색 (스크립트)
      → 발견된 언어 보고
      AskUserQuestion (단일):
        ├─ 발견된 언어의 규칙 추가
        ├─ 추가 안 함
        └─ 직접 선택 → 전체 lang-* multiSelect

[Stage 5] 합성 + 충돌 검사 + 산출
```

## 활성 플러그인 검출

| 모드 | 활성 출처 | installed_plugins.json 매칭 |
|---|---|---|
| Global | `~/.claude/settings.json` + `settings.local.json` 의 `enabledPlugins` 머지 | `scope === "user"` |
| Project | `<cwd>/.claude/settings.json` + `settings.local.json` 머지 | `scope === "project" || "local"` AND `projectPath === <cwd>` |

- `<cwd>` 는 `process.cwd()` 직접 (`.claude/` 존재 신뢰 안 함, 없으면 빈 enabledPlugins)
- 매칭된 레코드의 `installPath` → `<installPath>/docs/AGENTS.partial.md` 읽기

## 마스터 골격 (skeleton)

위치: **`common/skills/init-context/AGENTS.skeleton.md`** (스킬 소유, 특정 플러그인과 분리)

명명 규약: 마스터는 `.skeleton`, 플러그인 기여는 `.template` 로 구분 (혼동 방지).

태그 셋 (OMC 따라감, 13개):

```
operating_principles
delegation_rules
model_routing
agent_catalog
tools
skills
team_pipeline
verification
execution_protocols
commit_protocol
hooks_and_context
cancellation
worktree_paths
```

마스터는 태그 순서·자리만 정의. 컨텐츠는 각 플러그인의 `docs/AGENTS.partial.md` 가 제공.

## Same-tag 합성

- 각 활성 플러그인의 `docs/AGENTS.partial.md` 가 자기 컨텐츠를 XML 태그로 표현
- 마스터 태그 순서대로 출력
- 같은 태그에 여러 플러그인이 기여하면 한 섹션에 모음
- **태그 내 컨텐츠 순서는 합성 에이전트 (Claude 자신) 의 재량** — 논리적 묶음·중요도로 결정
- **빈 태그**: 기여 컨텐츠 없는 태그는 placeholder 주석으로 자리 유지

```
<!-- <skills></skills> -->
```

→ 다음 갱신에서 컨텐츠 들어오면 주석 제거하고 같은 자리에 정상 태그로 교체.

## 합성 수행 주체

스킬 호출된 **Claude 자신** 이 합성 에이전트. SKILL.md 가 Claude 에게 합성 절차를 지시 → Claude 가 마스터 템플릿 + 플러그인 template + 인터뷰 선택을 종합해 본문 직접 작성. sub-agent 위임 없음.

## 산출물 구조 (Global 모드)

```
<!-- HVE:START -->
<!-- HVE:VERSION:1 -->
<!-- HVE:GENERATED-AT:2026-05-02T12:34:56Z -->
<!-- HVE:PLUGINS: common, frame -->
<!-- HVE:HASH: sha256-abc123... -->

# hve marketplace

<operating_principles>
...
</operating_principles>

<delegation_rules>
...
</delegation_rules>

<!-- <model_routing></model_routing> -->

... (이하 마스터 태그 순서대로) ...

# Rules

(rule-* 본문)

# Languages

(lang-* 본문)

<!-- HVE:END -->
```

**섹션 순서**: 플러그인 (XML 태그 영역) → rule → lang.

HTML 주석은 Claude Code 가 컨텍스트에서 strip → 토큰 부담 없음 → 메타 정보 (생성일, 기여 플러그인, 해시, drop된 태그 자리표시) 적극 활용.

## 산출물 구조 (Project 모드)

전체 `CLAUDE.md` 파일 자체를 합성 (HVE 마커 블록 안 씀). 구조는 동일하나 `<cwd>/CLAUDE.md` 가 통째로 산출물.

## 블록 위치 정책 (Global 모드)

- **마커 없음** (최초 또는 사용자가 지움) → 파일 **최상단 prepend**
- **마커 있음** (갱신) → **마커 위치 보존**, 그 안만 교체
- 마커 바깥 컨텐츠는 위·아래 어디든 보존

## 멱등성 — 해시 비교

`<!-- HVE:HASH:sha256-... -->` 메타 마커.

해시 입력 (정규화된 직렬화):
- 활성 플러그인 목록 (이름·설치 경로)
- 각 플러그인 `docs/AGENTS.partial.md` 본문
- 인터뷰 선택 (선택된 플러그인, rule, lang fragment)

알고리즘:
- 합성 전 입력 해시 계산
- 기존 `~/.claude/CLAUDE.md` 의 마커 블록에서 `HVE:HASH` 추출
- 일치 → write skip ("no changes")
- 불일치 → 합성·교체 + HASH·GENERATED-AT 갱신 + diff 출력

→ 같은 입력 + 같은 인터뷰 선택 = 같은 해시 = 멱등

## 규율 분류 정책 — fragment vs partial

| 종류 | 위치 | 적용 |
|---|---|---|
| **메소드 규율** (TDD, Karpathy 등) | `init-context/fragments/rule-*.md` | 인터뷰 opt-in (사용자가 매번 선택) |
| **플러그인-특화 규율** (inlay 등) | `<plugin>/docs/AGENTS.partial.md` 의 `<operating_principles>` 등 | 플러그인 활성 시 자동 주입 (인터뷰 없음) |

판정 기준: **사용자가 끄고 싶을 수 있는가?**
- Yes (메소드 선택지) → fragments 인터뷰
- No (플러그인 사용 시 무조건) → partial 자동

예: rule-inlay 는 inlay 플러그인이 활성이라면 무조건 적용해야 의미 있음 → partial. rule-tdd 는 프로젝트마다 적용 결정 → fragment.

## 충돌 검사 (정책 충돌만)

legacy 의 광범위 검사 (톤 충돌, 내용 중복) 폐기. **정책 충돌만**:

- fragment frontmatter 에 `conflicts_with: [<fragment-name>, ...]` 추가
- 선택된 fragment 들 사이 매칭 시 AskUserQuestion 으로 1회 묻기
- 사용자 결정 후 진행 (자동 결정 금지)

예시: 가상의 `rule-fast` (테스트 없이 빠르게) + `rule-tdd` (테스트 우선) → 충돌 정의.

## 백업 정책

- Global 모드: 기존 `~/.claude/CLAUDE.md` 가 있으면 합성 전에 `~/.claude/CLAUDE.md.bak` 으로 이동
- Project 모드: 동일하게 `<cwd>/CLAUDE.md.bak`
- 기존 `.bak` 이 이미 있으면 사용자에게 처리 방법 질문 (덮어쓰기 / 다른 이름 / 중단)

## 원본 검수 도구

Claude Code 와 Read 도구는 HTML 주석을 strip → 마커·메타가 안 보임. 사람·에이전트가 원본 마커를 확인할 때:

```
cat ~/.claude/CLAUDE.md
```

Bash `cat` 사용. SKILL.md 본문에 명시. Node 스크립트는 `fs.readFile` 직접 사용 → 영향 없음.

## 결정사항 요약

| 항목 | 결정 |
|---|---|
| 위치 | `common/skills/init-context/` (make-context 흡수) |
| 호출 | `/init-context` (인자 없음) |
| 모드 결정 | `cwd === $HOME` → 자동 Global, 그 외 → AskUserQuestion |
| 마스터 골격 | `common/skills/init-context/AGENTS.skeleton.md` (스킬 소유) |
| 마스터 태그 셋 | OMC 13개 따라감 |
| 빈 태그 | placeholder 주석 (`<!-- <tag></tag> -->`), 자리 보존 |
| 산출물 순서 | 플러그인 (XML 영역) → rule → lang |
| rule 인터뷰 | multiSelect 전체 표시 (condition 무시) |
| lang 인터뷰 (Global) | 적용 안 함 / 추가 → multiSelect |
| lang 인터뷰 (Project) | 코드베이스 탐색 → 적용 / 안 함 / 직접 선택 |
| 플러그인 인터뷰 | 활성 검출 후 multiSelect 선별 |
| 활성 출처 | `settings.json` + `settings.local.json` 머지 |
| 활성 검출 | Global: `scope:user` / Project: `scope:project|local` + `projectPath===cwd` |
| project root | `cwd` 직접 (`.claude/` 신뢰 안 함) |
| 마커 | `<!-- HVE:START -->` / `<!-- HVE:END -->` |
| 메타 마커 | VERSION + GENERATED-AT + PLUGINS + HASH (sha256) |
| block 위치 | 최초 → 최상단 prepend / 이후 → 마커 위치 보존 |
| 멱등성 | HASH 비교 (입력 = 활성 플러그인 + template 본문 + 인터뷰 선택) |
| 합성 주체 | Claude 자신 (sub-agent 위임 없음) |
| 태그 내 정렬 | Claude 재량 (논리적 묶음·중요도) |
| 충돌 검사 | 정책 충돌만 (`conflicts_with` frontmatter) |
| 백업 | `CLAUDE.md.bak` (기존 있으면 사용자 질문) |
| 원본 검수 | Bash `cat` (Read 는 HTML 주석 strip) |

## 파일 구조 (목표)

```
common/skills/init-context/
├── REPORT.md                     # 본 문서
├── SKILL.md                      # 신규 (영문, 한국어 확정 후 번역)
├── SKILL.ko.md                   # 신규 (한국어, 작업 중심)
├── SKILL.legacy.md               # 기존 (참고)
├── SKILL.ko.legacy.md            # 기존 (참고)
├── README.md                     # 갱신 (두 모드 설계 의도)
├── AGENTS.skeleton.md            # 신규 (마스터 골격, 13개 태그)
├── fragments/                    # (기존 — Project / Global lang·rule 공용)
│   ├── lang-*.md
│   └── rule-*.md
├── fragments-ko/                 # (기존)
└── scripts/
    ├── detect-active-plugins.mjs # 신규 (활성 플러그인 + installPath JSON 출력)
    └── detect-languages.mjs      # 신규 (Project 모드 lang 탐색)
```

기여 plugin 측:

```
<plugin>/docs/AGENTS.partial.md  # 신규 — XML 태그로 자기 컨텐츠
```

대상: common, frame (즉시), oc-browser, wiki (선택, 추후).

## 영향 범위 (수정·추가·삭제)

| 항목 | 작업 |
|---|---|
| `common/skills/init-context/SKILL.md` | 신규 (Stage 1~5 통합 흐름) |
| `common/skills/init-context/SKILL.ko.md` | 신규 (한국어) |
| `common/skills/init-context/README.md` | 갱신 (두 모드 설계 의도, fragment + plugin template 규약) |
| `common/skills/init-context/AGENTS.skeleton.md` | 신규 (마스터 골격) |
| `common/skills/init-context/scripts/detect-active-plugins.mjs` | 신규 |
| `common/skills/init-context/scripts/detect-languages.mjs` | 신규 |
| `common/docs/AGENTS.partial.md` | 신규 (common 의 skill triggers) |
| `frame/docs/AGENTS.partial.md` | 신규 (agent_catalog 등) |
| (선택) `oc-browser/docs/AGENTS.partial.md` | 추후 |
| (선택) `wiki/docs/AGENTS.partial.md` | 추후 |
| 기존 `SKILL.legacy.md` / `SKILL.ko.legacy.md` | 보존 (참고용) |

## 멱등성 — 추가 시나리오

- **인터뷰 결과 재현**: 다음 호출 시 사용자가 같은 답변 선택 + 활성 플러그인 동일 → 해시 동일 → write skip
- **인터뷰 결과 다름**: 사용자가 다른 답변 → 해시 다름 → 재합성 (산출물 본문이 변경 → 다음 회차에 영구 반영)
- **인터뷰 결과 영속화 안 함**: 별도 history 파일·메모리 저장 없음. 산출물 자체가 곧 결과 보존.

## 위험 / 주의점

- 사용자가 마커 안에 직접 추가한 텍스트는 다음 실행 시 덮어씀 → README 경고 + 마커 안 본문 첫 줄에 경고 주석
- `settings.json` / `installed_plugins.json` 포맷이 Claude Code 버전 따라 바뀔 가능성 → 파서 방어적 (필드 누락 시 graceful skip)
- HTML 주석 strip 동작이 Claude Code 버전 따라 다를 가능성 → 마커 구조 단순 유지
- XML 태그 파싱 — 단순 마크다운 가정. 정규식 처리. nested·속성·CDATA 미지원을 컨벤션으로 명시
- 태그 내 정렬을 Claude 재량에 맡기므로 같은 입력에서 출력이 미세하게 다를 수 있음. 그러나 멱등성 판정은 **입력 해시 기준** 이므로 write skip 동작에는 영향 없음
- `cwd === $HOME` 자동 Global 진입 — 사용자가 의도치 않게 home 에서 호출 시 우회 불가. 필요하면 향후 `--mode=project` 강제 인자 도입 검토

## 컨텐츠 초안 (참고용)

```markdown
<!-- HVE:START -->
<!-- HVE:VERSION:1 -->
<!-- HVE:GENERATED-AT:2026-05-02T12:34:56Z -->
<!-- HVE:PLUGINS: common, frame -->
<!-- HVE:HASH:sha256-abc123... -->

# hve marketplace

<operating_principles>
...
</operating_principles>

<delegation_rules>
Delegate for: multi-file changes, refactors, debugging, reviews, planning, verification.
Work directly for: trivial ops, single commands, small clarifications.
Route code to `executor` (model=opus for complex work).
Uncertain SDK usage → `document-specialist`.
</delegation_rules>

<!-- <model_routing></model_routing> -->

<agent_catalog>
frame agents (19): explore (haiku), analyst (opus), planner (opus), ...
</agent_catalog>

<!-- <tools></tools> -->

<skills>
- "reflect" / 회고 → common:reflect
- "skillify-guide" / 스킬 만들기 → common:skillify-guide
...
</skills>

<!-- <team_pipeline></team_pipeline> -->

<verification>
Verify before claiming completion. Use `verifier` agent for non-trivial changes.
</verification>

<execution_protocols>
2+ independent tasks in parallel. `run_in_background` for builds/tests.
</execution_protocols>

<!-- <commit_protocol></commit_protocol> -->
<!-- <hooks_and_context></hooks_and_context> -->
<!-- <cancellation></cancellation> -->
<!-- <worktree_paths></worktree_paths> -->

# Rules

## TDD
- ...

## Karpathy
- ...

# Languages

## Python
- uv only ...

<!-- HVE:END -->
```

## 다음 단계 (구현 로드맵)

명시 요청 시 구현:

1. `common/skills/init-context/AGENTS.skeleton.md` 작성 (마스터 13 태그)
2. `frame/docs/AGENTS.partial.md` 작성 (agent_catalog 등)
3. `common/docs/AGENTS.partial.md` 작성 (skill triggers)
4. `common/skills/init-context/scripts/detect-active-plugins.mjs` 작성
5. `common/skills/init-context/scripts/detect-languages.mjs` 작성
6. `common/skills/init-context/SKILL.ko.md` 작성 (Stage 1~5 통합 흐름, 한국어)
7. `common/skills/init-context/SKILL.md` 작성 (한국어 확정 후 영문 번역)
8. `common/skills/init-context/README.md` 갱신 (두 모드 설계 의도)
9. 검증 — Global/Project 분기, 멱등 재실행, plugin enable/disable, 마커 보존, 백업 처리
