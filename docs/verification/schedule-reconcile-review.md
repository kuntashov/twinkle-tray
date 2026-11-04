# Independent review: schedule reconciliation

Base: `f4b36e12e2dbedd415a588b9baa2b8c65cf01f30`. Governing contract: [specification](../../.scratch/schedule-reconcile/spec.md).

## CI slice

Reviewed commit: `3052e6aef36d91a982ef51fdf5d687365216beeb`. Authors and reviewers were separate agents. Review axes ran independently against `git diff BASE...HEAD` in a dedicated worktree.

**Standards:** clean; no documented-standard breaches or material baseline smells. Scope limited to workflow and build manifest. Arguments, test exit-code propagation, artifact names, read-only token permissions and source identity were checked.

**Specification:** clean for the CI slice of SR-2. Tests precede dependency installation/build; TAP uploads on failure; installer/portable receive exact versionBuild; manifest checks HEAD and records run URL, sizes and SHA-256. No release publication or additional service added.

Both reviewers reported existing Node tests (3/3), PowerShell AST parsing (0 errors) and `git diff --check` (clean). **The local test claim is superseded:** the isolation-none runner did not establish complete file loading; direct execution fails on the missing explicitly required `node_modules/@babel/parser`. No full local baseline pass is claimed. Neither reviewer ran dependency installation or electron-builder. Real Actions execution, packaged contents and VM startup/second-instance are separate gates.

## Preflight and CI ordering correction

