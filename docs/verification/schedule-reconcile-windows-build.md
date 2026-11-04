# Reviewed Windows build

Build/source commit: `5770e75b6de7a4e7ac0fda3133761f4dad888235`. Upstream base: `f4b36e12e2dbedd415a588b9baa2b8c65cf01f30`. Version: `1.18.0-beta2+5770e75b6de7a4e7ac0fda3133761f4dad888235`.

[GitHub Actions run 41847657991](https://github.com/kuntashov/twinkle-tray/actions/runs/41847657991) completed successfully on attempt 1, branch `fix/schedule-reconcile` in the user's fork. Windows runner, Node 24.22.2, npm 11.19.1: single npm ci, ordinary regression suite **64/64** (zero failed/skipped/cancelled), assets, native installer, portable ZIP, provenance and upload all passed. TAP artifact `13334510117` digest `779fc7d4b75724ed075b9b350fe115fb162abed89eff8966744a4f264537edbb` was independently downloaded and checked.

Windows artifact `13334340654`, named `twinkle-tray-windows-x64-1.18.0-beta2-5770e75b6de7a4e7ac0fda3133761f4dad888235`, contains the following payloads and original provenance files:

| File | Bytes | SHA-256 |
|---|---:|---|
| Twinkle.Tray.v1.18.0-beta2.exe | 90725731 | `db5fc53083a26fc2f3b946ac4d833c19e36bbba7201b6b7089fbd6d854803888` |
| Twinkle.Tray.v1.18.0-beta2-portable.zip | 120162362 | `4da512544ffd3ea309f98ee1cd5aaef80f515657fe5220ffd1dc4e15855b457f` |

The outer Actions ZIP is 210507529 bytes, SHA-256 `398387a3eb4e3b241370e49e440a1c46f2835aa43efa2c4a3a2710d109b35add`. Both the build owner and orchestrator independently downloaded it and verified payload sizes/hashes against the original manifest. Manifest commit, versionBuild and run URL match. Canonical normalized source SHA-256: `e8b14f873a0c70f45ad15c689f94cb64462ebb4536ac1cbd613cbf0d9a2c59d0`.

The orchestrator's local preparation only downloaded/extracted the outer archive and verified checksums. It did not launch an EXE, install Twinkle, or change the host's working app/settings/startup/brightness/time/session. Native execution is confined to the dedicated Windows VM.

The fresh final reviewer independently repeated the checks and read ASAR directly from the portable ZIP without launching an application. `app.asar` is 8984992 bytes; its `src/electron.js` is 228224 bytes, raw SHA-256 `dce57e1ffde6db42256901583dcada1fc5cf857d81dfbc1d0cf6c8a205a3cb64`. After CRLF normalization it matches canonical reviewed source `e8b14f873a0c70f45ad15c689f94cb64462ebb4536ac1cbd613cbf0d9a2c59d0`. ASAR package.name is `twinkle-tray-portable`, and package.versionBuild contains the exact build commit above. This is a packaged-content check, not native execution.

Compact non-sensitive CI evidence (logs, TAP, original manifest/checksums, API and verification receipts) is retained with SHA-256 `72b507a3c22b11f81825473cf7e20cf329d6e9acba18f27bdbfea6e268f613a4`. Large original payloads remain in Actions and local artifact storage. No credentials or signed download URLs are published.

This report proves the exact reviewed Windows build and artifact identity. Packaged ASAR identity, real second-instance delivery/native behavior and cleanup are separate VM gates. It does not prove physical DDC/CI or WMI brightness behavior. Baseline `8becd37` and cancelled `b697381` runs are not used as patched acceptance.
