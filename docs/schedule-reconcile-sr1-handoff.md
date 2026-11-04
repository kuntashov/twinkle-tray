# SR-1 implementation handoff

Source: user authorization; no BPM ticket. Branch: `schedule-reconcile/implementation`.
Base: `f4b36e12e2dbedd415a588b9baa2b8c65cf01f30`.
Contract: orchestrator's `.scratch/schedule-reconcile/spec.md`, `tickets.md` and
`docs/autonomous-decisions/schedule-reconcile.md` in the integration worktree.
This is an author handoff for independent standards/spec review, not approval.

## Delivered behavior

- One local main-process recovery owner selects current schedule or permitted
  restore targets after refresh/read waits. Completed inventory evidence is
  separate from a fulfilled refresh returning cached inventory.
- Acceptance, temporary pending displays and manual interval overrides are
  separate. Full local date, selected event and relevant settings identify the
  interval. A manual request before first acceptance protects only that display;
  ordinary animated ticks retain their behavior. Overrides are never persisted.
- Intent follows the existing transport, worker-ready await, throttle, deferred
  brightness/linked features, extended-minimum gamma queue and transition
  callbacks. Actual IPC rechecks interval and guards even without another trigger.
  Standalone volume/VCP work carries no brightness cancellation token.
- Existing lifecycle delays lead to one bounded readiness attempt (30 seconds).
  Readiness listeners, owned queued submissions and dedicated reads are released
  on cancellation. An already started valid smooth transition has an independent
  lifetime and retains its configured speed. Equivalent requests do not restart it.
- Display callbacks coalesce before starting recovery. Idle restore uses a
  same-interval pre-idle snapshot or the current accepted/manual target, so an old
  snapshot cannot overwrite a newer event. Active brightness profiles block
  automatic schedule and generic restore writes.
- Existing second-instance `--UseTime` explicitly expires the current override;
  normal lifecycle recovery preserves it. Cold startup remains controlled by
  `brightnessAtStartup` and `checkTimeAtStartup`; startup suppression does not
  prevent a later lifecycle request, explicit request or new event.
- Pausing schedule adjustments permits existing known restoration; the profile
  guard remains independent. Explicit startup restoration follows
  `brightnessAtStartup` even when lifecycle auto-apply is disabled.

Production changes are confined to `src/electron.js` and README's existing CLI
documentation. There is no new runtime helper and no packaging file-list change.
The existing volume tests use the same dependency-free production-function
extractor; their six behavioral assertions are unchanged.

## Executed checks

Node on the source-only host: v24.15.0. No dependency installation, application,
CLI process, native worker or native test was run here.

| Command | Final result |
|---|---|
| `node --test tests/schedule-reconcile.test.cjs tests/volume-values.test.cjs` | **59/59 PASS**, exit 0; ordinary isolated runner, narrow approved execution |
| `node tests/schedule-reconcile.test.cjs` | **53/53 PASS**, exit 0; complete direct module load |
| `node tests/volume-values.test.cjs` | **6/6 PASS**, exit 0; complete direct module load |
| `node tests/schedule-negative-control.cjs --patched` | **1/1 PASS**, exit 0 |
| `node --check src/electron.js` | exit 0 |
| `git diff --check` | exit 0 |

The sandbox initially denied the ordinary test runner's child spawn with `EPERM`;
the exact two-file command above then passed under narrow approval. Early focused
`--test-isolation=none --test-name-pattern=...` runs are development evidence only;
the final gate includes both complete direct loads and the ordinary runner. The
original volume test's ambient Babel parser dependency was removed from extraction,
not from its assertions. The historical analysis 30/30 observations are not counted.

## Reproducible negative control and RED/GREEN evidence

`tests/schedule-negative-control.cjs` uses the **same harness, actual production
functions and 00:00/06:00/20:00/22:00 fixture** on either source. It executes the
real scheduler, refresh coordinator/commit, brightness sender and transport. Only
worker results/IPC, time and OS/UI/persistence effects are controlled.

Run against an unmodified pinned source file:

```powershell
node tests/schedule-negative-control.cjs <path-to-pinned-electron.js>
node tests/schedule-negative-control.cjs --patched
```

