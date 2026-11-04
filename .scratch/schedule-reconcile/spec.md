# Schedule recovery after monitor readiness

Status: implementation contract, 2026-11-04. Source: user request; no BPM ticket or external tracker. Base: `f4b36e12e2dbedd415a588b9baa2b8c65cf01f30` (Twinkle Tray upstream master, version 1.18.0-beta2). Decisions: [decision log](../../docs/autonomous-decisions/schedule-reconcile.md).

## Outcome and evidence

After unlock, resume, display changes or return from idle, Twinkle Tray reconciles the currently applicable time adjustment once usable monitor state is available. It selects the target at application time, preserves a user's non-animated correction in the current interval, and prevents superseded schedule or restore work from overwriting newer brightness intent.

The installed 1.17.2 commit is `0ffa0ac5aa5af31affee69dd18796d6897646a07`; this change targets the pinned upstream base above and reuses its existing worker readiness and recovery infrastructure. Analysis artifacts are retained by the orchestrator in the original checkout (`analysis.md`, `analysis-handoff.md`, `vm-results/`). They establish source-level risks and mock reproductions, not a physical monitor diagnosis. The old 30/30 mock observations are not acceptance tests for this patch.

Pinned source evidence in `src/electron.js`: scheduler/cache 5750–5827; worker readiness 408–441; refresh 2910–2980; resume/unlock 5319–5464; idle restoration 5574–5615; queued transport 184–218 and 237–261; deferred feature/linked work 2728–2774; transitions 3426–3516. The existing `--UseTime` second-instance path ends at 6056–6057; cold startup remains governed by startup settings.

## Terms

- **Schedule interval**: a selected event, its relevant settings and full local calendar date. It is not identified by day-of-month or event minute alone.
- **Brightness intent**: the current schedule target, restoration target, or manual brightness request for an affected display.
- **Intent generation**: an invalidation identity for pending brightness work. It is distinct from upstream's monitor inventory generation.
- **Accepted target**: an applicable target accepted by the current software transport for a display. It is not physical DDC/CI or WMI acknowledgement.
- **Manual override**: an in-memory, process-lifetime per-display non-animated interval marker and target which protects a manual choice, including one made before the interval's first schedule target was accepted. It does not falsely mark that schedule event applied or persist across application restart.
- **Recovery**: one bounded reconciliation owner coalescing overlapping lifecycle/display/idle triggers and choosing schedule or permitted known-brightness restoration.

## User stories and policies

1. A user leaves while a morning event is current and returns after later events: only the current event is applied after readiness, without replaying intermediate events.
2. A display is temporarily unavailable or `type: none`/`featuresPending`: its schedule event is not consumed. When it becomes usable, it receives the then-current target. Peers already accepted receive no duplicate schedule writes for the same non-animated interval.
3. A user manually corrects one display during the current non-animated interval: normal ticks and same-interval unlock/idle recovery preserve that correction. Other displays may continue pending recovery.
4. A user corrects brightness while a new event is still awaiting readiness: pending work for that display is cancelled and a manual override for that interval is recorded. A later tick does not erase it merely because the schedule event was never accepted.
5. The interval or full local date changes, relevant schedule settings change, or the user explicitly invokes `--UseTime`: the applicable override expires and the current schedule target becomes eligible. The existing pause, profile and idle guards still apply.
6. A display needs same-interval restoration after dimming or worker/display recovery: the owner may restore its current manual/pre-idle/known target according to existing restoration gates, without forcing the schedule value. A manual request after recovery begins supersedes the captured restore target.
7. An active brightness profile owns brightness: schedule and generic known restore do not overwrite it. Paused schedule, idle dimming and disabled automatic behaviors retain their existing gates; a guard changing during asynchronous work takes effect before another write.
8. Animated time adjustments retain regular LERP ticks and existing interpolation, rounding and readable-monitor rules. A manual brightness action invalidates already pending animated work; no new persistent manual hold is introduced for animated mode.
9. `--UseTime` with an already running instance forces the current schedule through the same owner. No new command is added. A cold launch retains the existing startup/checkTimeAtStartup contract.

An external application restart also returns to the existing startup/checkTimeAtStartup policy; no manual override persistence is added. Existing external restart scripts/tasks are outside the patch scope.

Manual brightness includes the brightness paths exposed by UI, SDR/gamma primary sliders, hotkeys/wheel, and CLI Set/Offset. Invalidation must follow brightness intent; a standalone volume or unrelated VCP request must not cancel schedule recovery merely because it records recent interaction. Existing linked feature writes derived from a brightness intent share that intent's cancellation. This does not change unrelated VCP semantics.

## Implementation constraints

### Readiness and bounded ownership

