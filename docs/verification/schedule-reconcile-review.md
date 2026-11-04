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
