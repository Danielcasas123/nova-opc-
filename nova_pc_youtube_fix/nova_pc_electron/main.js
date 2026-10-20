const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');

let localServer;

function isWebUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; }
  catch { return false; }
}

function startLocalServer() {
  const root = __dirname;
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
  };
  return new Promise((resolve, reject) => {
    localServer = http.createServer((req, res) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
      catch { res.writeHead(400); return res.end('Bad request'); }
      if (pathname === '/') pathname = '/index.html';
      const filePath = path.resolve(root, '.' + pathname);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        res.writeHead(403); return res.end('Forbidden');
      }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, {
          'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store'
        });
        res.end(data);
      });
    });
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', () => {
      const address = localServer.address();
      resolve(`http://127.0.0.1:${address.port}/`);
    });
  });
}

async function createWindow() {
  const startUrl = await startLocalServer();
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 850,
    minHeight: 600,
    title: 'Nova PC',
    backgroundColor: '#090b15',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  // Serve the app over localhost rather than file:// so embedded YouTube
  // receives a normal HTTP referrer, required by some player configurations.
  await win.loadURL(startUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  await createWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});
app.on('window-all-closed', () => {
  if (localServer) localServer.close();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => { if (localServer) localServer.close(); });
