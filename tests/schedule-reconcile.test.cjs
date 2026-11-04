const test = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./schedule-harness.cjs')

test('partial inventory retries the current evening target without rewriting its accepted peer', async () => {
    const h = harness()
    h.c.applyCurrentAdjustmentEvent(false, true)
    await h.settle()
    h.c.monitors.B.type = 'ddcci'
    await h.advance(6000)
    h.c.applyCurrentAdjustmentEvent(false, true)
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55], ['B', 45]])
})

test('accepted gamma alone cannot complete or deduplicate a failed hardware floor', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.monitors.A.gammaBrightness = 100
    h.c.settings.extendMinimumDisplays = { A: true }
    h.c.settings.extendMinimumBreakpoints = { A: 60 }
    h.c.settings.adjustmentTimes[2].monitors.A = 30
    const send = h.c.monitorsThreadReal.send
    let failHardware = true
    let hardwareAttempts = 0
    h.c.monitorsThreadReal.send = data => {
        if (data.type === 'brightness') {
            hardwareAttempts++
            if (failHardware) throw new Error('fixture hardware floor failure')
        }
        send(data)
    }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    await h.advance(200)
    assert.deepEqual(h.messages.map(m => [m.type, Math.round(m.brightness)]), [['gamma', 60]])
    assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
    assert.equal(await h.c.updateBrightness('A', 30), false)
    assert.notEqual(h.run('manualScheduleOverrides.get("A").submitted'), true)
    assert.equal(hardwareAttempts, 2)
    failHardware = false
    assert.equal(await h.c.updateBrightness('A', 30), true)
    assert.equal(h.run('manualScheduleOverrides.get("A").submitted'), true)
    assert.deepEqual(h.messages.map(m => [m.type, Math.round(m.brightness)]), [['gamma', 60], ['brightness', 0]])
})

test('primary gamma keeps immediate submission tracking and a failed different level is reapplied', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.monitors.A.gammaBrightness = 100
    h.c.settings.extendMinimumDisplays = { A: true }
    h.c.settings.extendMinimumBreakpoints = { A: 60 }
    h.c.settings.adjustmentTimes[2].monitors.A = 30
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    await h.advance(200)
    h.c.settings.gammaAsMainSliderDisplays = { A: true }
    const send = h.c.monitorsThreadReal.send
    h.c.monitorsThreadReal.send = data => {
        if (data.type === 'gamma' && data.brightness === 80) throw new Error('fixture primary gamma failure')
        send(data)
    }
    assert.equal(await h.c.updateBrightness('A', 75), false)
    assert.equal(h.run('gammaBrightnessSubmissions.get("A").level'), 80)
    assert.equal(h.run('gammaBrightnessSubmissions.get("A").accepted'), false)
    h.c.monitorsThreadReal.send = send
    h.c.settings.gammaAsMainSliderDisplays = {}
    assert.equal(await h.c.updateBrightness('A', 45), true)
    assert.deepEqual(h.messages.map(m => [m.type, Math.round(m.brightness)]), [['gamma', 60], ['brightness', 0], ['gamma', 80]])
    assert.equal(h.run('manualScheduleOverrides.get("A").submitted'), true)
})

test('an already software-accepted extended target completes a same-valued new interval without IPC', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.monitors.A.gammaBrightness = 100
    h.c.settings.extendMinimumDisplays = { A: true }
    h.c.settings.extendMinimumBreakpoints = { A: 60 }
    h.c.settings.adjustmentTimes[2].monitors.A = 30
    h.c.settings.adjustmentTimes[3].monitors.A = 30
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    await h.advance(200)
    assert.deepEqual(h.messages.map(m => [m.type, Math.round(m.brightness)]), [['gamma', 60], ['brightness', 0]])
    h.messages.length = 0
    h.setTime(2026, 10, 4, 22, 1)
    h.c.refreshMonitorsJob = async () => ({ monitors: {
        A: { ...h.c.monitors.A, gammaBrightness: 60, brightness: 0, brightnessRaw: 0 },
        B: { ...h.c.monitors.B }
    } })
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages, [])
    assert.equal(h.run('acceptedScheduleDisplays.get("A")'), 30)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    await h.advance(6000)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages, [])
    assert.equal(h.run('brightnessRecoveryPromise'), false)
})

test('a real gamma reset cannot let a rejected old-interval restore suppress the current ramp', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.monitors.A.gammaBrightness = 100
    h.c.settings.extendMinimumDisplays = { A: true }
    h.c.settings.extendMinimumBreakpoints = { A: 60 }
    h.c.settings.adjustmentTimes[2].monitors.A = 30
    h.c.settings.adjustmentTimes[3].monitors.A = 30
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    await h.advance(200)
    assert.deepEqual(h.messages.map(m => [m.type, Math.round(m.brightness)]), [['gamma', 60], ['brightness', 0]])
    h.messages.length = 0
    h.setTime(2026, 10, 4, 22, 1)
    h.c.refreshMonitorsJob = async () => ({ monitors: {
        A: { ...h.c.monitors.A, gammaBrightness: 100, brightness: 0, brightnessRaw: 0 },
        B: { ...h.c.monitors.B }
    } })
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    await h.advance(200)
    assert.deepEqual(h.messages.map(m => [m.type, Math.round(m.brightness)]), [['gamma', 60]])
    assert.equal(h.run('acceptedScheduleDisplays.get("A")'), 30)
})

