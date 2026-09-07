# Agentic Coding Protocols
### A Universal Standard for AI-Assisted Development

**Status:** Living reference — update when a new incident teaches something new
**Version:** 1.0
**Scope:** Applies to every project this document travels to. It is
project-agnostic by design. Project-specific conventions (table ownership,
naming rules, HTTP compatibility requirements) live in a companion
`CLAUDE.md` or `AGENTS.md` in the repository root. This document covers
the *process* of making changes safely — the layer those files only
partially address.
**Audience:** Any agent making changes — human or AI, junior or senior.
The protocols are not suggestions. They exist because someone, somewhere,
paid the cost of not having them.

---

## Why this document exists

Every incident documented below was caught by a protocol already in place.
None were caught by being careful in the moment. All were caught by a
structural check that did not depend on memory, confidence, or good
intentions.

That is the actual goal: **protocols that catch mistakes even when the
agent applying them is certain it has none to catch.**

If you are reading this because something went wrong, look for the protocol
that would have prevented it and add it here. The document grows from
reality, not from theory.

---

## 0. The three questions before any task

Before writing a single line of code or running a single command, answer
these three questions. If you cannot answer them confidently, stop and find
out before proceeding.

**1. What is the actual current state?**
Not what the README says. Not what the task list says. What does the code
and the running system actually say right now? (See §1.)

**2. What is the blast radius of this change?**
Which files, tables, endpoints, and downstream consumers does this touch?
A change with a large blast radius needs more verification, not less. (See §5.)

**3. What does done look like?**
What is the acceptance criterion — not "it should work" but "these specific
tests pass and these specific outputs are observed"? If you cannot state it
before starting, you cannot claim it when finishing. (See §5.)

---

## 1. Source-of-truth hierarchy

Documentation drifts. Code does not lie. When they disagree, resolve in
this order — from most to least authoritative:

1. **The running system** — what the deployed service actually does.
2. **Passing tests** — what the code provably does under controlled conditions.
3. **The code itself** — what the code says it does.
4. **Approved design proposals** — what was agreed should be done.
5. **Status documents, READMEs, task boards** — what someone believed was
   true when they last updated them.

**Status documents lag behind reality by design.** A checkbox, a README
table cell, a Notion row — these are records of intent and snapshots of
past belief. Before treating any status claim as true, cross-check it
against the actual code.

> **Incident (KiliPicks, 2026):** The app's own STATUS.md correctly described
> twelve commits of shipped mobile work — video splash, auth boundary,
> category grid, Sentry integration. A senior review that read only the
> original PRD would have produced a plan to implement work already done.
> The STATUS.md was the reliable source; the PRD was the origin document.
> Both are true; only one is current.

> **Incident (prior project):** A README row read "BASE-03: assigned, plan
> pending." The actual code — 31 source files, 16 test files, 400+ passing
> cases, registered in the central router — showed BASE-03 complete for
> over a week. Acting on the README alone would have produced a plan to
> implement already-shipped work.

**Protocol:** Before planning any non-trivial task, verify the target's
actual state by reading the code and running the tests — not by reading
the first status document you find.

---

## 2. Verification before commitment

**Never commit code whose correctness you have not personally watched pass.**

"It should work" and "I ran it and it passed" are different claims. Only
make the second one. This applies to humans as much as to AI agents.

### 2.1 The verification ladder

Run in this order. Stop at the first failure and diagnose before proceeding.

1. **Syntax check** — fast, catches the obvious before spending time on
   anything else. In Node.js: `node --check`. In Python: `python -m
   compileall`. In TypeScript: `tsc --noEmit`.
2. **The narrowest test that exercises the changed behaviour** — not the
   full suite. For a concurrency fix, a concurrency test. For a schema
   change, a migration test. For an API endpoint, an integration test
   against that specific endpoint.
3. **The focused test suite for the affected module.**
4. **The full suite** — only after 1–3 pass, and only if the blast radius
   of the change reaches beyond the module you touched.

