# Schedule reconcile delivery tickets

Source: user authorization; no BPM ticket or configured external tracker. Base: `f4b36e12e2dbedd415a588b9baa2b8c65cf01f30`. Governing contract: [specification](spec.md); [decision log](../../docs/autonomous-decisions/schedule-reconcile.md).

These local tickets substitute the unavailable `to-tickets` workflow. The autonomous stakeholder approved two vertical delivery units. Production mechanisms stay in one ticket because separating scheduler, restoration and delayed-send ownership would leave intermediate commits with contradictory brightness owners.

## Dependency graph and ready frontier

`SR-1 implementation + regression tests → independent two-axis review → SR-2 fixed-commit build + VM integration → integrated checks + fresh final review`

Ready now: SR-1. SR-2 may independently inspect Actions policy, credentials and Windows prerequisites, but its build/runtime acceptance is blocked on the reviewed SR-1 commit. Each code author works in a dedicated branch/worktree; no concurrent writers to one checkout. The reviewer is independent of the author. Integration is controlled by the orchestrator.

## SR-1 — Reconcile current schedule and restoration through one brightness owner

**State:** source implemented, independent Standards/Spec re-review READY at `4e04eaba8bd23134558e6f5c2101f7702bb9eaf0`, integrated through `55849a1`; ordinary integrated Node runner 54/54 PASS. **Unblocks:** SR-2 exact-commit build/runtime acceptance. **Owner:** one implementation agent in its dedicated worktree. **Coverage:** AC1–AC14 and software/README portion of AC15. Evidence: [review record](../../docs/verification/schedule-reconcile-review.md), [author handoff](../../docs/schedule-reconcile-sr1-handoff.md).

### User-visible result

After a lifecycle/display/idle recovery, usable displays receive the current schedule target without consuming a skipped event or allowing old asynchronous work to overwrite newer brightness intent. Non-animated manual correction survives the current interval, including when made before the first schedule send. Existing animated, startup and CLI policies remain compatible with the specification.

### Scope

- Implement the smallest coherent change in existing main-process coordination; a helper is allowed only if it simplifies the code and is included in packaging.
- Reuse current worker readiness, completed inventory evidence and recovery infrastructure. Coalesce overlapping recovery requests, select schedule or permitted known restore through the same owner, and track eligible current inventory per display. Do not await all historical known displays.
- Separate pending readiness, accepted schedule target and per-display manual override. Recalculate current target and guards after waits. Keep full local date/event/settings identity; preserve no-event-before-first and existing cold-start contract.
- Cancel superseded brightness-owned work through actual sender, transport/throttle queues, deferred feature and linked updates, and smooth callbacks. Keep unrelated volume/VCP behavior intact. Check interval/date/settings and current ownership again immediately before actual send after any internal wait, even without another trigger.
- Bound readiness pending to 30 seconds after existing wake/restore delay, with event-driven wakes and cleanup. This deadline does not shorten a valid smooth transition: a transition exceeding 30 seconds retains the existing speed and completes normally unless superseded.
- Document the existing case-insensitive `--UseTime` for an already running instance. Do not add a new CLI, UI, native ACK protocol, clock watcher or permanent polling loop.

### Acceptance and tests

Use the agreed seam: real patched scheduler/recovery/manual entry requests through production sender and queues with controlled Date/inventory/worker effects. Follow existing `node:test` style and vertical red → green slices. The old analysis harness is supporting evidence, not proof that this implementation passes.

| Criteria | Required demonstration |
|---|---|
| AC1–AC4 | Actual per-display 00:00/06:00/20:00/22:00 fixture, missed-event recovery, skipped/failed refresh, partial readiness and target recalculation across the 22:00 boundary. Accepted peer receives no duplicate; newly-ready display receives the current target. |
| AC5–AC6 | Reverse asynchronous completion, send blocked behind inventory, deferred brightness/linked flush after newer manual/schedule intent. Old pending work is rejected; standalone volume/VCP still executes. Include a time-boundary change during sender wait without a new trigger. |
| AC7–AC10 | Overlapping lifecycle/idle restore, manual after acceptance and before first acceptance, per-display peers, latest manual target restoration, changing pause/profile/idle/settings guards. No later generic restore overrides active profile or current manual/schedule intent. |
| AC11–AC12 | Instant, smooth and animated/LERP paths. Immediate callback cancellation; no leaked intervals. Test a legitimate smooth transition longer than 30 seconds, recalculated LERP after read wait, partial readable IDs and read failure. |
| AC13–AC14 | Full date/month/backwards-clock reevaluation, midnight with and without 00:00, readiness timeout/worker exit cleanup and a later ordinary attempt. No previous-day carry or permanent retry polling. |
| AC15 software | Existing handler and startup contract, case-insensitive UseTime, guards, README running-instance requirement. Actual process delivery is completed by SR-2. |