- Reuse existing worker-ready waits, refresh queues and resume recovery. One recovery owner coalesces competing unlock/resume/hardware/metrics/idle-return requests rather than running independent schedule and restore writers.
- A fulfilled `refreshMonitors()` which returned cached inventory is not proof that requested refresh work completed. Use an explicit refresh outcome or equivalent existing completed-generation evidence to distinguish completion from skip/failure.
- Readiness is worker availability plus usable current inventory for the brightness operation. Do not wait for all historical known-displays. Current eligible displays and temporary not-ready records are tracked per display; hidden, rule-excluded or disconnected historical displays do not create permanent pending work.
- Brightness need not wait for unrelated feature enrichment when the current type supports it. Feature-dependent deferred work remains subject to the current intent.
- Waiting for recovery readiness is bounded to at most 30 seconds after the existing wake/restore delay. Wake on existing ready/inventory/presence events. Clean up readiness listeners and waiting state on timeout, supersession or worker exit. This deadline does not limit an already started smooth transition: it completes at the existing configured speed unless superseded or otherwise cancelled by current policy, even if it takes longer than 30 seconds. An equivalent tick/recovery request for the same valid intent must not restart that transition or delay its completion. Do not add permanent retry polling. A later normal trigger/tick/explicit request can start a fresh readiness attempt.

### Target selection, sending and cache

- After each readiness/read wait, re-evaluate current time, event/settings identity, guards and intent validity before writing. LERP must also be recomputed after the brightness-read wait. A wait spanning 21:59–22:01 uses the 22:00 target.
- Full date and current selected event/settings identity handle midnight, month boundaries and backwards clock changes on the next existing reconciliation. No new clock watcher is required. Before the first event of a day preserve the existing no-event result; do not carry yesterday's last event into today.
- Maintain pending, accepted per-display state and manual overrides separately. Never advance the accepted schedule marker merely on selection, refresh resolution or queuing. A missing/idle/unsupported/failed send cannot count as acceptance. Smooth acceptance is complete only when its target has finished, rather than when its interval is created; cancelled smooth work is not applied.
- Attach/check intent validity through delayed refresh/read continuations, `queuedMonitorCommands`, `sendNow` after any internal wait, throttled brightness updates, `deferredFeatureUpdates`, deferred linked brightness effects, and smooth timer callbacks. A superseded callback cannot enqueue or send an old owned target to the current display.
- Immediately before actual IPC submission, after any `sendNow` or queue wait, re-evaluate the selected interval, full local date and relevant settings identity as well as guards. This check is required even when the intent token is unchanged and no tick or lifecycle trigger has arrived during the wait. Drop an obsolete interval's pending submission and request reconciliation for the current schedule instead of sending it.
- Cancellation stops a timer callback immediately. Clearing its interval alone must not allow another step from that callback.
- Already issued native calls cannot be recalled. The supported guarantee is that after invalidation no still-pending owned work sends an older target, and the latest accepted software intent is the last eligible software submission. Do not add a native acknowledgement protocol.
- Choose schedule or existing permitted known restore inside the owner. No later independent known restore may overwrite the selected schedule or a newer manual request. Preserve startup grace and checkTimeAtStartup/brightnessAtStartup behavior.

### Scope and compatibility

Expected production scope is existing `src/electron.js` coordination, a minimal helper only if it reduces coupling, README documentation for existing `--UseTime`, and tests/build metadata needed for the requested Windows artifact. Any new runtime helper must be included by the existing packaging file list. Do not redesign monitor discovery/native workers, add settings/UI/new CLI/service, change physical acknowledgement semantics, migrate the whole application, or alter unrelated volume/VCP behavior.

Do not change the host's working installation, unlock VBS/task/startup, brightness, time, drivers, application lifecycle, lock or reboot state. VM lifecycle and required reversible actions are authorized on the dedicated Windows VM only. No upstream PR/merge; fork branches and Actions are authorized. No paid-plan/billing workaround. Secrets are never written to docs, output, process arguments or commits.

## Accepted test seams

The autonomous stakeholder has approved these seams before implementation tests:

1. Existing recovery/scheduler/manual entry requests through the actual patched production sender and queues, with controlled clock, inventory and worker transport. Assertions inspect intended worker messages, target ordering, per-display acceptance and cancellation/cleanup. Exercise actual patched functions; do not test a rewritten copy of their algorithm. Real refresh outcomes, queue/deferred paths and recovery integration must be covered, not just a mocked `applyCurrentAdjustmentEvent` collaborator.
2. Real packaged Electron startup and actual second-instance delivery on the dedicated VM are mandatory minimum evidence. Exercise a real session/power event as a separate integration gate, or retain precise blocked evidence with the attempted action and environmental reason. A mock/native-inert worker may isolate transport semantics; it cannot replace all packaged/runtime evidence. State exactly which layer each test executes.
3. Physical DDC/CI and WMI on the host are deferred to a human stage; neither virtual displays nor mock acknowledgements satisfy it.

