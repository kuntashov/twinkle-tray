# Проверка готовой сборки Twinkle Tray

**Exact source: 5770e75b6de7a4e7ac0fda3133761f4dad888235. Source tests и native VM/CLI checks завершены. Физическое применение яркости не подтверждено.**

## Identity сборки

[Actions run 41847657991](https://github.com/kuntashov/twinkle-tray/actions/runs/41847657991), attempt 1, Windows artifactID **13334340654**. Проверены локально, независимо от CI owner:

| Артефакт | Bytes | SHA-256 |
|---|---:|---|
| Outer Actions ZIP | 210507529 | `398387a3eb4e3b241370e49e440a1c46f2835aa43efa2c4a3a2710d109b35add` |
| Portable ZIP | 120162362 | `4da512544ffd3ea309f98ee1cd5aaef80f515657fe5220ffd1dc4e15855b457f` |
| Installer EXE | 90725731 | `db5fc53083a26fc2f3b946ac4d833c19e36bbba7201b6b7089fbd6d854803888` |

Outer digest совпал с API digest. Build manifest подтверждает commit/run; inner ZIP и installer size/hash совпали с manifest. Installer не запускался. Portable asar содержит name `twinkle-tray-portable`, versionBuild `1.18.0-beta2+5770e75b6de7a4e7ac0fda3133761f4dad888235`.

Packed `src/electron.js` raw SHA-256 — `dce57e1ffde6db42256901583dcada1fc5cf857d81dfbc1d0cf6c8a205a3cb64`. После CRLF→LF hash **e8b14f873a0c70f45ad15c689f94cb64462ebb4536ac1cbd613cbf0d9a2c59d0**, равен canonical exact source archive. Normalized hashes packed Utils.js и volume-utils.js также совпали с exact source. Разница raw/normalized объясняется line endings, source не переписывался.

## Source checks

На Windows Node v24.19.0, без npm install, выполнены неизменённые tests exact snapshot:

- **64/64 PASS: 58 schedule + 6 volume**.
- Explicit pinned original `f4b36e12e2dbedd415a588b9baa2b8c65cf01f30`: ожидаемый RED по missing late-ready B45, exit1.
- Тот же control с `--patched`: **1/1 GREEN**, exit0, A55/B45 без duplicate peer writes.
- Loaded source hashes контролей проверены; production/test/helper hashes до/после неизменны.

```powershell
node --test tests/schedule-reconcile.test.cjs tests/volume-values.test.cjs
node tests/schedule-negative-control.cjs '<pinned original electron.js>'
node tests/schedule-negative-control.cjs --patched
```

Это реальные production functions/queue blocks с mocks для времени и OS/worker effects, управляемыми worker inventory results и настоящим refresh coordinator. Source tests не заменяют native/physical проверки. Подробнее — [source-verification.md](schedule-reconcile-windows-source.md).

## Unmodified packaged native VM checks

Проверка выполнялась на Windows VM build 26200.8655. Для каждого case — отдельная portable-копия, snapshot config/userData/startup, analytics=false, logging=true, openAtLogin=false, brightnessAtStartup=false, event 00:00/37, instant speed. Native modules, main/renderer/worker не подменялись.

Перед default cases WinAPI подтвердил Active/Default desktop; разрешённое малое движение мыши и возврат выполнились успешно. Все запуски зарегистрировали настоящий native `GUID_SESSION_USER_PRESENCE (0)`. Это active presence, **не lock/unlock proof**.

| Presence variant | checkTimeAtStartup | Cold implicit reconcile logs | Новый explicit main marker после второго EXE | Second exit | Итог |
|---|---:|---:|---:|---:|---|
| Default, effective true | false | 0 | 1, наблюдён через ~166ms | 0 | PASS |
| Default, effective true | true | 2 | 1, ~183ms | 0 | PASS |
| Supported setting false | false | 0 | 1, ~158ms | 0 | PASS |
| Supported setting false | true | 2 | 1, ~185ms | 0 | PASS |

Во всех **4/4 PASS** cases выполнены main/renderer startup, WMI-bridge probe OK, настоящий monitor worker, initial refresh и startup-grace completion. Затем настоящий второй EXE с `--UseTime` породил **новую** строку main после своего spawn:

```text
Time adjustment request: reconcile { explicit: true, time: '00:00', instant: false }
```

Primary оставался жив, второй процесс завершился с code0. Время в таблице — до наблюдения log chunk polling runner, не точная IPC latency. Это подтверждение production second-instance request path; baseline correlation старой сборки сюда не включалась.

Default cases не задавали override presence: packaged default=true. Отдельный supported-setting variant явно задавал false и не используется как доказательство default policy. Cold phase и second-instance phase разделены; checkTimeAtStartup=false не трактуется как запрет любых поздних genuine lifecycle requests. Два implicit request logs у true не являются доказательством двух hardware writes.

## Native readiness и программный/физический результат

В пакете присутствуют **18 native addon files**; после всех запусков их hashes неизменны. Реально исполнены native startup, power notification, WMI-bridge probe и monitor-worker inventory paths. Каждый отдельный addon/feature из 18 не прогонялся через все его API.

После каждого second-instance выполнен отдельный настоящий read-only `--List` через штатный IPC. Во всех четырёх cases: **1 display, type:none, eligible native brightness endpoints=0** при fixture без gamma/extended overrides. Raw display identifiers не включены в этот отчёт.

Программный target fixture — 37 для события 00:00; main подтвердил explicit reconcile этого события. Из-за отсутствия eligible endpoint native применение target к дисплею проверить нельзя. Значение в settings/cache, main request или успешный WMI probe **не доказывают DDC/CI/WMI brightness write/readback**. Эта граница не считается failure доставки CLI.

Initial idle2/no-worker limitation наблюдалась в pre-patch baseline и повторилась в первом final AC17 preflight: presence2 до fork блокировала старт worker. Final mandatory default cases запускались заново при active presence0; исправление initial-idle сценария этим опытом не заявляется. Physical lock/sleep/unlock/resume и reboot не выполнялись: подтверждённого unattended recovery нет, guest-controller operation упирается в encrypted-VM credential gate.

## AC17: настоящий guest monitor-power off/on

После четырёх обязательных cases выполнен один отдельный monitor-power опыт через штатный guest `SC_MONITORPOWER`, без lock/sleep/reboot API. Первый preflight получил idle2 до worker startup и истёк по readiness timeout; **power request не отправлялся**, snapshots восстановлены. После разрешённого SendInput непосредственно перед новым запуском default app достиг native readiness. Независимый wake-процесс был armed до power-off, примерно через 3 секунды отправил power-on и SendInput; Active/Default desktop и возврат курсора подтверждены.

App зарегистрировал настоящие Windows native notifications, не искусственный Electron emit или поддельный WM_POWERBROADCAST:

| Native notification | Последовательность |
|---|---|
| GUID_CONSOLE_DISPLAY_STATE | **1 → 0 → 1** |
| GUID_MONITOR_POWER_ON | **1 → 0 → 1** |
| GUID_SESSION_USER_PRESENCE | **0 → 2 → 0** |

В main log off отмечен около 18:59:31, on — 18:59:34 (локальное время VM, 2026-11-04). После presence0 виден `handleMetricsChange (GUID_SESSION_USER_PRESENCE)` и новый native refresh. Затем настоящий post-wake второй EXE дал `reconcile { explicit: true, time: '00:00', instant: false }`, exit0; read-only List снова показал type:none / eligible0. Snapshot восстановлен. Итог **PASS для OS logical monitor-power transition, metrics/refresh и post-wake CLI**. Это не proof физического DDC power, lock/unlock или sleep/resume, и не подтверждение применения brightness к панели.

## Cleanup и evidence

**Все четыре обязательных cases, успешный AC17 и blocked AC17 preflight восстановлены, cleanup failures=0.** Финально проверены 18 profile-state entries: тестовые профили снова отсутствуют, исходных профилей не было. Отдельная read-only сверка Twinkle Run/StartupApproved values успешна. Twinkle процессов осталось **0**. Все 6 runtime app.asar hashes и **108 native-addon hash checks** совпали с исходным payload; source/test snapshot по-прежнему неизменен. Blocked preflight не включён в PASS count.

Первая загрузка прервалась по 180s timeout; непроверенный partial не распаковывался. Повтор того же API download с увеличенным timeout прошёл digest verification. Финальный verifier сначала ошибочно ожидал default presence=true внутри partial config; проверка исправлена на отсутствие override плюс default из exact packaged source. Runtime cases не переисполнялись из-за этой verifier-ошибки; итоговый read-only cleanup proof успешен.

В одном из обязательных cases logger записал `Monitor thread exited (code: 1, signal: null)` уже в cleanup после принудительного завершения собственного test process tree. Это ожидаемая фаза teardown, а не незаявленный runtime failure; до cleanup наблюдались обязательные readiness/CLI markers. Loader/ABI exception tokens в reviewed обязательных trace не обнаружены.

Credential environment был только у отдельного downloader. App/test child получили Windows runtime allowlist без унаследованных GitHub tokens, BB/service variables и прочих credentials. Signed redirect URL не сохранялся и не публикуется.

Основные operational команды, выполненные только в тестовой VM:

```powershell
node sr2-runtime/runner.cjs validate patch-5770e75/native-default-manifest.json
node sr2-runtime/runner.cjs run patch-5770e75/native-default-manifest.json
node sr2-runtime/runner.cjs run patch-5770e75/native-presence-disabled-manifest.json
node sr2-runtime/runner.cjs run patch-5770e75/native-power-active-manifest.json startup-false
node patch-5770e75/verify-power-evidence.cjs
node patch-5770e75/verify-post-power-cleanup.cjs
```

Во время последнего run отдельный `run-power-probe-active.cjs` ожидал native readiness и выполнял ограниченный off/on с заранее armed recovery. Эти VM-specific команды приведены для аудита исполненного опыта; их scripts/manifests остаются local evidence и не являются новыми release interfaces.

Durable operational evidence остаётся в локальном `patch-5770e75/`: `download-proof.json`, `packaged-identity-proof.json`, `source-test-results/proof.json`, `native-runtime-summary.json`, `final-cleanup-proof.json`, `native-power-proof.json`, `post-power-cleanup-proof.json`, per-case journals и append-only runner traces. Там же portable ZIP/installer. VM-specific runner, power controller, snapshots, raw List/logs и private execution context в public fork не переносить. Физический хост не изменялся.

В этот нейтральный handoff включены только отчёты, [physical-validation-rollback.md](schedule-reconcile-physical-check.md) и небольшие существующие helpers в `verify/`: read-only asar reader и pure Windows child-environment allowlist. Production/release interface и installer policy ради runner не менялись.