test('same-valued manual brightness replaces an unsubmitted gamma target from the old intent', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.monitors.A.gammaBrightness = 100
    h.c.settings.extendMinimumDisplays = { A: true }
    h.c.settings.extendMinimumBreakpoints = { A: 60 }
    h.c.settings.adjustmentTimes[2].monitors.A = 30
    h.c.setGammaBrightnessThrottle('A', 90)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.updateBrightness('A', 30)
    await h.advance(200)
    assert.deepEqual(h.messages.map(m => [m.type, Math.round(m.brightness)]), [['gamma', 90], ['brightness', 0], ['gamma', 60]])
    assert.equal(h.run('manualScheduleOverrides.get("A").submitted'), true)
    assert.equal(h.run('acceptedScheduleDisplays.has("A")'), false)
})

test('manual brightness without any configured schedule remains independent of the date', async () => {
    const h = harness()
    h.c.settings.adjustmentTimes = []
    h.c.monitors.B.excluded = true
    h.setTime(2026, 10, 4, 5, 59)
    h.c.isRefreshing = true
    h.c.updateBrightness('A', 70)
    h.setTime(2026, 10, 5, 6, 1)
    h.c.isRefreshing = false
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 70]])
    assert.equal(h.run('manualScheduleOverrides.size'), 0)
    assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
})

test('manual pending before the first event keeps its no-event date and settings identity', async () => {
    for (const change of ['none', 'date', 'settings']) {
        const h = harness()
        h.c.settings.adjustmentTimes.shift()
        h.c.monitors.B.excluded = true
        h.setTime(2026, 10, 4, 5, 59)
        h.c.isRefreshing = true
        h.c.updateBrightness('A', 70)
        if (change === 'date') h.setTime(2026, 10, 5, 5, 59)
        if (change === 'settings') h.c.settings.adjustmentTimes[0].monitors.A = 99
        h.c.isRefreshing = false
        await h.run('flushQueuedMonitorCommands()')
        await h.settle()
        assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), change === 'none' ? [['A', 70]] : [])
        assert.equal(h.run('manualScheduleOverrides.size'), 0)
        assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
        assert.equal(h.run('brightnessRecoveryPromise'), false)
    }
})

test('manual queued before the first event expires when that event arrives without a trigger', async () => {
    const h = harness()
    h.c.settings.adjustmentTimes.shift()
    h.c.monitors.B.excluded = true
    h.setTime(2026, 10, 4, 5, 59)
    h.c.isRefreshing = true
    h.c.updateBrightness('A', 70)
    assert.equal(h.run('manualScheduleOverrides.size'), 0)
    assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
    h.setTime(2026, 10, 4, 6, 1)
    h.c.isRefreshing = false
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 100]])
    assert.equal(h.run('brightnessRecoveryPromise'), false)
})

test('transport failure after pause-driven restore selection waits without a busy retry', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.setKnownBrightness()
    await h.settle()
    h.c.tempSettings.pauseTimeAdjustments = true
    h.c.activeCapabilitiesEnrichmentPromise = false
    h.c.refreshMonitorsJob = async () => ({ monitors: h.c.monitors })
    let attempts = 0
    h.c.monitorsThreadReal.send = () => { attempts++; throw new Error('fixture restore transport failure') }
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.equal(attempts, 1)
    assert.equal(h.messages.length, 0)
    assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
    await h.advance(30000)
    assert.equal(attempts, 1)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    assert.equal(h.run('queuedMonitorCommands.length'), 0)
})

test('pause enabled during a queued schedule send reselects permitted known restore without a new trigger', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.setKnownBrightness()
    await h.settle()
    assert.equal(h.run('queuedMonitorCommands.length'), 1)
    h.c.tempSettings.pauseTimeAdjustments = true
    h.c.activeCapabilitiesEnrichmentPromise = false
    h.c.refreshMonitorsJob = async () => ({ monitors: h.c.monitors })
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 75]])
    assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    assert.equal(h.run('queuedMonitorCommands.length'), 0)
})

