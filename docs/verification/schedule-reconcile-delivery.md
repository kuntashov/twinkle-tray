# Twinkle Tray: сборка для физической проверки

Статус: **READY к физической проверке с человеком**. Source, CI, VM-проверки и финальный независимый аудит evidence завершены; открытых блокирующих findings нет. Живые проверки на физическом хосте не выполнялись.

## Фиксированная сборка

- Fork: [kuntashov/twinkle-tray](https://github.com/kuntashov/twinkle-tray), ветка `fix/schedule-reconcile`.
- Build/source commit: [`5770e75b6de7a4e7ac0fda3133761f4dad888235`](https://github.com/kuntashov/twinkle-tray/commit/5770e75b6de7a4e7ac0fda3133761f4dad888235).
- База: upstream `f4b36e12e2dbedd415a588b9baa2b8c65cf01f30`, версия **1.18.0-beta2**. Это сборка на pinned upstream, а не backport в установленную 1.17.2.
- [Windows CI и artifacts](https://github.com/kuntashov/twinkle-tray/actions/runs/41847657991), attempt 1, artifact `13334340654`.
- Portable ZIP: `Twinkle.Tray.v1.18.0-beta2-portable.zip`, SHA-256 `4da512544ffd3ea309f98ee1cd5aaef80f515657fe5220ffd1dc4e15855b457f`.
- Installer: `Twinkle.Tray.v1.18.0-beta2.exe`, SHA-256 `db5fc53083a26fc2f3b946ac4d833c19e36bbba7201b6b7089fbd6d854803888`.

Размеры, outer ZIP hash и исходный manifest: [build report](schedule-reconcile-windows-build.md), [manifest](schedule-reconcile-build-manifest.json), [checksums](schedule-reconcile-build-SHA256SUMS.txt). Portable ASAR source после нормализации CRLF совпал с reviewed source: `e8b14f873a0c70f45ad15c689f94cb64462ebb4536ac1cbd613cbf0d9a2c59d0`.

## Что изменено

Один recovery owner выбирает актуальную цель после готовности inventory и повторно проверяет время, настройки, guards и intent перед фактической отправкой. Pending, принятая цель и ручная коррекция разделены по дисплеям. Старые refresh/read/transport/deferred/gamma/transition continuations не перекрывают новый intent; known restore проходит через ту же координацию.

Обычный tick и same-event recovery сохраняют ручную коррекцию non-animated расписания, включая ручной запрос до первой успешной отправки. Новый event/дата/настройки или явный `--UseTime` переоценивают цель; ручной pending до первого события непустого расписания истекает при появлении этого события. При пустом расписании standalone manual сохраняет прежнюю семантику. LERP продолжает штатные регулярные пересчёты; переноса вчерашнего события до первого сегодняшнего не добавлено.

Readiness ограничен 30 секундами после существующих задержек; валидный длинный smooth не обрывается этим deadline и не перезапускается равнозначным tick. Gamma/hardware dedup использует точные software receipts, а не один optimistic cache. Новый CLI, UI, настройки и native ACK-протокол не добавлены. Cold startup по-прежнему определяется startup-настройками. Manual overrides живут только в памяти процесса.

Основные функции в fixed source:

| Функция | Назначение |
|---|---|
| [applyCurrentAdjustmentEvent:6069](https://github.com/kuntashov/twinkle-tray/blob/5770e75b6de7a4e7ac0fda3133761f4dad888235/src/electron.js#L6069) | Existing schedule/UseTime entry |
| [reconcileBrightness:5757](https://github.com/kuntashov/twinkle-tray/blob/5770e75b6de7a4e7ac0fda3133761f4dad888235/src/electron.js#L5757) | Readiness, текущая цель, schedule/restore ownership |
| [brightnessIntentIsCurrent:5717](https://github.com/kuntashov/twinkle-tray/blob/5770e75b6de7a4e7ac0fda3133761f4dad888235/src/electron.js#L5717) | Актуальность intent/guards перед отложенной отправкой |
| [setTrackedGammaLevel:1556](https://github.com/kuntashov/twinkle-tray/blob/5770e75b6de7a4e7ac0fda3133761f4dad888235/src/electron.js#L1556), [setGammaBrightnessThrottle:3046](https://github.com/kuntashov/twinkle-tray/blob/5770e75b6de7a4e7ac0fda3133761f4dad888235/src/electron.js#L3046) | Software component acceptance, stale cancellation и dedup |

## Проверки и независимое ревью

| Gate | Проверенный результат |
|---|---|
| Source-only host / integration | Обычный изолированный Node runner **64/64 PASS**, syntax/diff clean |
| Dedicated Windows VM source | Exact snapshot **64/64 PASS**, source/tests unchanged |
| Negative control | Pinned original: конкретный missing-B45 RED; тот же control на патче GREEN |
| Independent code review | Standards, Spec и свежий final integration review: READY, открытых подтверждённых code findings нет |
| Windows Actions | npm ci, **64/64 tests**, assets, native installer, portable ZIP, manifest и upload PASS |
| Packaged VM | **4/4 native cases PASS**: startup false/true, default presence и отдельный supported variant, настоящий второй EXE и свежий main `explicit:true` marker |
| Real guest power path | Monitor power **1→0→1**, presence **0→2→0**, metrics/refresh и post-wake CLI PASS |
| Cleanup | Все 6 attempts восстановлены, процессов 0, payload/source и 108 native-addon hash checks неизменны |

Первый AC17 idle2 preflight заблокирован до power request, восстановлен и не включён в PASS count. Испытания выполнялись на активном unlocked Default desktop с заранее подготовленным wake. Lock/unlock, sleep/resume и reboot не выполнялись: unattended recovery не подтверждён, guest-controller упирается в encrypted-VM credential gate.

Подробности: [source evidence](schedule-reconcile-windows-source.md), [native VM report](schedule-reconcile-vm.md), [independent review history](schedule-reconcile-review.md), [спецификация](../../.scratch/schedule-reconcile/spec.md), [tickets](../../.scratch/schedule-reconcile/tickets.md), [решения](../autonomous-decisions/schedule-reconcile.md).

Документация результата фиксируется отдельным docs-only descendant: бинарные файлы относятся именно к build commit `5770e75…`; production source, tests и workflow после него не менялись. Private operational evidence сохранён отдельно от fork.

## Граница результата

VM обнаружила один virtual display `type:none`, eligible native brightness endpoints=0. Native startup/worker/IPC/power notifications подтверждены; **DDC/CI или WMI brightness write/readback физического монитора не доказан**. Initial-idle startup/no-worker limitation наблюдалась в baseline и blocked preflight; её исправление этой сборкой не заявляется. Software receipt не является физическим ACK.

Рабочая установка, VBS/SessionUnlock task, startup, яркость, время, драйверы и session lifecycle физического хоста не менялись. Существующий restart task способен завершить portable и запустить старую установленную копию; его изоляция относится только к отдельно согласованному физическому этапу. **Uninstall может удалить config** из-за существующего `deleteAppDataOnUninstall=true`.

Следующий этап с человеком: [короткий план DDC/WMI проверки и отката](schedule-reconcile-physical-check.md). До него выполнение остановлено. Исходные локальные analysis/handoff/VM observations сохранены отдельно; private operational snapshots, credentials и сырые machine identifiers в fork не публикуются.