At least the defect-regression cases must fail against the pinned old behavior before the change, then pass against the actual patched code. Exercise the real completed-refresh outcome and deferred paths; testing only a mocked `applyCurrentAdjustmentEvent` is insufficient. Run focused tests during slices, relevant repository suite and syntax checks before handoff. Record exact commands, failures/red evidence and final outcomes.

### Handoff and review gate

Deliver commit SHA, branch/base, changed behavior, criterion-to-test mapping, test commands/results, assumptions and risks. Keep durable tests/docs in the commit and omit sensitive local evidence. Independent review compares `git diff f4b36e12e2dbedd415a588b9baa2b8c65cf01f30...HEAD` separately on repository standards and specification axes. Return valid findings to the author; re-review corrected commits. SR-1 cannot self-approve. Only accepted commits proceed to SR-2/integration.

## SR-2 — Produce and exercise the reviewed Windows artifact

**State:** ready for exact reviewed integration-commit build. Baseline Windows preflight succeeded; dedicated VM toolchain and baseline native runtime executed separately. Patched packaged tests and fresh final integration review pending. **Depends on:** SR-1 and resolved independent review (satisfied). **Coverage:** packaged AC15, AC16–AC17, regression checks for AC1–AC14 on the fixed commit.

### Deliverable

A Windows x64 build tied to the fixed reviewed commit, with CI/build logs, artifact hash, dedicated-VM runtime evidence and a short physical-test/rollback plan. Software and virtual-display observations must remain distinct from physical DDC/CI or WMI success.

### Scope and acceptance

- Check fork Actions policy/availability first. Prefer existing Windows Actions; add only necessary test/build/artifact steps in a separate owner worktree. Push only to the user's fork. No upstream PR/merge, paid-plan change or billing workaround. If Actions is unavailable/unsuitable, build on the authorized Windows VM and retain exact fallback evidence.
- Run required regression/syntax/build gates for the exact integrated/reviewed commit. Confirm every new runtime helper is packaged. Produce a usable Windows x64 artifact, record SHA-256, commit, run URL or fallback command/log, and reproducible retrieval location (AC16).
- Perform mandatory packaged application launch and actual second-instance `--UseTime` delivery on the dedicated VM, including cold startup checking on/off and running-instance behavior (AC15). A direct handler call or old bootstrap mock does not satisfy this process-level check.
- Exercise practical real session/power lifecycle behavior on the dedicated VM. If the environment blocks a scenario, record the exact attempted command/event, blocker and observed layer; do not substitute mocks and claim that scenario passed. A mock/native-inert worker may isolate IPC behavior; separately establish that the native runtime starts (AC17).
- Re-run relevant production-code regressions on Windows and retain criterion-to-evidence mapping. Report virtual/no-compatible-display outcomes explicitly. The VM may use necessary dependencies, installation, time/lock/wake/reboot operations; retain a recovery path and logs when reboot is useful.
- Prepare a short future physical DDC/WMI verification and rollback plan. Stop before all live operations on the user's host: no changes to working Twinkle, VBS/task/startup, brightness, time, drivers or lifecycle there.

### Handoff and final gate

Return exact commit/branch, artifact location/hash, CI or fallback build evidence, VM commands/scenarios/results, blocked gates, physical limitations and rollback instructions. Commit durable non-sensitive scripts/docs and necessary workflow changes. A fresh final reviewer checks integration gaps, packaging and regressions; resolve in-scope findings and repeat affected gates. Orchestrator verifies final graph/tree/spec coverage and reports readiness for human physical testing without claiming physical monitor repair.

## Ticket completion record

Update each ticket with final commit(s), independent-review result and evidence links when its gate is actually satisfied. A build, mock test or partial VM smoke alone does not mark both tickets complete.