### 2.2 A passing test run can still be lying

A green result is not proof of correctness. It is proof that the code did
not fail under the specific conditions the test created. Two conditions
that produce false green:

**Stale environment:** A branch significantly behind its remote will pass
tests against code that other tests depend on — code that no longer exists
on the remote. Before trusting a test result, confirm the branch is
current.

**External interference:** Real-database tests share a server with
everything else running on that machine. A forgotten process from an
earlier session can delete seed data mid-run and produce failures that look
like code bugs.

> **Incident:** A concurrency test failed with a MySQL deadlock and a
> "customer does not exist" error for a customer used successfully thirteen
> times in the same run. Both symptoms pointed to external interference.
> `Get-Process` revealed a test runner from hours earlier still alive,
> deleting rows a concurrent test still needed. Killing it and re-running
> produced clean results. The code was fine; the environment was not.

**Protocol:** When a test fails in a way that does not match the code you
just changed, check for external interference before concluding the code
is broken. When a test passes in a way that surprises you, confirm the
environment was clean before concluding the code is correct.

### 2.3 Sequential tests do not prove concurrency correctness

A test that calls the same function twice in sequence proves the logic is
correct when there is no race. It says nothing about what happens when two
real connections contend for the same resource simultaneously.

> **Incident:** A test asserted "calling register() twice with the same
> idempotency key produces one row" and passed — because each call
> completed before the next started. A real concurrency test with two
> independent connections immediately surfaced a bug: under MySQL
> REPEATABLE READ, a losing transaction's retry-query can see a stale
> snapshot taken before the winner committed. The fix only became obvious
> once a real race reproduced the failure.

**Protocol:** For any code whose correctness depends on locking, ordering,
or isolation level, write a test that opens genuinely independent
connections and races them. A sequential test for a concurrent problem is
not a test — it is a false reassurance.

---

## 3. Database discipline

### 3.1 Use the real database, not a mock

SQLite in tests and mock database clients both hide bugs that only appear
against the real database engine. Isolation level semantics, constraint
enforcement, index behaviour, and transaction handling all differ between
engines in ways that matter.

**Protocol:** Tests run against the same database engine as production.
If production is MySQL, tests use MySQL. If production is PostgreSQL,
tests use PostgreSQL. An SQLite-backed test suite for a MySQL production
system is not a test suite — it is a simulation.

### 3.2 Test isolation without database isolation

When multiple test sessions share a single database server, isolate by
data range, not by database. Each test module owns an exclusive ID range,
seeds only inside it, and cleans up at the start (in case a prior run was
interrupted) and at the end.

**Full-table assertions are forbidden** — `SELECT COUNT(*) FROM x` in a
shared-server environment will fail when another test's rows are present.
Assert only within the ID range your test owns.

### 3.3 Unique-key additions require a pre-check

Before adding a `UNIQUE KEY` or unique index to a table that may already
hold data, run the duplicate-check query first:

```sql
SELECT <key_columns>, COUNT(*) as n
FROM <table>
GROUP BY <key_columns>
HAVING n > 1;
```

Only proceed if the result is empty. Never assume "probably fine."

> **Incident:** A unique key had been deferred for weeks because the policy
> was "run the dedup check first." Running it took one query, returned zero
> duplicates, and the key went in cleanly. The deferred work and the actual
> work were the same amount of effort — one had safety, one did not.

### 3.4 Schema changes follow migration files, never direct ALTER

Every schema change — column addition, index creation, type change,
constraint addition — is a numbered migration file committed to version
control before it is applied to any environment.

**Migration files are the schema's source of truth.** A column that exists
in the database but not in a migration file does not officially exist.

**Protocol:**
1. Write the migration file.
2. Apply to development. Verify.
3. Apply to staging. Verify. Fix any issues.
4. Apply to production only after staging passes.
5. Never apply to production before staging.

