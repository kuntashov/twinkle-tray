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