[Preflight run](https://github.com/kuntashov/twinkle-tray/actions/runs/41831214629), commit `319d90202c0993130f8f49f84949414583206d8c`, established that the Windows runner and Node setup execute without a billing block. It failed before dependencies/build: `volume-values.test.cjs:47` requires the lockfile dependency `@babel/parser`, missing in a clean checkout. The initial review missed this workflow-ordering defect.

The accepted correction installs dependencies once before tests, keeping tests before asset/package builds. Ordinary isolated `node --test` after `npm ci` is the full-suite gate. Source-only local tests may execute files directly; isolation-none partial counts are not accepted as proof of complete suite loading. This preflight is not patch acceptance and produced no Windows package.

[Second preflight](https://github.com/kuntashov/twinkle-tray/actions/runs/41832206163), commit `078b2f26442dafc109f69e5101d82ef4774fc176`, reached installation and failed `npm ci` with seven nested `node-addon-api` records inconsistent with the existing override. Runner npm was 11.19.1; local npm 11.12.1 did not detect or repair the mismatch. Metadata-only regeneration using npm 11.19.1 aligned exactly those seven records to 8.2.2, preserving the 1603-package set, all other versions, root record and package.json. Resolved URLs/integrities match the pre-existing 8.2.2 lock record. The test-artifact step now skips absent TAP files to preserve the primary error without a secondary missing-file failure.

Both independent review axes accepted correction commits `e1ab4466eeec9f131b7c5b456aea315c3bfc50dc` and `8ba710bb4ce79ab0c1644b99881f822de324741f`. Matching resolver dry-run and diff checks passed; no local dependency/native installation occurred. The next real Windows run is still required.

## Verified baseline Windows build

[Run 41833375800](https://github.com/kuntashov/twinkle-tray/actions/runs/41833375800), exact commit `8becd374802f41994190b836cc510df1cfbad74f`, completed successfully on attempt 1. Installation, ordinary `node --test` (6/6), assets, native installer, portable ZIP, provenance and artifact upload all passed. No billing block was observed. This is a build-feasibility baseline before SR-1, not acceptance of the schedule patch.

Downloaded Actions artifact `13325061352` (210500756 bytes) SHA-256 `0643fac0f3484c98c93a7c83131f8687f54ee241aba1877e145f4c99d07cc7fa` matched the API digest. Manifest commit/run URL/versionBuild and recomputed payload hashes matched:

| Baseline payload | Bytes | SHA-256 |
|---|---:|---|
| Installer | 90722397 | `702836a78c731b5f89407c8d7490e8bee126f2ab774e52fff9321237dcdc3649` |
| Portable ZIP | 120158869 | `26394bbe129f74df3942ed4b6ce94062e22699c93cfcedc350286697c4e4ed34` |

TAP artifact `13324891292` digest `bb96d4aabe52cf3de62c2cd829f6d67db3b3a03031f0c8cdaae5f3a0e09293bf` was also verified. Baseline VM smoke and the later reviewed-patch build have distinct reports; these hashes must not be presented as patched binaries.

## SR-1 first independent review

Fixed commit `dd31c0c6c75b2742f880e62afcfe500294f74689`, compared independently against the pinned base in a dedicated worktree. Both reviewers and the orchestrator reproduced direct schedule tests 42/42, volume tests 6/6, a specific missing-B45 failure on original production code and a pass on patched production code. These passing tests did not cover the additional failures found below.

### Standards

- **P2:** queued manual brightness could be submitted after Windows became idle. Actual queue reproduction: isRefreshing → manual A70 → Windows idle → flush still sends A70. The manual branch of `brightnessIntentIsCurrent` around line 5701 omitted the idle recheck, bypassing the earlier `updateBrightness` guard after a wait.
- **P2:** pausing time adjustments blocked permitted known-brightness restoration. With no schedule and pause enabled, baseline `setKnownBrightness()` sends A75, while this commit sends nothing. The shared owner/intent guards around lines 5704 and 5790 applied the schedule pause to restore work.

No additional documented-standard violations or material heuristic smells were reported. Syntax/diff checks were clean; no native/app operation was executed by reviewers.

### Specification

- **P2, policy 7:** the same pause/known-restore regression violates preservation of existing restoration gates, including restoration after dimming while time adjustments are paused.
- **P2, AC3:** inventory wake can be lost while awaiting a preceding display's queued send. A-ready/B-none snapshot → A waits behind enrichment → real inventory commit makes B-ready and emits wake before a resolver exists → A55 sends → stale B-none snapshot sleeps until timeout. Actual inventory/queue reproduction sends no B45 within 30 seconds. A remembered wake/revision is required before sleeping.
- **P2, startup compatibility:** with brightnessAtStartup=true, checkTimeAtStartup=false and disableAutoApply=true, baseline startup sends A75 but the patch sends nothing. The new unconditional restore guard around line 1755 changes the separate startup gate; lifecycle auto-apply gates must remain enforced independently.

Summary: Standards 2 findings (worst P2); Spec 3 findings (worst P2). The pause finding appears on both axes. All four distinct reproductions were returned to the author for regression tests and correction; this commit is not approved for integration/build acceptance.

The raw checkout hashes differ under Git's automatic LF/CRLF conversion. Canonical Git blob SHA-256 for this production source is `d07c7c5324529ee85670b757cea74f620dbc28a0d2e033f3f6ee94c014b5b699`; the CRLF review checkout is `13fb23c3e1fe614d68d9decab84868417c8b6534b25d16f6afcf4f9c5d06cc1a`. Normalized text equality was verified. Neither is an ASAR/package digest.

## SR-1 revision re-review

Fixed revision `261bae5ab04910be9cfea722e3a47ca9385e2732` added four real-path regressions and corrected the initial findings. The ordinary isolated runner independently passed 52/52 (46 schedule + 6 volume). Direct tests, patched negative control and syntax/diff checks also passed.

### Standards

**READY:** both original findings were independently reproduced as corrected. Queued manual work now sends nothing while Windows is idle, retains manual 70 and restores it later; paused known restore sends A75 while the active-profile guard remains. No new blocking standards findings.

### Specification

All three original reproductions passed, but **one P2 remained** around lines 5882–5896: enabling pause during an awaited schedule send correctly drops schedule A55 but does not reselect permitted known A75. In the actual queue reproduction, the owner has restore=true/known A75, B excluded, and A55 queued behind enrichment. After pause and queue release, it sleeps until deadline with no writes. Policy 7 and AC10 require current schedule-versus-restore selection after this wait, without blindly retrying failed transports forever.

Summary: Standards ready, Spec one P2 (worst P2). The revised snapshot remains unapproved for acceptance until this remaining reproduction is corrected and re-reviewed.

## SR-1 final independent re-review and integration

Fixed source revision `4e04eaba8bd23134558e6f5c2101f7702bb9eaf0` corrected the remaining policy-change case and added an anti-spin regression. Both review axes compared the delta and the original AC1–AC15 contract.

### Standards

**READY, zero open findings.** Previously reported defects remain corrected. Completed inventory is reused only for the pause-driven schedule-to-permitted-restore change; failed restore transport attempts remain bounded rather than spinning. Independent direct schedule 48/48, volume 6/6, syntax and diff checks passed.

### Specification

**READY, zero open findings.** All earlier actual-path reproductions now pass: permitted restore while paused, independent startup restore, inventory wake during an awaited peer send, and pause during a queued schedule send switching to A75 without another external trigger. The anti-spin test observes one failed restore attempt and deadline cleanup. Independent direct tests 48/48 + 6/6, patched negative control, syntax/diff checks passed. No confirmed new regressions or scope additions were found.

The orchestrator independently ran the ordinary isolated test runner: 54/54 passed. After cherry-picking the three reviewed source commits into the integration branch, the same ordinary runner again passed 54/54, and the full-base diff check was clean. The integrated source commit is `55849a1` (author source chain dd31c0c → 261bae5 → 4e04eab). Canonical normalized source SHA-256 is `6f438a38d18078238c0a1a49e8b405f647ff2acd9d30ec06511c24777d28139e`.

This approves software source integration. Exact-commit Windows packaging, final packaged VM evidence and fresh final integration review remain separate gates. Reviewers did not execute live host applications/native tests or claim physical DDC/WMI success.