### 3.5 Never loosen an assertion to make a test pass

If a test fails against the real database, the default hypothesis is that
it found a real bug. Determine whether it is a real bug or an environment
problem before touching the test. Loosening the assertion without
investigating is not a fix — it is burying evidence.

---

## 4. Environment and configuration discipline

Configuration files that carry credentials, hostnames, or environment-
specific values are the most dangerous files in a repository. A wrong-but-
plausible value does not crash — it quietly points at the wrong place.

### 4.1 Diff config files explicitly on every merge

Before committing or pushing any merge, diff every file that carries
credentials, hostnames, database names, or API endpoints — line by line,
not at a glance.

A clean auto-merge means git found no overlapping lines. It says nothing
about whether the result is what you want.

> **Incident:** Merging a branch brought a changed `.env.dev` with a
> different MySQL host, different Redis host, and different credentials —
> no conflict markers, no warning. Every subsequent test run would have
> silently targeted the wrong database. The diff caught it; confidence
> would not have.

### 4.2 `.env.example` is a contract, not documentation

`.env.example` documents every environment variable the application
requires. It is a contract between the repository and anyone who sets up a
new environment.

**Protocol:**
- When adding a new env variable, add it to `.env.example` immediately —
  not later, not "when there's time."
- When reading `.env.example` to set up a new environment, confirm every
  variable is understood before filling it in.
- Never commit `.env`, `.env.dev`, `.env.production`, or any file
  containing real credentials to version control.

### 4.3 Never hardcode environment-specific values in source code

API base URLs, database hostnames, credentials, feature flags — these
belong in environment variables, not in source files. A value hardcoded
in source requires a code change (and a deployment) to change. An
environment variable requires a config change.

> **KiliPicks incident:** `src/config/env.ts` and `metro.config.js` both
> hardcoded `https://nairobi-local-picks-demo.hantianyang5.chatgpt.site`
> — a third-party demo sandbox. When the backend migrates to a controlled
> domain, this is a code change plus a release, not a config update.
> `.env.example` was the right home for this value from the start.

---

## 5. Architectural boundaries

Boundaries exist to make a codebase comprehensible at scale. An agent
that respects boundaries produces changes that other agents (and humans)
can understand, test, and maintain. An agent that violates them produces
changes that work today and are mysterious tomorrow.

### 5.1 State the boundaries in a companion document

Every project must have a `CLAUDE.md` or `AGENTS.md` (or equivalent) that
states:
- Which modules own which data (tables, storage buckets, state slices).
- Which modules may import from which other modules.
- Which files are single-writer (the files where two simultaneous changes
  will always conflict, so only one agent writes at a time).
- What the response for an unimplemented capability is (see §5.3).

### 5.2 A module writes only its own data

If a module needs data owned by another module, it reads through a public
interface — never by writing directly to the other module's table,
state, or storage. "Just this one column" is how boundaries collapse.

In database terms: table prefix = write owner. A package that does not own
a table prefix does not write to tables with that prefix. Ever.

### 5.3 Unimplemented capabilities fail loudly

A capability that is not yet wired must return an explicit error — HTTP
501, a thrown exception, a named error code — not a fake success, a
fabricated ID, a silently empty result, or a stub that claims to succeed.

This is the most load-bearing rule in this section. A fake success
propagates through the system silently. An explicit error is caught
immediately and sends the agent to the right place.

> **KiliPicks:** The auth boundary (`src/auth/auth-context.tsx`) returns
> `{ status: "unavailable" }` for every auth attempt in Phase Zero. It
> never returns `signed_in`. A user who taps Continue sees an honest
> "coming soon" message — not a fake session that breaks on the next
> request.

### 5.4 Central integration files are single-writer

Files that wire the whole application together — the main entry point,
the dependency injection setup, the migration runner, the test
configuration — are modified by one agent at a time, in a dedicated
integration step, not as a side effect of feature work.

