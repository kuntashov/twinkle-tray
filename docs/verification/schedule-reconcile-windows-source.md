# Source verification: 5770e75

Проверен exact integration commit **5770e75b6de7a4e7ac0fda3133761f4dad888235** из опубликованного fork source archive. Это source-only evidence; packaged native/CLI acceptance ожидает отдельный artifact identity.

Archive: 2432390 bytes, SHA-256 `e1a6581eecacd211ffbf8bd4ecc1261a2e44e05864f989dea52f1c43064a99ba`. `src/electron.js` raw и normalized-LF SHA-256 одинаковы: **e8b14f873a0c70f45ad15c689f94cb64462ebb4536ac1cbd613cbf0d9a2c59d0**, совпадают с canonical source hash.

В Windows Node v24.19.0 выполнены неизменённые авторские tests этого snapshot. Dependencies проекта не устанавливались. Test child получил Windows runtime environment allowlist без унаследованных GitHub/service credentials.

| Проверка | Exit | Результат |
|---|---:|---|
| Ordinary suite | 0 | **64 PASS, 0 FAIL: 58 schedule + 6 volume** |
| Explicit pinned original control | 1 | **Expected RED**, 1 failed assertion: late-ready B не получил target45 |
| Тот же control с --patched | 0 | **1 PASS, 0 FAIL**, A55/B45 без duplicate peer writes |

Node runner считает параметризованные cases; число текстовых `test(` declarations само по себе не является total. Для original и patched control проверены source hashes, которые напечатал авторский test loader. Для обычного suite зафиксированы exact production source/test hashes до/после и просмотрен loader: он извлекает реальные функции из src/electron.js, включая production sender/queue blocks. Файлы source/tests не изменились.

Pinned original: commit `f4b36e12e2dbedd415a588b9baa2b8c65cf01f30`, 205983 bytes, SHA-256 `707d90e2f76ebb08d3ab477571dfa791726399de239511d0d610addc3aab7d4b`. Передавался явный путь к скачанному original; git history source archive не требуется.

Команды из распакованного exact snapshot:

```powershell
node --test tests/schedule-reconcile.test.cjs tests/volume-values.test.cjs
node tests/schedule-negative-control.cjs '<absolute pinned-original electron.js>'
node tests/schedule-negative-control.cjs --patched
```

Локальный operational driver: `node patch-5770e75/run-source-tests.cjs`. Evidence: `patch-5770e75/source-download-proof.json`, `original-source-proof.json`, `source-test-results/proof.json`, отдельные stdout/stderr для трёх процессов. В proof включены hashes production files и всех авторских test/helper files; sourceAndTestsUnchanged=true. В обычном suite actualExit=0, original control actualExit=1 по конкретному ERR_ASSERTION missing B45, patched control actualExit=0. Все три observation checks PASS.

Harness выполняет реальные production functions с mock Date/timers, monitor fixtures, управляемыми результатами worker refresh и worker/OS effects. Координатор refresh и production sender/queues выполняются из настоящего source. Он не запускает Electron bootstrap/native modules и не доказывает реальную Windows session delivery либо физический DDC/CI/WMI write/readback. Приложение этой проверки не запускалось. Real lock/reboot по-прежнему не выполнялись.

Packaged handoff ожидается из [Actions run 41847657991](https://github.com/kuntashov/twinkle-tray/actions/runs/41847657991). После artifactID/digest потребуется проверить outer→manifest→portable→asar versionBuild/canonical LF source hash, затем startup false/true, actual second EXE explicit:true marker и native readiness с default presence settings на активной VM. Baseline и superseded b697381 source results не входят в acceptance этого commit.

Для integration пригоден этот нейтральный отчёт; operational source tree, absolute-path stacks и VM snapshots остаются локально.