With Git child-process access, omitting the first argument reads
`git show f4b36e12e2dbedd415a588b9baa2b8c65cf01f30:src/electron.js` directly. The host
sandbox denied Node's `spawnSync git`, so the initial host negative run used an explicit
file containing those exact Git blob bytes. The final default command also
reproduced the assertion under narrow approval. This environmental failure is not the
negative-control result.

- Original loaded SHA-256:
  `707d90e2f76ebb08d3ab477571dfa791726399de239511d0d610addc3aab7d4b`.
  **1 assertion failure, exit 1**: expected `A55, B45`, actual `A55`. No missing
  new-helper/API exception occurs.
- Current patched `src/electron.js` canonical Git-blob SHA-256:
  `6e7bc3336de486e3ed2ba4cfce1f2684dc2ce82d0fae8be9559bdf3023864c23`.
  The raw implementation checkout is LF and has the same digest. A CRLF
  checkout can have different bytes under `* text=auto`; compare normalized
  content or the Git blob. No source digest here is an ASAR/artifact digest.
  **1 PASS, exit 0**: exactly `A55, B45`, with no duplicate A write.

Implementation proceeded in focused vertical RED/GREEN slices. Observed REDs
before the corresponding production fix included:

| Regression | Observed RED | GREEN evidence in final suite |
|---|---|---|
| Partial/empty/newly-ready inventory | missing B45 / no retry | partial, empty and inventory-event tests |
| Manual before acceptance | manual 70 followed by old schedule 55 | manual-before-acceptance and temporary-manual tests |
| Actual queue boundary | old 55 instead of current 45 | queued sender, per-peer await and `sendNow` wait tests |
| Deferred feature work | obsolete B20 after B70; obsolete linked effects | deferred brightness/linked test |
| Shared restore | saved 75 instead of manual 70/current schedule 55 | same-interval and late-known tests |
| Smooth | instant write; wake flag cancelled recovery; pending queue retained | long smooth, real resume and callback cancellation tests |
| Animated read | no dedicated read; cancellation left one read listener | LERP read wait and actual read cleanup tests |
| UseTime/startup | manual override not expired; startup-off wrote 55 | actual handler and startup-block tests |
| Idle/lifecycle | restored zero/old 80; duplicate display writes | idle snapshot and overlapping actual callbacks tests |
| Deadline/guards | second readiness window; owner remained pending after profile | real resume deadline and dynamic guard tests |
| Gamma / interval-bound manual | expired ramp; old queued manual 70 | gamma boundary and queued manual expiry tests |

Two unchanged Unicode comments were restored byte-for-byte from the base after an
editing-tool encoding error expanded them. The final file is UTF-8, 218 KB; no
executable behavior was changed by that repair. Final checks above follow the repair.

## Acceptance coverage

All test names below refer to `tests/schedule-reconcile.test.cjs`; shortened
distinctive phrases make the matching tests easy to find.

| AC | Source-level evidence |
|---|---|
| AC1 | `partial inventory`, `overlapping actual unlock` use the actual four-event per-display fixture |
| AC2 | `real paused, rate-limited and failed refresh`, `failed software send`, `skipped refresh`, `empty current inventory` |
| AC3 | `partial inventory`, `newly-ready inventory event`, `temporarily unavailable manually corrected display`; only current inventory is iterated |
| AC4 | `overlapping actual unlock` crosses 22:00; `animated brightness is recalculated` crosses a read wait |
| AC5 | `actual refresh generations`, `read continuations completed in reverse order`, `actual queued sender`, `sendNow rechecks`, `awaited peer submission`, `manual queued before the first event` |
| AC6 | `obsolete deferred brightness and linked effects`, `manual throttle`, `extended-minimum gamma`, real gamma reset and same-valued manual retag tests; existing six volume tests |
| AC7 | actual resume/unlock/metrics/hardware/idle callbacks; `late saved known brightness`, `delayed idle return` |
| AC8 | `same-interval known restoration`, `full dates`, case-insensitive `UseTime`; actual SDR/gamma primary conversion |
| AC9 | `manual brightness before first acceptance`, `temporarily unavailable manually corrected display`, `direct manual brightness ... off` |
| AC10 | `profile changes`, `pause and idle guards`, `current visibility settings`, `pause enabled during a queued schedule send`; real read/send continuations and permitted restore reselection |
| AC11 | `valid smooth transition` lasts 80 seconds with a pending peer and readiness expiry; equivalent recovery, callback cancellation, idle smooth peers and real resume tests |
| AC12 | per-display delayed LERP, actual correlated read with linked overnight interpolation, partial readable IDs, failure and superseded read |
| AC13 | `full dates, backwards time`, `before the first event today`, both pending-manual-before-first-event tests; date/month/settings identity, first-event arrival and no previous-day carry |
| AC14 | actual read cleanup, readiness timeout/queue cleanup, worker-exit reverse completions, later normal retry; no permanent retry timer |
| AC15 software | actual `handleCommandLine`, actual startup settings block/background scheduling, later lock/unlock after startup-off; README |