test('explicit startup brightness remains enabled independently of lifecycle auto-apply settings', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    Object.assign(h.c.settings, { brightnessAtStartup: true, checkTimeAtStartup: false, disableAutoApply: true })
    h.startup()
    await h.advance(4000)
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 75]])
    assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
    h.messages.length = 0
    h.c.settings.adjustmentTimes = []
    h.c.setKnownBrightness()
    h.c.handleMonitorChange('display-added')
    await h.advance(5000)
    assert.equal(h.messages.length, 0)
    const profile = harness()
    profile.c.monitors.B.excluded = true
    Object.assign(profile.c.settings, { brightnessAtStartup: true, checkTimeAtStartup: false, disableAutoApply: true })
    profile.c.currentProfile = { setBrightness: true }
    profile.startup()
    await profile.advance(4000)
    assert.equal(profile.messages.length, 0)
})

test('inventory readiness arriving during an awaited peer send is remembered before the owner sleeps', async () => {
    const h = harness()
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(h.run('queuedMonitorCommands.length'), 1)
    h.c.commitRefreshedMonitors({ A: { ...h.c.monitors.A }, B: { ...h.c.monitors.B, type: 'ddcci' } })
    h.c.activeCapabilitiesEnrichmentPromise = false
    h.c.refreshMonitorsJob = async () => ({ monitors: h.c.monitors })
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55], ['B', 45]])
    assert.equal(h.run('brightnessRecoveryPromise'), false)
})

test('manual queued before Windows idle is not submitted while off and its target survives recovery', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.isRefreshing = true
    h.c.updateBrightness('A', 70)
    h.c.updateBrightnessThrottle('A', 25, false, true, 'volume-raw')
    h.c.isWindowsUserIdle = true
    h.c.isRefreshing = false
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.type, m.value]), [['vcp', 25]])
    assert.equal(h.run('manualScheduleOverrides.get("A").target'), 70)
    assert.notEqual(h.run('manualScheduleOverrides.get("A").submitted'), true)
    assert.equal(h.run('queuedMonitorCommands.length'), 0)
    h.c.isWindowsUserIdle = false
    h.c.setKnownBrightness()
    await h.settle()
    assert.deepEqual(h.messages.filter(m => m.type === 'brightness').map(m => [m.id, Math.round(m.brightness)]), [['A', 70]])
    assert.equal(h.run('acceptedScheduleDisplays.has("A")'), false)
})

test('paused time adjustments still permit known restoration while an active profile remains protected', async () => {
    for (const mode of ['empty', 'instant', 'animated']) {
        const h = harness()
        if (mode === 'empty') h.c.settings.adjustmentTimes = []
        h.c.settings.adjustmentTimeAnimate = mode === 'animated'
        h.c.readKnownBrightnessJob = async () => { throw new Error('paused schedules must not read an animated target') }
        h.c.monitors.B.excluded = true
        h.c.tempSettings.pauseTimeAdjustments = true
        h.c.setKnownBrightness()
        await h.settle()
        assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 75]])
        assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
        assert.equal(h.run('brightnessRecoveryPromise'), false)
        h.c.currentProfile = { setBrightness: true }
        h.c.setKnownBrightness()
        await h.settle()
        assert.equal(h.messages.length, 1)
    }
})

test('SDR and gamma primary sliders retain manual ownership through the real mode conversion', async () => {
    for (const mode of ['sdr', 'gamma']) {
        const h = harness()
        h.c.monitors.B.excluded = true
        if (mode === 'sdr') {
            h.c.monitors.A.hdr = 'active'
            h.c.monitors.A.sdrLevel = 80
            h.c.settings.sdrAsMainSliderDisplays = { A: true }
        } else {
            h.c.monitors.A.gammaBrightness = 100
            h.c.settings.gammaAsMainSliderDisplays = { A: true }
        }
        h.c.applyCurrentAdjustmentEvent()
        await h.settle()
        h.c.updateBrightness('A', 70)
        await h.settle()
        await h.advance(6000)
        h.c.applyCurrentAdjustmentEvent()
        await h.settle()
        h.c.handleCommandLine(null, [], '', ['--UseTime'])
        await h.settle()
        assert.deepEqual(h.messages.map(m => [m.type, Math.round(m.brightness)]),
            mode === 'sdr' ? [['sdr', 55], ['sdr', 70], ['sdr', 55]] : [['gamma', 64], ['gamma', 76], ['gamma', 64]])
    }
})

test('idle smooth dimming keeps usable peers moving when another current display is unsupported', async () => {
    const h = harness()
    h.c.settings.detectIdleTimeEnabled = true
    h.c.settings.idleTransitionSpeed = 1
    h.c.powerMonitor.getSystemIdleTime = () => 1000
    h.c.idleCheckShort()
    await h.advance(9000)
    assert.equal(Math.round(h.messages.at(-1).brightness), 0)
    assert.equal([...h.timers.values()].filter(t => t.interval).length, 0)
    assert.equal(h.run('manualScheduleOverrides.size'), 0)
})

