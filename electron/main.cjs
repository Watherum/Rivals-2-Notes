const { app, Tray, Menu, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

app.setName('RoA2 Notes')

// Prevent any default window from opening
app.on('window-all-closed', () => {})

let tray = null
let serverProcess = null
let serverPort = null

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: serverPort ? 'Open RoA2 Notes' : 'Starting…',
      enabled: !!serverPort,
      click() {
        shell.openExternal(`http://localhost:${serverPort}`)
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click() {
        app.quit()
      },
    },
  ])
}

app.whenReady().then(() => {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'public', 'logos', 'RIVALS_2_LOGO_MAIN.png')
    : path.join(__dirname, '..', 'public', 'logos', 'RIVALS_2_LOGO_MAIN.png')

  tray = new Tray(iconPath)
  tray.setToolTip('RoA2 Notes')
  tray.setContextMenu(buildMenu())

  // With asar:false, __dirname is a real path in both packaged and dev modes
  const serverScript = path.join(__dirname, '..', 'server.js')

  const dataDir = app.isPackaged
    ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath))
    : path.join(__dirname, '..')

serverProcess = spawn(process.execPath, [serverScript], {
    cwd: dataDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DATA_DIR: dataDir },
  })

  serverProcess.stdout.on('data', (data) => {
    const text = data.toString()
    const match = text.match(/http:\/\/localhost:(\d+)/)
    if (match && !serverPort) {
      serverPort = match[1]
      tray.setContextMenu(buildMenu())
      // Auto-open on first launch
      shell.openExternal(`http://localhost:${serverPort}`)
    }
  })

  serverProcess.stderr.on('data', (data) => {
    console.error('[server]', data.toString())
  })

  serverProcess.on('exit', () => app.quit())
})

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill()
})
