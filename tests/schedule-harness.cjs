const vm = require('node:vm')
const { EventEmitter } = require('node:events')
const { source: productionSource, extractFunction } = require('./production-functions.cjs')

// Main-process declarations only. No Electron bootstrap, native module or worker runs.
function display(id, type = 'ddcci') {
    return { id, key: id, hwid: ['DISPLAY', id, 'TEST'], type, brightnessType: true,
        brightness: 80, brightnessRaw: 80, min: 0, max: 100, features: {} }
}
function harness(source = productionSource) {
    let time = new Date(2026, 10, 4, 21, 0).getTime()
    let elapsed = 0
    const messages = [], timers = new Map()
    let timerId = 0
    const clock = class extends Date {
        constructor(...args) { super(...(args.length ? args : [time])) }
        static now() { return time }
    }
    const c = {
        Date: clock, AbortController, console: { log() {}, error(...args) { throw new Error(args.join(' ')) } },
        setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms, at: elapsed + ms }); return id },
        clearTimeout(id) { timers.delete(id) },
        setInterval(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms, at: elapsed + ms, interval: true }); return id },
        clearInterval(id) { timers.delete(id) },
        settings: {
            adjustmentTimes: [
                { time: '00:00', brightness: 45, monitors: { A: 45, B: 35 } },
                { time: '06:00', brightness: 100, monitors: { A: 100, B: 100 } },
                { time: '20:00', brightness: 55, monitors: { A: 55, B: 45 } },
                { time: '22:00', brightness: 45, monitors: { A: 45, B: 35 } }
            ], adjustmentTimeIndividualDisplays: true, adjustmentTimeSpeed: 'instant',
            updateInterval: 100, remaps: {}, monitorFeatures: {}, monitorFeaturesSettings: {}
        },
        tempSettings: {}, currentProfile: false, userIdleDimmed: false, isWindowsUserIdle: false,
        recentlyWokeUp: false, isStartupGracePeriod: false, hasRecentlyInteracted: false,
        monitors: { A: display('A'), B: display('B', 'none') },
        monitorsThreadReady: true, monitorsThreadReal: Object.assign(new EventEmitter(), {
            connected: true, exitCode: null, send(data) { messages.push(data) }
        }), monitorsEventEmitter: new EventEmitter(),
        isRefreshing: false, activeCapabilitiesEnrichmentPromise: false, queuedRefreshPromise: false,
        monitorRefreshGeneration: 0, pausedMonitorUpdates: false, lastEagerUpdate: 0,
        lastCompletedRefresh: 0, shouldShowPanel: false, lastTimeEvent: false, currentTransition: null,
        deferredFeatureUpdates: new Map(), deferredLinkedFeatureUpdates: new Map(),
        brightnessThrottleTargets: new Map(), extendedMinimumPinned: new Set(),
        ignoreBrightnessEvent: false, ignoreBrightnessEventTimeout: false,
        usesGammaSlider: () => false, usesExtendedMinimum: () => false,
        shouldSkipDisplay: m => !!m.excluded,
        setTrayPercent() {}, updateKnownDisplays() {}, sendToAllWindows() {},
        applyOrder() {}, applyRemaps() {}, applyHotkeys() {},
        lightSensor: { setMonitors() {}, async resume() {} }, setIsRefreshing(value) { c.isRefreshing = value },
        refreshMonitorsJob: async () => ({ monitors: c.monitors }),
        readKnownBrightnessJob: async () => Object.fromEntries(Object.values(c.monitors).map(m => [m.id, { brightness: m.brightness }])),
        getKnownDisplays: () => ({ A: { ...display('A'), brightness: 75 }, B: { ...display('B'), brightness: 65 } }),
        reapplyGammaRamps() {}, startMonitorThread() {}, debug: { error(...args) { throw new Error(args.join(' ')) } },
        Utils: { ...require('../src/Utils'), wait: () => Promise.resolve() },
        scaleVolume: require('../src/volume-utils').scaleVolume
    }
    Object.assign(c, {
        isDev: false, restartBackgroundUpdateThrottle: false, backgroundInterval: false,
        sendMicaWallpaper() {}, checkForUpdates() {}, global: { gc() {} }
    })
    Object.assign(c, {
        powerMonitor: Object.assign(new EventEmitter(), { getSystemIdleTime: () => 0 }),
        isUserIdle: false, lastIdleTime: 1000, notIdleMonitor: false, idleMonitorBlock: false,
        preIdleMonitors: {}, preIdleScheduleIdentity: false, getIdleSettingValue: () => 60,
        isFocusedWindowFullscreen: () => false, isMediaPlaying: () => false,
        blockBadDisplays: () => ({ release() {} }),
        skipFirstMonChange: true, resumeRecoveryInProgress: false, resumeRecoveryHandled: false,
        handleChangeTimeout1: false, handleChangeTimeout2: false,
        panelSize: { visible: false }, recentlyWokeUpTimeout: false,
        setRecentlyInteracted() {}, stopMonitorThread: async () => {},
        waitForMonitorThreadReady: async () => {}, hasEnabledLinkedFeatures: () => false
    })
    Object.assign(c, {
        gammaBrightnessQueue: {}, gammaBrightnessTimeout: false, gammaBrightnessSubmissions: new Map(), hardwareBrightnessSubmissions: new Map()
    })
    for (const name of ['GAMMA_BRIGHTNESS_MIN', 'EXTENDED_MINIMUM_FLOOR_TOLERANCE',
        'EXTENDED_MINIMUM_BREAKPOINT_DEFAULT', 'EXTENDED_MINIMUM_BREAKPOINT_MAX']) {
        c[name] = Number(new RegExp(`^const ${name} = (\\d+)`, 'm').exec(source)[1])
    }
    vm.createContext(c)
    const transport = source.slice(source.indexOf('const monitorCommandsThatMutateWorkerState'), source.indexOf('let monitorsThreadReal'))
    vm.runInContext(transport, c)
    const ownerStart = source.indexOf('// Brightness intent ownership')
    if (ownerStart >= 0) vm.runInContext(source.slice(ownerStart, source.indexOf('// Get the currently applicable Time', ownerStart)), c)
    const names = ['getCurrentAdjustmentEvent', 'getNextAdjustmentEvent', 'getCurrentAdjustmentEventLERP',
        'applyCurrentAdjustmentEvent', 'refreshMonitors', 'commitRefreshedMonitors',
        'deferFeatureUpdate', 'deferLinkedFeatureUpdate', 'flushDeferredFeatureUpdates',
        'hasEnabledLinkedFeaturesForMonitor', 'applyLinkedFeatures', 'updateBrightness',
        'updateBrightnessThrottle', 'flushBrightnessThrottle', 'normalizeBrightness',
        'transitionBrightness', 'transitionlessBrightness', 'applyAnimatedBrightness',
        'setKnownBrightness', 'applyProfile', 'handleCommandLine', 'restartBackgroundUpdate', 'handleBackgroundUpdate', 'pauseMonitorUpdates',
        'idleCheckShort', 'handleMonitorChange', 'handleMetricsChange', 'clearRecentlyWokeUpLater',
        'setGammaBrightnessThrottle', 'flushGammaBrightness', 'setTrackedGammaLevel',
        'releaseExtendedMinimumRamp', 'getExtendedMinimumLevel', 'isAtExtendedMinimumFloor',
        'minMax', 'usesGammaSlider', 'canUseGammaRamp', 'usesExtendedMinimum', 'getExtendedMinimumBreakpoint',
        'sliderLevelToGammaLevel', 'gammaLevelToSliderLevel', 'usesGammaRamp', 'restoreGammaAfterReset']
    vm.runInContext(names.map(n => extractFunction(n, source)).join('\n'), c)
    const resume = source.indexOf('powerMonitor.on("resume",')
    vm.runInContext(source.slice(resume, source.indexOf('\nfunction handleMetricsChange', resume)), c)
    const suspend = source.indexOf('powerMonitor.on("suspend",')
    vm.runInContext(source.slice(suspend, source.indexOf('\nlet restartBackgroundUpdateThrottle', suspend)), c)
    async function settle() { for (let i = 0; i < 80; i++) await Promise.resolve() }
    return { c, messages, timers, settle, run: code => vm.runInContext(code, c),
        useRealReadJob() {
            const start = source.indexOf('readKnownBrightnessJob = async')
            vm.runInContext(source.slice(start, source.indexOf('\nenrichMonitorCapabilitiesJob =', start)), c)
        },
        startup() {
            const start = source.indexOf('    // Suppress only this startup interval;')
            vm.runInContext(source.slice(start, source.indexOf('    // Set startup grace period', start)), c)
        },
        setTime(...args) { time = new Date(...args).getTime() },
        async advance(ms) {
            const end = elapsed + ms
            for (let count = 0; count < 10000; count++) {
                const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
                if (!next) break
                const [id, t] = next
                time += t.at - elapsed; elapsed = t.at
                if (t.interval) t.at += t.ms; else timers.delete(id)
                t.fn(); await settle()
            }
            time += end - elapsed; elapsed = end; await settle()
        }
    }
}
module.exports = { harness, display, extractFunction }