test('a queued manual override expires at a new nonanimated interval even without a new trigger', async () => {
    const h = harness()
    h.c.isRefreshing = true
    h.c.updateBrightness('A', 70)
    h.setTime(2026, 10, 4, 22, 1)
    h.c.isRefreshing = false
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 45]])
})

test('real paused, rate-limited and failed refresh outcomes never consume a pending display', async () => {
    const paused = harness()
    paused.c.pauseMonitorUpdates()
    paused.c.applyCurrentAdjustmentEvent()
    await paused.settle()
    assert.equal(paused.run('acceptedScheduleDisplays.size'), 0)
    await paused.advance(200)
    assert.deepEqual(paused.messages.map(m => Math.round(m.brightness)), [55])
    paused.c.monitors.B.type = 'ddcci'
    paused.c.applyCurrentAdjustmentEvent()
    await paused.settle()
    assert.equal(paused.run('acceptedScheduleDisplays.has("B")'), false)
    await paused.advance(6000)
    paused.c.applyCurrentAdjustmentEvent()
    await paused.settle()
    assert.deepEqual(paused.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55], ['B', 45]])

    const failed = harness()
    failed.c.refreshMonitorsJob = async () => { throw new Error('fixture refresh failure') }
    failed.c.applyCurrentAdjustmentEvent()
    await failed.settle()
    assert.equal(failed.run('acceptedScheduleDisplays.size'), 0)
    failed.c.refreshMonitorsJob = async () => ({ monitors: failed.c.monitors })
    failed.c.monitorsEventEmitter.emit('ready')
    await failed.settle()
    assert.deepEqual(failed.messages.map(m => Math.round(m.brightness)), [55])
})

test('a failed software send is retryable and never accepted merely from the updated cache', async () => {
    const h = harness()
    const send = h.c.monitorsThreadReal.send
    h.c.monitorsThreadReal.send = () => { throw new Error('fixture transport failure') }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(h.run('acceptedScheduleDisplays.size'), 0)
    h.c.monitorsThreadReal.send = send
    await h.advance(6000)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55]])
})

test('pause and idle guards changing during a real queue wait prevent submission and clean ownership', async () => {
    for (const guard of [c => { c.tempSettings.pauseTimeAdjustments = true },
        c => { c.userIdleDimmed = true }, c => { c.isWindowsUserIdle = true }]) {
        const h = harness()
        h.c.refreshMonitorsJob = async () => {
            h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
            return { monitors: h.c.monitors }
        }
        h.c.applyCurrentAdjustmentEvent()
        await h.settle()
        guard(h.c)
        h.c.activeCapabilitiesEnrichmentPromise = false
        await h.run('flushQueuedMonitorCommands()')
        await h.settle()
        assert.equal(h.messages.length, 0)
        assert.equal(h.run('brightnessRecoveryPromise'), false)
    }
})

test('cold startup on and known-only startup preserve their separate settings gates', async () => {
    for (const [checkTimeAtStartup, brightnessAtStartup, expected] of [[true, false, 55], [false, true, 75]]) {
        const h = harness()
        h.c.monitors.B.excluded = true
        Object.assign(h.c.settings, { checkTimeAtStartup, brightnessAtStartup })
        h.startup()
        await h.advance(4000)
        assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [expected])
    }
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.settings.checkTimeAtStartup = false
    h.c.settings.disableOnLockScreen = true
    h.startup()
    await h.advance(4000)
    h.c.powerMonitor.emit('lock-screen')
    h.c.powerMonitor.emit('unlock-screen')
    await h.advance(7000)
    assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [55])
})

test('manual cancellation during an awaited smooth callback returns without another step or acceptance', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.settings.adjustmentTimeSpeed = 'slowest'
    h.c.applyCurrentAdjustmentEvent(false, false)
    await h.settle()
    h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
    await h.advance(1000)
    h.c.updateBrightness('A', 70)
    h.c.activeCapabilitiesEnrichmentPromise = false
    await h.run('flushQueuedMonitorCommands()')
    await h.advance(3000)
    assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [70])
    assert.equal(h.run('acceptedScheduleDisplays.has("A")'), false)
    assert.equal(h.run('pendingBrightnessTransitions.size'), 0)
    assert.equal([...h.timers.values()].filter(t => t.interval).length, 0)
    assert.equal(h.run('queuedMonitorCommands.length'), 0)
})

test('real read response correlation preserves linked overnight interpolation and cleanup', async () => {
    const h = harness()
    h.c.settings.adjustmentTimeAnimate = true
    h.c.settings.adjustmentTimeIndividualDisplays = false
    h.c.settings.adjustmentTimes[3].brightness = 40
    h.c.settings.adjustmentTimes[0].brightness = 20
    h.setTime(2026, 10, 4, 23)
    h.useRealReadJob()
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    const requestId = h.messages.find(m => m.type === 'readKnownBrightness').requestId
    h.c.monitorsEventEmitter.emit('knownBrightness', { requestId: 'obsolete', brightness: { A: { brightness: 80 } } })
    await h.settle()
    assert.equal(h.messages.filter(m => m.type === 'brightness').length, 0)
    h.c.monitorsEventEmitter.emit('knownBrightness', { requestId, brightness: { A: { brightness: 80 } } })
    await h.settle()
    assert.deepEqual(h.messages.filter(m => m.type === 'brightness').map(m => [m.id, Math.round(m.brightness)]), [['A', 30]])
    assert.equal(h.c.monitorsEventEmitter.listenerCount('knownBrightness'), 0)
})