## Author corrections after the first independent review

The first reviewed snapshot was `dd31c0c6c75b2742f880e62afcfe500294f74689`.
Standards reported two P2 findings and Spec reported three, with the pause defect
appearing on both axes: four distinct defects. That snapshot was not approved.
The orchestrator maintains the independent report under
`docs/verification/schedule-reconcile-review.md`. The following corrections are
submitted for both axes to review again; this author does not approve them.

| Finding / new regression test | Observed RED | Submitted correction / GREEN |
|---|---|---|
| `paused time adjustments still permit known restoration` | pause + empty schedule yielded no A75 | Schedule selection observes pause; permitted restore does not inherit the schedule pause. Empty, nonanimated and animated configurations restore A75 without accepting a schedule; active profiles remain protected. |
| `manual queued before Windows idle` | queued A70 was sent after Windows idle became true | Actual submission checks Windows idle for brightness-intent work. A70 is retained for later recovery, the off-state brightness submission is dropped, and standalone queued volume25 still executes. |
| `inventory readiness arriving during an awaited peer send` | real B-ready commit during A's queued send was lost; only A55 sent | A remembered wake version prevents sleeping after an unconsumed event. Already processed refresh events are consumed; the current inventory is revisited and B45 sends once. No polling was added. |
| `explicit startup brightness remains enabled independently` | brightnessAtStartup=true/checkTimeAtStartup=false/disableAutoApply=true yielded no A75 | Only the explicit startup request carries startup-restore authority through the owner and submission guard. A75 restores; later lifecycle known restore remains disabled, and active profiles remain protected. |

The four tests were added in separate focused RED/GREEN slices on real production
paths. That correction snapshot, `261bae5ab04910be9cfea722e3a47ca9385e2732`, passed
52/52 in the ordinary runner and 46/46 + 6/6 by direct loads. Its production changes
were limited to these guard and wake paths.

### Remaining Spec finding after re-review

Standards accepted both original findings as closed on `261bae5`; Spec reproduced
the original corrections but retained a P2 policy-selection defect. A known-restore
request first selected schedule A55, then awaited its real transport queue. If time
adjustments were paused before flush, the stale schedule was dropped but the owner
slept instead of selecting permitted known A75. That snapshot was not approved.

`pause enabled during a queued schedule send reselects permitted known restore
without a new trigger` reproduced **RED: no messages instead of A75**. The correction
reselects only when a rejected schedule submission now has pause enabled and restore
is permitted. It reuses the inventory already completed by the same owner for this
policy change; new/full requests still refresh normally. It does not treat an
arbitrary cached refresh as completion or add a polling/retry loop.

The test now sends A75 once, leaves schedule acceptance empty and releases the owner.
`transport failure after pause-driven restore selection waits without a busy retry`
also passes: exactly one restore IPC attempt fails, then the owner waits for an event
or the existing bounded deadline; no further attempt occurs before timeout cleanup.
That correction snapshot, `4e04eaba8bd23134558e6f5c2101f7702bb9eaf0`, passed **54/54**
in the ordinary runner and **48/48 + 6/6** by direct loads. No author approval is asserted.

### First-event boundary found by fresh integration review

Fresh integration review of source equivalent to `4e04eab` found another P2: a
manual request queued at 05:59, before the first event, did not expire when the
queue flushed at 06:01 without another trigger. The real-queue regression
`manual queued before the first event expires when that event arrives without a
trigger` reproduced **RED: A70 instead of the current first-event A100**.

The minimal correction binds nonanimated pending manual intents with a configured,
nonempty schedule to the existing date/event/settings identity, including the
no-event identity. The separate manual override marker is still created only when
a current event exists.
Thus first-event arrival invalidates the pending A70 and requests current A100,
without falsely accepting a schedule before its first event.

