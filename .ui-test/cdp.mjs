import WebSocket from 'ws';
import fs from 'node:fs';

const PORT = Number(process.env.CDP_PORT || 9333);
const base = `http://127.0.0.1:${PORT}`;

async function listTargets() {
  const res = await fetch(`${base}/json/list`);
  return res.json();
}

export async function connect() {
  const targets = await listTargets();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
  await new Promise((res, rej) => {
    ws.once('open', res);
    ws.once('error', rej);
  });
  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };
  const shot = async (file, fullPage = false) => {
    let clip;
    if (fullPage) {
      const m = await send('Page.getLayoutMetrics');
      const size = m.cssContentSize;
      clip = { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 };
    }
    const r = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: fullPage,
      ...(clip ? { clip } : {}),
    });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  };
  const waitFor = async (expression, timeout = 20000, interval = 150) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(`Boolean(${expression})`)) return true;
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`timeout waiting for ${expression}`);
  };
  return { ws, send, evaluate, shot, waitFor };
}

export async function launch() {
  const { spawn } = await import('node:child_process');
  const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const dir = 'C:\\Windows\\Temp\\opencode\\chrome-cdp-profile';
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${dir}`,
    '--window-size=1600,1000',
    'about:blank',
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const t = await listTargets();
      if (t.some((x) => x.type === 'page')) return;
    } catch {}
  }
  throw new Error('chrome did not start');
}