test('read continuations completed in reverse order after worker exit cannot overwrite the new target', async () => {
    const h = harness()
    h.c.settings.adjustmentTimeAnimate = true
    h.c.monitors.B.excluded = true
    const reads = []
    h.c.readKnownBrightnessJob = () => new Promise(resolve => reads.push(resolve))
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.monitorsThreadReal.emit('exit')
    await h.settle()
    h.setTime(2026, 10, 4, 22, 1)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(reads.length, 2)
    reads[1]({ A: { brightness: 80 } })
    await h.settle()
    reads[0]({ A: { brightness: 80 } })
    await h.settle()
    assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [45])
})

test('a delayed idle return cannot restore a snapshot from before the already-accepted new event', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.preIdleMonitors = { A: { ...h.c.monitors.A, brightness: 80 } }
    h.c.preIdleScheduleIdentity = h.run('currentScheduleIdentity()')
    h.setTime(2026, 10, 4, 22, 1)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.messages.length = 0
    h.c.isUserIdle = true
    h.c.powerMonitor.getSystemIdleTime = () => 0
    h.c.idleCheckShort()
    await h.advance(4000)
    assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [45])
})

test('overlapping actual unlock, metrics and hardware callbacks coalesce to current sends once', async () => {
    const h = harness()
    h.c.monitors.B.type = 'ddcci'
    h.c.settings.disableOnLockScreen = true
    h.c.settings.hardwareRestoreSeconds = 5
    h.c.settings.idleRestoreSeconds = 7
    h.setTime(2026, 10, 4, 21, 59, 58)
    h.c.powerMonitor.emit('lock-screen')
    h.c.powerMonitor.emit('unlock-screen')
    h.c.handleMonitorChange('display-added')
    h.c.handleMetricsChange('display-metrics-changed')
    await h.advance(8000)
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 45], ['B', 35]])
})

test('a direct manual brightness request while displays are off still invalidates pending recovery', async () => {
    const h = harness()
    h.c.isWindowsUserIdle = true
    assert.equal(h.c.updateBrightness('A', 70), false)
    h.c.isWindowsUserIdle = false
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 70]])
    assert.equal(h.run('acceptedScheduleDisplays.has("A")'), false)
})

test('sendNow rechecks the interval after its own worker-ready await without a trigger', async () => {
    const h = harness()
    let resumeSend
    let first = true
    h.c.refreshMonitorsJob = async () => {
        if (first) { first = false; h.c.monitorsThreadReal.connected = false }
        return { monitors: h.c.monitors }
    }
    h.c.startMonitorThread = () => {
        h.c.monitorsThreadReal.connected = true
        h.c.monitorsThreadReady = false
    }
    h.c.Utils.wait = () => new Promise(resolve => { resumeSend = resolve })
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(typeof resumeSend, 'function')
    h.setTime(2026, 10, 4, 22, 1)
    h.c.monitorsThreadReady = true
    resumeSend()
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 45]])
})

test('a temporarily unavailable manually corrected display recovers its manual target and no schedule acceptance', async () => {
    const h = harness()
    h.c.monitors.B.featuresPending = true
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.updateBrightness('B', 70)
    assert.equal(h.run('acceptedScheduleDisplays.has("B")'), false)
    h.c.monitors.B.type = 'ddcci'
    h.c.monitors.B.featuresPending = false
    h.c.commitRefreshedMonitors(h.c.monitors)
    await h.settle()
    await h.advance(6000)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55], ['B', 70]])
    assert.equal(h.run('acceptedScheduleDisplays.has("B")'), false)
})

test('animated read failure and a superseded read cannot submit; the next regular tick can', async () => {
    const h = harness()
    h.c.settings.adjustmentTimeAnimate = true
    h.c.readKnownBrightnessJob = async () => { throw new Error('fixture read failure') }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(h.messages.length, 0)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    let finish
    h.c.readKnownBrightnessJob = () => new Promise(resolve => { finish = resolve })
    await h.advance(6000)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.updateBrightness('A', 70)
    finish({ A: { brightness: 80 } })
    await h.settle()
    assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [70])
    h.c.readKnownBrightnessJob = async () => ({ A: { brightness: 70 } })
    await h.advance(6000)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [70, 50])
})

