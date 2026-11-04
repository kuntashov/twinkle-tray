const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/electron.js'), 'utf8')

// These main-process declarations close in column zero. Fail loudly if a
// selected declaration disappears, rather than silently registering fewer tests.
function extractFunction(name, text = source) {
    const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(text)
    if (!match) throw new Error(`Missing production function ${name}`)
    const end = text.indexOf('\n}', match.index) + 2
    if (end < match.index) throw new Error(`Unclosed production function ${name}`)
    return text.slice(match.index, end)
}
module.exports = { source, extractFunction }