When two feature branches both modify a central file, the result is either
a merge conflict (visible, resolvable) or a silent clobber (invisible,
dangerous). Make the conflict visible.

---

## 6. Git protocol

### 6.1 Check status before any destructive operation

Run `git status` before `checkout`, `restore`, `reset`, `clean`, or any
merge or pull when uncommitted changes exist. A single command that takes
one second prevents losing work that took an hour.

### 6.2 Stash before merging upstream

When merging in upstream history with a dirty working tree, stash first
(`git stash -u` to include untracked files). Verify the stash content
after creating it and after dropping it. Do not drop a stash you have
not confirmed landed correctly.

### 6.3 Resolve conflicts by reading both sides

A conflict where both sides added different, non-overlapping information
to the same location needs both pieces of information in the result — not
"take theirs" and not "take ours."

Read both sides before choosing. "Auto-merged cleanly" means git resolved
the syntax. It says nothing about whether the result is semantically
correct.

### 6.4 One commit per logical unit of work

A commit message states:
- **What** changed (the diff shows this, but the message makes it
  skimmable).
- **Why** it changed (the diff never shows this).
- **What was verified** — what ran, what passed. Not "should be fine."
  "Ran X, Y, Z, all passed."

A commit that says "fix bug" is not a commit message. A commit that says
"fix session expiry race: identityPromise now resets on rejection so
concurrent track() calls on a fresh install cannot produce two anonymous
IDs — verified by running the analytics startup test" is a commit message.

### 6.5 Never rewrite published history

No force-push, no amend of a pushed commit, no rebase of a branch that
others may have pulled from — without explicit instruction from the person
who owns the repository, for that specific action, at that specific moment.

### 6.6 A branch behind its remote is a risk signal

If a branch has not been synced with its remote in a while, check the
divergence before trusting test results run against it. Code that other
tests depend on may not exist locally. A passing test suite on a stale
branch is not a passing test suite — it is a test suite that has not yet
encountered the missing code.

---

## 7. Communication protocol

### 7.1 Flag contradictions instead of picking one silently

When two sources of truth disagree — a README says one thing, the code
says another; a local config has one host, a merged config has a different
one — surface the contradiction. If the stakes involve data correctness or
which system gets written to, ask rather than guess.

The worst outcome is not asking a clarifying question. The worst outcome
is silently picking the wrong side and building on top of it.

### 7.2 State completion claims precisely

These are different claims:

- "Planned."
- "Code written."
- "Code written, tests passing locally."
- "Committed to a local branch."
- "Pushed to remote."
- "Deployed to staging."
- "Deployed to production, verified."

Never use one to mean another. The conflation of "I wrote the code" with
"it is done" is the most common source of missed dependencies and
integration surprises.

### 7.3 State uncertainty honestly

"This test suite died — I believe it was a timeout, but I have not
confirmed that" is more useful than a confident wrong answer in either
direction. Uncertainty, stated clearly, is information. Confidence,
stated falsely, is noise.

### 7.4 Responsiveness and verification are not in tension

Acting fast and skipping verification steps are not the same thing as
being responsive. A repeated or urgent request is a signal to prioritise
— not a license to skip the checks that make the action trustworthy.

---

## 8. Scope discipline

### 8.1 Build only what is specified

A task to implement feature A is not a mandate to also implement feature
B, even if B seems obviously related. Scope creep in an agentic context
is particularly dangerous because it happens silently — there is no
meeting where someone says "can we also add X?" There is just X, appearing
in the diff.

If a task's implementation reveals that B is necessary for A to work, stop
and surface that dependency explicitly. Do not build B quietly and deliver
"A plus some extra things."

> **KiliPicks:** The auth boundary spec explicitly listed what not to build:
> "OTP send/verify, SMS integration, Google Sign-In SDK, session tokens,
> refresh logic, credential storage, appointment lists, booking history."
> Each of those items is something an agent might plausibly add while
> implementing auth. The explicit non-goals exist because the cost of not
> listing them is discovering them in the diff.