test('full dates, backwards time and the next interval expire manual overrides', async () => {
    for (const [initial, next, target] of [
        [[2026, 10, 4, 21], [2026, 11, 4, 21], 55],
        [[2026, 10, 4, 22, 30], [2026, 10, 4, 21], 55],
        [[2026, 10, 4, 21], [2026, 10, 5, 0], 45],
        [[2026, 10, 4, 21], [2026, 10, 4, 22], 45]
    ]) {
        const h = harness()
        h.c.monitors.B.excluded = true
        h.setTime(...initial)
        h.c.applyCurrentAdjustmentEvent()
        await h.settle()
        h.c.updateBrightness('A', 70)
        await h.settle()
        h.messages.length = 0
        h.setTime(...next)
        h.c.applyCurrentAdjustmentEvent()
        await h.settle()
        assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [target])
    }
})

test('before the first event today there is no previous-day carry', async () => {
    const h = harness()
    h.c.settings.adjustmentTimes.shift()
    h.c.monitors.B.excluded = true
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.messages.length = 0
    h.setTime(2026, 10, 5, 0, 5)
    assert.equal(h.c.applyCurrentAdjustmentEvent(), false)
    await h.settle()
    assert.equal(h.messages.length, 0)
    h.setTime(2026, 10, 5, 6)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [100])
})

test('actual refresh generations reject an old completion after replacement-worker recovery', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    const jobs = []
    h.c.refreshMonitorsJob = () => new Promise(resolve => jobs.push(resolve))
    h.c.applyCurrentAdjustmentEvent()
    h.c.monitorsThreadReal.emit('exit')
    await h.settle()
    h.c.isRefreshing = false
    h.setTime(2026, 10, 4, 22, 1)
    h.c.applyCurrentAdjustmentEvent()
    assert.equal(jobs.length, 2)
    jobs[1]({ monitors: h.c.monitors })
    await h.settle()
    jobs[0]({ monitors: h.c.monitors })
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 45]])
    assert.equal(h.c.monitorsThreadReal.listenerCount('exit'), 0)
})

test('manual throttle invalidates queued brightness immediately while standalone volume still executes', async () => {
    const h = harness()
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.updateBrightnessThrottle('A', 70)
    h.c.updateBrightnessThrottle('A', 75)
    h.c.updateBrightnessThrottle('A', 20, false, true, 'volume-raw')
    h.c.activeCapabilitiesEnrichmentPromise = false
    h.c.refreshMonitorsJob = async () => ({ monitors: h.c.monitors })
    await h.run('flushQueuedMonitorCommands()')
    await h.advance(100)
    assert.deepEqual(h.messages.map(m => m.type === 'vcp' ? ['volume', m.value] : [m.id, Math.round(m.brightness)]),
        [['volume', 20], ['A', 75]])
    h.c.monitors.B.type = 'ddcci'
    h.c.commitRefreshedMonitors(h.c.monitors)
    await h.settle()
    assert.deepEqual(h.messages.filter(m => m.type === 'brightness').map(m => [m.id, Math.round(m.brightness)]), [['A', 75], ['B', 45]])
})

test('readiness cancellation removes listeners from the actual dedicated brightness read', async () => {
    const h = harness()
    h.c.settings.adjustmentTimeAnimate = true
    h.useRealReadJob()
    h.c.refreshMonitorsJob = () => new Promise(resolve => h.c.setTimeout(() => resolve({ monitors: h.c.monitors }), 10000))
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    await h.advance(10000)
    assert.equal(h.c.monitorsEventEmitter.listenerCount('knownBrightness'), 1)
    await h.advance(20000)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    assert.equal(h.c.monitorsEventEmitter.listenerCount('knownBrightness'), 0)
    assert.equal(h.c.monitorsThreadReal.listenerCount('exit'), 0)
})

test('readiness timeout releases unsent owned transport commands', async () => {
    const h = harness()
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(h.run('queuedMonitorCommands.length'), 1)
    await h.advance(30000)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    assert.equal(h.run('queuedMonitorCommands.length'), 0)
    assert.equal(h.messages.length, 0)
})

test('real resume starts a smooth target after the wake delay without cancelling it on its own wake flag', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.settings.wakeRestoreSeconds = 1
    h.c.settings.adjustmentTimeSpeed = 'slowest'
    h.c.Utils.wait = ms => new Promise(resolve => h.c.setTimeout(resolve, ms))
    h.c.powerMonitor.emit('resume')
    await h.settle()
    await h.advance(2000)
    assert.equal(Math.round(h.messages.at(-1)?.brightness), 79)
    await h.advance(24000)
    assert.equal(Math.round(h.messages.at(-1).brightness), 55)
    assert.equal(h.run('acceptedScheduleDisplays.get("A")'), 55)
})

test('current visibility settings are checked after the transport wait', async () => {
    const h = harness()
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.settings.hideDisplays = { A: true, B: true }
    h.c.activeCapabilitiesEnrichmentPromise = false
    h.c.refreshMonitorsJob = async () => ({ monitors: h.c.monitors })
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.equal(h.messages.length, 0)
    assert.equal(h.run('acceptedScheduleDisplays.has("A")'), false)
})

