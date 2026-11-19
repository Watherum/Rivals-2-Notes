// Replaces electron-builder's portable launcher template with electron/portable.nsi
// (unpack next to the exe, reuse it across launches). electron-builder has no option
// for a custom portable script, so this runs before every `electron-builder` call.
const fs = require('fs')
const path = require('path')

const target = path.join(
  path.dirname(require.resolve('app-builder-lib/package.json')),
  'templates', 'nsis', 'portable.nsi'
)
const backup = target + '.orig'
const custom = path.join(__dirname, 'portable.nsi')

if (!fs.existsSync(backup)) fs.copyFileSync(target, backup)
fs.copyFileSync(custom, target)
console.log('[patch-portable-launcher] using electron/portable.nsi')