The companion test `manual pending before the first event keeps its no-event date
and settings identity` confirms that an unchanged 05:59 request still sends manual
A70, while changed no-event date/settings drop the obsolete pending request without
any schedule write, acceptance or manual override marker. The countercase
`manual brightness without any configured schedule remains independent of the date`
preserves standalone manual A70 across a date change when `adjustmentTimes=[]`.

### Gamma cache and submission ownership found by fresh integration review

The final reviewer also reproduced a P2 with actual gamma-reset helpers: an old
interval's reset restore optimistically cached gamma60, but its send was rejected.
The new interval's equal target then deduplicated against that unsubmitted cache.
`a real gamma reset cannot let a rejected old-interval restore suppress the current
ramp` reproduced **RED: no gamma60 submission after the reset**.

The companion reject-after-wait scenario also reproduced RED: gamma90 primed the
real throttle, schedule target30 cached a pending gamma60, then a same-valued manual
target30 superseded its intent. The old gamma60 was dropped, while the new target
incorrectly deduplicated. `same-valued manual brightness replaces an unsubmitted
gamma target from the old intent` observed only gamma90 + hardware0, missing the
current manual gamma60.

Both cases now execute actual `usesGammaRamp` and `restoreGammaAfterReset` by default
in the shared harness, alongside the existing real gamma/extended-minimum functions.
The correction tracks the latest gamma request's software submission result
separately from the requested level cached on the monitor. Pending/rejected or
superseded gamma cannot suppress an equal current target. Only the matching latest
request and still-current intent can mark software acceptance; an older callback
cannot confirm a newer request. Both real-queue regressions now submit gamma60 for
the current intent. This adds no native acknowledgement protocol or physical claim.

The current ordinary runner passes **59/59**, and direct loads pass **53/53 + 6/6**.
The original-production negative control still fails specifically on missing B45
with the expanded real-helper harness; the patched control passes. Independent final
re-review and a build from the subsequently accepted source remain required.

## Runtime handoff and limits

The harness extracts declarations without rewriting their algorithms. Its seams
include actual `refreshMonitors`, inventory commit, lifecycle handlers, queues,
deferred feature/linked flush, gamma throttle, `updateBrightness`, `sendNow`,
transitions and the real dedicated read job. Worker/native calls, app bootstrap,
UI and persistence effects remain controlled. The normal shared monitor inventory
operation retains its existing worker timeout/serialization; cancelling brightness
readiness does not recall an already issued native inventory operation.

SR-2 must separately establish packaged startup, actual second-process delivery,
Windows build/packaging and session/power events on the dedicated VM. This author
does not mark those runtime gates passed. Physical DDC/CI and WMI remain deferred;
software transport acceptance is not native acknowledgement or physical success.

The VM owner reported an existing baseline limitation: a cold start during native
idle presence 2 can skip worker startup, and returning to active presence 0 did
not start that worker; a fresh active launch did. This revision does not change
`startMonitorThread` startup policy. Startup-off assertions concern the initial
phase; later idle return or other lifecycle recovery may apply the schedule.

For VM observability, existing `settings.json` field `logging: true` enables the
normal session log under `<configFilesDir>/logs/session-*.log`. Non-portable config
uses Electron `app.getPath("userData")`; portable config uses `../../config/`
relative to `src`. No new logging flag or telemetry is added. Useful main log markers:

- `Time adjustment request: reconcile { explicit: true, time: ..., instant: false }`
  identifies the running-instance UseTime delivery into the owner.
- `Time adjustment request: guarded { explicit: true }` / `no current event`
  identify delivery blocked by policy or event selection.
- `Brightness reconciliation: software target accepted { kind, target }` means
  eligible software submission/completed smooth target, not physical acknowledgement.
- `waiting for usable monitors` then `finished { cancelled: true }` distinguishes
  bounded readiness expiry/worker stop from accepted brightness. The surrounding
  existing worker logs identify exit/failure. A no-compatible-display VM must be
  reported as such, without inventing a successful hardware write.

Independent reviewers should compare this source commit against the pinned base
on both standards and specification axes. Integration and acceptance remain with
the orchestrator; no push, PR, merge or self-approval was performed by this author.