test('real resume callback bounds readiness to one deadline after the existing wake delay', async () => {
    const h = harness()
    h.c.settings.wakeRestoreSeconds = 1
    h.c.pausedMonitorUpdates = true
    h.c.Utils.wait = ms => new Promise(resolve => h.c.setTimeout(resolve, ms))
    h.c.powerMonitor.emit('resume')
    await h.settle()
    await h.advance(31001)
    assert.equal(h.c.resumeRecoveryInProgress, false)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    assert.equal(h.c.monitorsEventEmitter.listenerCount('ready'), 0)
    assert.equal(h.messages.length, 0)
})

test('an empty current inventory remains pending until a completed usable inventory arrives', async () => {
    const h = harness()
    const ready = h.c.monitors.A
    h.c.monitors = {}
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(h.messages.length, 0)
    h.c.commitRefreshedMonitors({ A: ready })
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55]])
})

test('extended-minimum gamma delayed behind its throttle cannot send an expired schedule ramp', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.monitors.A.gammaBrightness = 100
    h.c.settings.extendMinimumDisplays = { A: true }
    h.c.settings.extendMinimumBreakpoints = { A: 60 }
    h.c.setGammaBrightnessThrottle('A', 90)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.setTime(2026, 10, 4, 22, 1)
    // Execute the queued gamma flush at the new clock without a new schedule trigger.
    h.c.flushGammaBrightness()
    await h.settle()
    await h.advance(200)
    assert.ok(!h.messages.some(m => m.type === 'gamma' && Math.round(m.brightness) === 93))
    assert.equal(Math.round(h.messages.filter(m => m.type === 'gamma').at(-1).brightness), 80)
})

test('late saved known brightness cannot overwrite the schedule already accepted in this interval', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.messages.length = 0
    h.c.setKnownBrightness()
    await h.settle()
    assert.deepEqual(h.messages.map(m => Math.round(m.brightness)), [55])
})

test('profile changes at the queued send boundary stop automatic writes and release ownership', async () => {
    const h = harness()
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.currentProfile = { setBrightness: true }
    h.c.activeCapabilitiesEnrichmentPromise = false
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.equal(h.messages.length, 0)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    h.c.setKnownBrightness()
    await h.settle()
    assert.equal(h.messages.length, 0)
})

test('an awaited peer submission cannot give the next display a stale target with a fresh identity', async () => {
    const h = harness()
    h.c.monitors.B.type = 'ddcci'
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.setTime(2026, 10, 4, 22, 1)
    h.c.activeCapabilitiesEnrichmentPromise = false
    h.c.refreshMonitorsJob = async () => ({ monitors: h.c.monitors })
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 45], ['B', 35]])
})

test('newly-ready inventory event retries immediately even when a second refresh is rate-limited', async () => {
    const h = harness()
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.monitors.B.type = 'ddcci'
    h.c.commitRefreshedMonitors(h.c.monitors)
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55], ['B', 45]])
})

test('idle dimming and return restore the pre-idle target without creating a manual zero override', async () => {
    const h = harness()
    h.c.monitors.B.excluded = true
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.settings.detectIdleTimeEnabled = true
    h.c.settings.idleRestoreSeconds = 4
    h.c.isUserIdle = true
    h.c.preIdleMonitors = { A: { ...h.c.monitors.A, brightness: 55 } }
    h.c.powerMonitor.getSystemIdleTime = () => 1000
    h.c.idleCheckShort()
    await h.settle()
    assert.equal(Math.round(h.messages.at(-1).brightness), 0)
    h.c.powerMonitor.getSystemIdleTime = () => 0
    h.c.idleCheckShort()
    await h.advance(4000)
    assert.equal(Math.round(h.messages.at(-1).brightness), 55)
    assert.equal(h.run('manualScheduleOverrides.has("A")'), false)
})

test('cold startup off does not force the current interval; the next interval remains eligible', async () => {
    const h = harness()
    h.c.settings.checkTimeAtStartup = false
    h.startup()
    await h.advance(4000)
    assert.equal(h.messages.length, 0)
    h.setTime(2026, 10, 4, 22, 1)
    h.c.handleBackgroundUpdate()
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 45]])
})

test('case-insensitive running-instance UseTime expires overrides and remains guarded', async () => {
    const h = harness()
    h.c.updateBrightness('A', 70)
    await h.settle()
    h.messages.length = 0
    h.c.handleCommandLine(null, [], '', ['--uSeTiMe'])
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55]])
    h.c.tempSettings.pauseTimeAdjustments = true
    h.c.handleCommandLine(null, [], '', ['--UseTime'])
    await h.settle()
    assert.equal(h.messages.length, 1)
})

