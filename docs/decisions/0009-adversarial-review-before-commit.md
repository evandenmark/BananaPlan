# 0009. Every non-trivial change gets an adversarial review before it is committed

- **Status:** Accepted
- **Date:** 2026-07-28
- **Affects:** `.claude/agents/adversarial-reviewer.md`, the `ship` skill, how agents work here

## Context

One person and a set of agents write all the code, and there is no second human
to catch mistakes. The usual safety nets are absent by design: no staging
environment, no PR review, and a push to `main` deploys to production
immediately.

An agent reviewing its own work is close to worthless. It has already decided
the change is correct — that is why it stopped writing — and re-reading with the
same context mostly reproduces the same reasoning and the same blind spots. What
catches defects is a reader who did not write the code, does not know what the
author intended, and is looking for problems rather than confirming absence.

The `revalidatePath` gaps found on 2026-07-28 are the illustration: seven actions
revalidated nothing, sitting in `main` for months. Nothing about the code looked
wrong. Finding them took reading the pages to see which tables each one displays,
which is exactly the work an author skips because they already "know" it.

## Decision

Before committing any non-trivial change, the agent making it spawns the
`adversarial-reviewer` subagent against the diff, responds to every finding, and
fixes the ones that are real.

- The reviewer is defined in
  [`.claude/agents/adversarial-reviewer.md`](../../.claude/agents/adversarial-reviewer.md),
  committed so every agent and every session uses the same brief. It is briefed
  on this codebase's actual failure modes, and on the constitution and ADRs, so
  it does not report deliberate decisions as bugs.
- It is instructed to **report nothing rather than pad**. A review that finds
  nothing is a valid, useful outcome; a list of nitpicks trains the author to
  skim, which is how a real defect gets waved through later.
- The author must **respond to every finding in its user-visible output**, saying
  what it fixed and what it rejected and why. A finding silently dropped is
  indistinguishable from one that was never read.
- **Non-trivial** means: touches `src/`, changes behavior, or changes
  infrastructure. Typo fixes, documentation edits, and comment changes do not
  need it. When in doubt, review.

The review is a step in the [`ship`](../../.claude/skills/ship/SKILL.md) skill's
pre-flight, alongside tests, typecheck, and build.

## Consequences

- Defects get one look from something with no stake in the change being correct.
- The reviewer's brief is a written, improvable record of what actually goes
  wrong in this codebase. When a new class of bug shows up, it gets added there
  and every future review inherits it.
- **Cost:** every commit is slower and uses more tokens. Accepted deliberately —
  the alternative safety nets do not exist here.
- **Cost:** this is a convention, not enforcement. Nothing prevents an agent from
  committing without a review; it is written in `CLAUDE.md` and the `ship` skill
  and depends on those being followed.
- **Cost:** an adversarial reviewer that finds nothing on a genuinely broken
  change gives false confidence. It reduces the odds of a defect; it does not
  replace running the app.

## Alternatives considered

- **Self-review by the authoring agent** — cheapest, and mostly reproduces the
  author's blind spots. This is the status quo that let the revalidation gaps
  sit in `main`.
- **A GitHub Action running Claude on each PR** — genuinely better in one way:
  it cannot be skipped, and it reviews the change as pushed rather than as the
  author describes it. Declined on 2026-07-28 because it bills per review against
  an API account and would require adopting a PR workflow, where today a push to
  `main` deploys. Revisit if commits start bypassing review.
- **`/code-review ultra`** — the multi-agent cloud review is stronger than a
  single subagent, but it is user-triggered and billed, so it cannot be part of
  an agent's automatic flow. Use it by hand on changes that warrant it; the
  subagent covers the routine case.
- **Require a human review** — there is one person, and this is a side project
  for a farm. It would not happen, and a process nobody follows is worse than an
  imperfect one that runs.
