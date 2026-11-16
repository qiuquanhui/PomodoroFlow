#!/usr/bin/env node
/**
 * 逐帧拍摄：无头 Edge + CDP（Node 24 内置 WebSocket/fetch，零依赖）
 * 用法：
 *   node shoot.mjs test            # 抽样 21 帧到 .preview/ 供人工检查
 *   node shoot.mjs [fps] [dur]     # 全量拍摄到 .frames/（默认 30fps 52s）
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HTML = 'file:///' + path.join(ROOT, 'video.html').replace(/\\/g, '/');
const PORT = 9337;

const mode = process.argv[2] ?? 'full';
const FPS = mode === 'test' ? 30 : Number(process.argv[2] || 30);
const DUR = mode === 'test' ? 52 : Number(process.argv[3] || 52);
const OUTDIR = mode === 'test' ? path.join(ROOT, '.preview') : path.join(ROOT, '.frames');

const TEST_TIMES = [0.8, 2.2, 3.2, 5.0, 6.5, 7.6, 9.8, 11.4, 13.0, 15.2, 17.4, 18.2, 19.8, 22.6, 24.5, 25.5, 27.2, 29.5, 31.4, 32.5, 34.5, 36.9, 38.9, 40.5, 42.0, 43.2, 45.5, 47.0, 49.8, 50.5, 52.7, 54.0, 56.0, 60.0, 63.5];

function log(msg) { process.stdout.write(`\r[${new Date().toISOString().slice(11, 19)}] ${msg}\n`); }

async function waitForEndpoint(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page' && t.url.startsWith('file:'));
      if (page) return page;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('Edge DevTools endpoint 未就绪');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function main() {
  mkdirSync(OUTDIR, { recursive: true });

  const args = [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(ROOT, '.edge-profile')}`,
    '--window-size=1920,1080', '--force-device-scale-factor=1',
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--new-window', HTML,
  ];
  const proc = spawn(EDGE, args, { stdio: 'ignore', detached: false });
  log(`Edge PID ${proc.pid} 启动中…`);

  let cdp, page;
  try {
    page = await waitForEndpoint();
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    cdp = new CDP(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    // 等待页面就绪
    for (let i = 0; i < 40; i++) {
      const r = await cdp.send('Runtime.evaluate', { expression: 'document.readyState' });
      if (r.result.value === 'complete') break;
      await new Promise(r => setTimeout(r, 150));
    }
    await cdp.send('Runtime.evaluate', { expression: 'seek(0)' });

    let frames;
    if (mode === 'test') {
      frames = TEST_TIMES.map(t => ({ t, file: `t${String(t).replace('.', '_')}.png` }));
    } else {
      const total = Math.round(DUR * FPS);
      frames = Array.from({ length: total }, (_, i) => ({
        t: i / FPS,
        file: `f${String(i).padStart(5, '0')}.png`,
      }));
    }

    const t0 = Date.now();
    let done = 0;
    for (let i = 0; i < frames.length; i++) {
      const { t, file } = frames[i];
      const outPath = path.join(OUTDIR, file);
      if (mode !== 'test' && existsSync(outPath)) { done++; continue; } // 断点续拍
      await cdp.send('Runtime.evaluate', { expression: `seek(${t.toFixed(4)})` });
      // 等待合成器提交新帧，否则 captureScreenshot 会拿到缓存的旧帧
      await cdp.send('Runtime.evaluate', {
        expression: 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',
        awaitPromise: true,
      });
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      done++;
      if (done % 30 === 0 || done === frames.length) {
        const fps = done / ((Date.now() - t0) / 1000);
        log(`帧 ${i + 1}/${frames.length}  t=${t.toFixed(2)}s  (${fps.toFixed(1)} 帧/秒)`);
      }
    }
    log(`完成：${frames.length} 帧已写入 ${OUTDIR}`);
  } finally {
    try { proc.kill(); } catch { /* noop */ }
    try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* noop */ }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