test('animated brightness is recalculated after the real read wait and excludes unreadable displays', async () => {
    const h = harness()
    h.c.settings.adjustmentTimeAnimate = true
    h.c.monitors.B.type = 'ddcci'
    let finishRead
    h.c.readKnownBrightnessJob = () => new Promise(resolve => { finishRead = resolve })
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(typeof finishRead, 'function')
    h.setTime(2026, 10, 4, 21, 30)
    finishRead({ A: { brightness: 80 } })
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 48]])
    assert.equal(h.run('acceptedScheduleDisplays.has("B")'), false)
})

test('a valid smooth transition outlives readiness timeout and equivalent recovery without restarting', async () => {
    const h = harness()
    h.c.settings.adjustmentTimeSpeed = 'slowest'
    h.c.settings.adjustmentTimes[2].monitors.A = 0
    h.c.applyCurrentAdjustmentEvent(false, false)
    await h.settle()
    assert.equal(h.messages.length, 0, 'smooth must not be an instant write')
    await h.advance(31000)
    assert.equal(Math.round(h.messages.at(-1).brightness), 49)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    assert.equal(h.run('acceptedScheduleDisplays.has("A")'), false)
    h.c.applyCurrentAdjustmentEvent(false, false)
    h.c.setKnownBrightness(false, true)
    await h.settle()
    await h.advance(49000)
    assert.equal(Math.round(h.messages.at(-1).brightness), 0)
    assert.equal([...h.timers.values()].filter(t => t.interval).length, 0)
    assert.equal(h.run('acceptedScheduleDisplays.get("A")'), 0)
})

test('same-interval known restoration uses the latest manual target and shares schedule ownership', async () => {
    const h = harness()
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    h.c.updateBrightness('A', 70)
    h.messages.length = 0
    await h.advance(6000)
    h.c.setKnownBrightness()
    h.c.applyCurrentAdjustmentEvent(true, false)
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 70]])
})

test('a skipped refresh waits for readiness and cleans up on timeout or worker exit', async () => {
    const h = harness()
    h.c.monitorsThreadReady = false
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(h.messages.length, 0)
    h.c.monitorsThreadReady = true
    h.c.monitorsEventEmitter.emit('ready', { type: 'ready' })
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55]])
    await h.advance(30000)
    assert.equal(h.run('brightnessRecoveryPromise'), false)
    assert.equal(h.c.monitorsEventEmitter.listenerCount('ready'), 0)
    assert.equal(h.c.monitorsThreadReal.listenerCount('exit'), 0)
    h.c.monitors.B.type = 'ddcci'
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55], ['B', 45]])
})

test('obsolete deferred brightness and linked effects cannot overwrite a newer manual intent', async () => {
    const h = harness()
    h.c.monitors.B.featuresPending = true
    h.c.updateBrightness('B', 20)
    h.c.monitors.B.type = 'ddcci'
    h.c.monitors.B.featuresPending = false
    h.c.updateBrightness('B', 70)
    h.c.settings.monitorFeaturesSettings.A = { '0x12': { linked: true } }
    h.c.settings.monitorFeatures.A = { '0x12': true }
    h.c.monitors.A.features = { '0x12': [80, 100] }
    h.c.monitors.A.featuresPending = true
    h.c.updateBrightness('A', 30)
    h.c.monitors.A.featuresPending = false
    h.c.updateBrightness('A', 60)
    h.c.flushDeferredFeatureUpdates()
    await h.settle()
    assert.deepEqual(h.messages.map(m => m.type === 'vcp' ? ['contrast', m.value] : [m.id, Math.round(m.brightness)]),
        [['B', 70], ['A', 30], ['A', 60], ['contrast', 60]])
})

test('the actual queued sender drops an expired interval without an intervening trigger', async () => {
    const h = harness()
    h.c.refreshMonitorsJob = async () => {
        h.c.activeCapabilitiesEnrichmentPromise = new Promise(() => {})
        return { monitors: h.c.monitors }
    }
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.equal(h.messages.length, 0)
    h.setTime(2026, 10, 4, 22, 1)
    h.c.activeCapabilitiesEnrichmentPromise = false
    h.c.refreshMonitorsJob = async () => ({ monitors: h.c.monitors })
    await h.run('flushQueuedMonitorCommands()')
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 45]])
})

test('manual brightness before first acceptance survives pending recovery and the next tick', async () => {
    const h = harness()
    let complete
    h.c.refreshMonitorsJob = () => new Promise(resolve => { complete = resolve })
    h.c.applyCurrentAdjustmentEvent()
    h.c.updateBrightness('A', 70)
    complete({ monitors: h.c.monitors })
    await h.settle()
    h.c.refreshMonitorsJob = async () => ({ monitors: h.c.monitors })
    await h.advance(6000)
    h.c.applyCurrentAdjustmentEvent()
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, m.brightness]), [['A', 70]])
})