Tests should be dependency-free where practical, following existing `node:test` style. Implement vertical red/green slices. Negative scenarios must demonstrate that the relevant old behavior fails, then pass against the patched code. Existing repository checks remain required.

## Acceptance matrix

| ID | Given / trigger | Required observation |
|---|---|---|
| AC1 | Per-display events 00:00=45/35, 06:00=100/100, 20:00=55/45, 22:00=45/35; return at 21:00 after morning absence | Current software sends are 55/45 once ready; no replay of earlier events |
| AC2 | Worker not ready, refresh skipped/paused/rate-limited/failed, then usable inventory | No premature accepted marker; later readiness submits the current target |
| AC3 | One ready display, one temporary none/featuresPending; second becomes ready | Ready peer is not rewritten for the same non-animated interval; second receives current target; no wait for historical disconnected display |
| AC4 | Readiness or brightness-read delay crosses 22:00 | Only the currently valid 22:00 or recalculated LERP target is submitted |
| AC5 | Old/new refresh/read requests complete in reverse order; or a send waits behind inventory work across an interval/date/settings change without a new token or trigger | No stale brightness submission; actual pre-IPC checks reject the obsolete identity and request current schedule reconciliation; queue paths exercise actual production checks |
| AC6 | Old feature-dependent brightness and linked work become flushable after manual/new schedule intent | Old deferred work is discarded; unrelated standalone volume/VCP requests still execute |
| AC7 | Tick/unlock/resume/hardware/idle delayed callbacks overlap | Coalesced outcome; permitted restore and schedule share ownership; no late known value overwrites current schedule/manual target |
| AC8 | Manual correction after schedule acceptance in non-animated interval | Tick and same-event recovery preserve it; next interval and explicit UseTime apply current schedule |
| AC9 | Manual correction before first acceptance while peers remain pending | Corrected display records override without falsely applied event; peers continue; next tick does not erase manual; newly-ready corrected display recovers current manual target |
| AC10 | Pause/profile/idle/settings change while awaiting refresh/read/send | Rechecked policy prevents the stale write; no generic known restore over active profile; no leaked pending owner |
| AC11 | Instant and smooth, including a valid smooth transition lasting over 30 seconds, an overlapping minute tick/equivalent recovery, and cancellation during callback | Instant uses existing direct behavior; long smooth reaches its target at existing speed without readiness-deadline cancellation or restart by equivalent requests, stops immediately if superseded/cancelled, and releases intervals/queues |
| AC12 | LERP linked/per-display, midnight next event, partial readable IDs, read failure | Existing interpolation and rounding preserved; current value after wait; unreadable targets not falsely accepted; failed/superseded read does not write |
| AC13 | 23:59→00:00, month boundary, backwards clock; schedule without 00:00 | Full-date/event reevaluation on normal trigger; 00:00 applies if present; no previous-day carry before first event; no stale later event after backwards change |
| AC14 | Readiness wait expires or worker exits; later readiness or normal tick occurs | Waiting state/listeners cleaned within readiness deadline; no permanent polling or unhandled rejection; subsequent ordinary attempt remains possible; a valid already-started smooth is not expired merely by that deadline |
| AC15 | Existing instance receives case-insensitive UseTime; cold launch with startup checking on/off | Real second-instance path forces current guarded schedule; cold startup retains settings contract; README accurately states running-instance requirement |
| AC16 | Windows build from the reviewed fixed commit | Windows x64 artifact produced, hash and commit recorded; required checks pass; no runtime helper missing from package |
| AC17 | Dedicated VM smoke/integration from that artifact | Real packaged launch and actual second-instance delivery are demonstrated. A real session/power event is exercised, or exact attempted-action/environmental blocked evidence is retained. Mocks alone do not satisfy this gate; logs distinguish virtual/no-hardware outcomes from failures; no live host operations |

## Delivery and verification

Independent review must check standards and this specification separately against the fixed base; author cannot self-approve. Resolve in-scope findings before integration. Final verification includes focused/available full tests, syntax/build checks, final diff and clean committed tree, Actions run or exact fallback VM build evidence, artifact SHA-256 and exact commit, VM report, and a short physical DDC/WMI test/rollback plan. If an environment gate is impossible, retain its exact failure evidence and distinguish it from product behavior rather than claiming it passed.

The stopping boundary is readiness for human physical testing on the host. No claim that physical monitor brightness is fixed follows solely from software/VM success.
