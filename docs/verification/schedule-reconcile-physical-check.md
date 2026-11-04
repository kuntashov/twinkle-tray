# Будущая физическая проверка и откат — только после opt-in

Этот план не выполнялся. Текущая работа ограничена Windows VM; физическая машина, её приложение, яркость, scripts/tasks и startup не меняются.

Перед будущим согласованным опытом зафиксировать exact source commit, CI run и SHA-256 устанавливаемого ZIP/EXE. Сохранить проверенную копию существующей установки, её version/hash, settings, known-display state и startup registry values с типами. Отдельно сохранить содержимое и hash SessionUnlock script, экспорт task XML с enabled/trigger/action/settings; private paths/IDs и credentials хранить только в защищённом локальном snapshot, не в общем отчёте. Подготовить доступный способ unlock/sign-in и отката до любых изменений.

В текущем build config установлено `build.nsis.deleteAppDataOnUninstall=true`: **uninstall может удалить settings и known-displays**. До любого будущего opt-in uninstall обязателен проверенный отдельный backup всего config/userData; копия установленного EXE или старый installer его не заменяют. Предпочтительный первый опыт — сохранить старую установку без изменений и её исходный installer, после отдельного разрешения gracefully завершить старое приложение и проверить portable build с snapshot/restore config/userData/startup. Installer policy ради теста не менять. Сейчас никаких uninstall, quit старого приложения или изменений физической машины не выполняется.

Существующий SessionUnlock restart script завершает процессы по имени EXE и запускает прежнюю установленную копию. Он может завершить и тестовый portable и подменить проверяемый build старой установкой. Поэтому будущий контролируемый unlock-опыт требует отдельно согласованной изоляции этого restart task: сначала экспорт/backup, затем временное исключение его влияния, после опыта точное восстановление исходного enabled state. Поведение с исходным restart task проверяется отдельно. Сейчас task/script не менялись. Ручные overrides патча хранятся в памяти процесса и не обещают сохранение через внешний принудительный restart.

Проверять внешний DDC/CI монитор и внутренний WMI display раздельно. Для каждого отметить время, выбранное событие, ожидаемую/прочитанную яркость и результат write/readback; имена и hardware IDs заменить aliases. Не считать cached slider или worker send доказательством физической записи.

Минимальная последовательность после разрешения:

1. Применение текущего события в ready состоянии; отдельно cold start и второй процесс UseTime, baseline checkTimeAtStartup true/false.
2. Lock/unlock через границу события; sleep/resume через границу события. Собрать реальные Windows/Electron event timestamps, readiness, production sender/queue trace и физический readback после готовности.
3. Partial readiness двух дисплеев: поздно готовый дисплей получает актуальный target; старый refresh/known-brightness restore не возвращает прежний target.
4. Ручная коррекция в том же событии, повторный tick/same-event и переход к следующему событию — согласно заранее принятой override policy. Отдельно проверить instant/smooth/LERP и pause/profile/idle guards.

Остановить опыт при неожиданном затемнении/частых writes, потере доступа к сеансу, необработанных ошибках worker или изменении несвязанных startup/tasks. Сохранить evidence до rollback. Завершить только тестовый процесс, вернуть прежнюю установку и settings/known state, восстановить ровно исходные startup values, SessionUnlock script и task XML/enabled state, если они изменялись в рамках opt-in. Сверить hashes и основные параметры task, затем проверить прежний режим работы. Не включать автоматически task/startup, которые исходно были отключены или отсутствовали; не удалять snapshot до подтверждения восстановления.

Итог различает: логическое применение события, native request/ack и физический readback. Успех VM/fixture не переносится автоматически на DDC/CI или WMI hardware.