### 8.2 A stub that claims to succeed is not a stub

A stub for an unimplemented feature returns an explicit not-implemented
signal. A stub that returns a success response with fake data is not a
stub — it is a lie embedded in the codebase that will cause real failures
in production when real behaviour is expected.

Build stubs that are honest about their state. Future agents and future
you will thank the present agent who did not bury the problem.

### 8.3 Never render a control that leads nowhere

In UI work: a button that does nothing, a menu item that opens a blank
screen, a tab that is permanently empty — each one teaches a user that
the product is broken. It is strictly better to not render the control
than to render it non-functional.

The same principle applies to API endpoints: an endpoint that accepts
requests and returns fabricated success responses is more dangerous than
an endpoint that does not exist, because the caller cannot distinguish it
from a working endpoint.

---

## 9. Documentation discipline

### 9.1 Update status documents when work lands

A STATUS.md, a progress log, a task board — these are only useful if they
reflect reality. Update them in the same commit that ships the work, not
"later." Later reliably does not happen, and a status document that lags
reality is worse than no status document, because it misleads the next
agent who reads it.

### 9.2 Document decisions, not just outcomes

A comment that says `// cache TTL is 5 minutes` is documentation of an
outcome. A comment that says `// cache TTL is 5 minutes — shorter and
the catalog endpoint becomes the hot path on every app launch; longer and
a merchant's new photos take too long to appear` is documentation of a
decision.

Future agents will change code. They will not change decisions they do not
know were made.

### 9.3 The architecture document is a living file

`ARCHITECTURE.md` describes how the system is structured and why it is
structured that way. It is updated whenever a structural decision is made
or reversed. An architecture document that describes last year's structure
is not an architecture document — it is a historical artifact.

Every significant architectural decision — a new module boundary, a
changed data ownership rule, a Phase One migration point — is added to
`ARCHITECTURE.md` in the same commit that establishes it.

---

## 10. The production readiness checklist

Before any feature, endpoint, or system is considered ready for real users,
every item on this checklist must be true — not "probably true," not "true
when I last checked."

- [ ] The feature works correctly against the real database engine, not a
      mock or a different engine.
- [ ] The feature has been tested on a real device (for mobile) or a real
      browser (for web) — not only in a simulator or development server.
- [ ] Every non-fatal failure path calls a real error reporter, not a
      silent `catch {}`.
- [ ] Every external capability that is not yet implemented returns an
      explicit error, not a fake success.
- [ ] Environment variables are documented in `.env.example`.
- [ ] No credentials, hostnames, or environment-specific values are
      hardcoded in source files.
- [ ] Schema migrations are committed to version control and have been
      applied to staging before production.
- [ ] The status document reflects what is actually true.
- [ ] The architecture document reflects any structural decisions made
      during this work.

---

## 11. Adapting this document to a new project

When this document travels to a new project, do the following:

1. Create a companion `CLAUDE.md` (or `AGENTS.md`) with the project's
   specific conventions: table ownership, module boundaries, naming rules,
   the list of single-writer files.
2. Create a `STATUS.md` (or equivalent) to track what is actually shipped
   versus what is planned.
3. Replace the incidents in §1–§9 with incidents from this project as they
   accumulate. The incidents are not decoration — they are the evidence
   that the protocol is load-bearing. A protocol without an incident is a
   hypothesis. A protocol with an incident is a lesson.
4. Add project-specific sections for any protocol that is not covered here
   — deployment procedures, API versioning rules, data retention policies,
   third-party integration patterns.
5. Do not remove sections that seem inapplicable. A section that does not
   apply today may apply next month. Mark it "not yet applicable" rather
   than deleting it.

---

## 12. Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-04 | Initial version, synthesised from KiliPicks project history and prior project agentic protocols |

---

*This document is a living reference. When a new incident teaches something
new, add it here. The document grows from reality, not from theory.*
