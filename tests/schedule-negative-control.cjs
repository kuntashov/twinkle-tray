// Intentionally fails for the pinned original. Use --patched for the green control.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { source: patched } = require('./production-functions.cjs')
const { harness } = require('./schedule-harness.cjs')
const base = 'f4b36e12e2dbedd415a588b9baa2b8c65cf01f30'
const source = process.argv[2] === '--patched' ? patched
    : process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8')
    : execFileSync('git', ['show', `${base}:src/electron.js`], { encoding: 'utf8' })
console.log('Loaded electron.js SHA-256:', createHash('sha256').update(source).digest('hex'))

test('late-ready display must receive the same evening fixture target without duplicate peer writes', async () => {
    const h = harness(source)
    h.c.applyCurrentAdjustmentEvent(false, true)
    await h.settle()
    h.c.monitors.B.type = 'ddcci'
    await h.advance(6000)
    h.c.applyCurrentAdjustmentEvent(false, true)
    await h.settle()
    assert.deepEqual(h.messages.map(m => [m.id, Math.round(m.brightness)]), [['A', 55], ['B', 45]])
})
