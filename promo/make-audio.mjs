#!/usr/bin/env node
/**
 * PomodoroFlow 宣传片配乐 · 温柔版（纯代码合成，无依赖）
 * 44.1kHz / 立体声 / 16bit WAV · 65.4s · 96BPM 网格（bar=2.5s）
 * 音色：Rhodes 电钢琴 + 柔和垫乐 + 正弦贝斯 + 半拍软鼓 + 轻沙锤/响指
 * 与 video.html 的 CUT 时间轴逐点对位（揭幕 swell / 番茄完成柔叮 / 快剪响指 / 终章涌起）
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SR = 44100;
const DUR = 65.4;
const N = Math.floor(DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N);

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------- 混音工具 ---------- */
function add(startSec, sig, gain = 1, pan = 0) {
  const s = Math.floor(startSec * SR);
  if (s < 0 || s >= N) return;
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  const n = Math.min(sig.length, N - s);
  for (let i = 0; i < n; i++) { L[s + i] += sig[i] * gl; R[s + i] += sig[i] * gr; }
}

/* ---------- 滤波器（一阶） ---------- */
function lowpass(sig, cutoff) {
  const out = new Float32Array(sig.length);
  const dt = 1 / SR, rc = 1 / (TAU * cutoff), a = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < sig.length; i++) { y += a * (sig[i] - y); out[i] = y; }
  return out;
}
function highpass(sig, cutoff) {
  const out = new Float32Array(sig.length);
  const dt = 1 / SR, rc = 1 / (TAU * cutoff), a = rc / (rc + dt);
  let x0 = 0, y = 0;
  for (let i = 0; i < sig.length; i++) { y = a * (y + sig[i] - x0); x0 = sig[i]; out[i] = y; }
  return out;
}

/* ---------- 噪声 ---------- */
let noiseState = 1234567;
function rrand() { noiseState = (noiseState * 1103515245 + 12345) & 0x7fffffff; return noiseState / 0x3fffffff - 1; }
function noise(dur) { const n = Math.floor(dur * SR); const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = rrand(); return o; }

/* ---------- 包络 ---------- */
function envAD(n, a, d, curve = 3) {
  const o = new Float32Array(n); const na = Math.floor(a * SR);
  for (let i = 0; i < n; i++) {
    const at = i < na ? i / na : 1;
    const de = Math.exp(-curve * Math.max(0, i - na) / (n - na || 1) * 2.2);
    o[i] = at * de;
  }
  return o;
}
function apply(sig, env) { const o = new Float32Array(sig.length); for (let i = 0; i < sig.length; i++) o[i] = sig[i] * env[i % env.length]; return o; }

/* ---------- 振荡器 ---------- */
function osc(freq, dur, kind = 'sine', detune = 0) {
  const n = Math.floor(dur * SR), o = new Float32Array(n);
  const f = freq * (1 + detune);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    phase += f / SR;
    const p = phase % 1;
    let v;
    if (kind === 'sine') v = Math.sin(p * TAU);
    else if (kind === 'tri') v = 4 * Math.abs(p - 0.5) - 1;
    else if (kind === 'saw') v = 2 * p - 1;
    else v = p < 0.5 ? 1 : -1;
    o[i] = v;
  }
  return o;
}
function sweep(f0, f1, dur) {
  const n = Math.floor(dur * SR), o = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 * Math.pow(f1 / f0, t);
    phase += f / SR;
    o[i] = Math.sin(phase * TAU);
  }
  return o;
}

/* ---------- 乐器（温柔音色） ---------- */
/** Rhodes 风电钢琴：谐波正弦簇 + 起音叮感 + 指数衰减 + 轻微颤音 */
function epiano(freq, gain = 0.2, dur = 1.8) {
  const n = Math.floor(dur * SR), o = new Float32Array(n);
  const parts = [[1, 1], [2, 0.26], [3, 0.10], [4.01, 0.045]];
  for (const [m, g] of parts) {
    const s = osc(freq * m, dur, 'sine');
    for (let i = 0; i < n; i++) o[i] += s[i] * g;
  }
  const bell = osc(freq * 6, Math.min(0.14, dur), 'sine');
  for (let i = 0; i < bell.length && i < n; i++) o[i] += bell[i] * 0.07 * Math.exp(-i / (0.022 * SR));
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    e[i] = Math.exp(-2.4 * t / dur) * (1 + 0.10 * Math.sin(TAU * 4.2 * t));
  }
  for (let i = 0; i < n; i++) o[i] *= e[i] / 1.4;
  return { sig: o, gain };
}
/** 极柔和的垫乐和弦（慢起慢收，低通更暗） */
function padChord(freqs, dur, gain = 0.05) {
  const n = Math.floor(dur * SR);
  const o = new Float32Array(n);
  for (const f of freqs) {
    const s1 = osc(f, dur, 'saw', 0.003), s2 = osc(f, dur, 'saw', -0.003);
    const lp1 = lowpass(s1, 640), lp2 = lowpass(s2, 640);
    for (let i = 0; i < n; i++) o[i] += (lp1[i] + lp2[i]);
  }
  const e = new Float32Array(n);
  const na = Math.floor(0.9 * SR), nr = Math.floor(0.9 * SR);
  for (let i = 0; i < n; i++) {
    let v = Math.min(1, i / na) * Math.min(1, Math.max(0, (n - i) / nr));
    v *= 1 + 0.06 * Math.sin(i / SR * TAU * 0.7);
    e[i] = v;
  }
  for (let i = 0; i < n; i++) o[i] *= e[i] / freqs.length;
  return { sig: o, gain };
}
/** 正弦贝斯长音（小节头，温和托底） */
function softBass(freq, dur = 1.6, gain = 0.16) {
  const s = osc(freq / 2, dur, 'sine');
  const o = apply(s, envAD(s.length, 0.02, dur, 2.2));
  return { sig: o, gain };
}
/** 半拍软鼓（心跳感，无击打瞬态） */
function softKick(gain = 0.18) {
  const body = sweep(82, 46, 0.24);
  const o = apply(body, envAD(body.length, 0.006, 0.24, 3));
  return { sig: lowpass(o, 220), gain };
}
/** 轻沙锤 */
function shaker(gain = 0.045) {
  const n = noise(0.05);
  const hp = highpass(n, 6200);
  return { sig: apply(hp, envAD(hp.length, 0.003, 0.05, 4)), gain };
}
/** 响指（代替军鼓，非常克制） */
function snap(gain = 0.08) {
  const n = noise(0.055), hp = highpass(n, 2000), lp = lowpass(hp, 6800);
  return { sig: apply(lp, envAD(lp.length, 0.001, 0.055, 7)), gain };
}
/** 柔和铃音（谐波纯，无金属感失谐分音） */
function softDing(freq = 1318.5, gain = 0.16, dur = 2.4) {
  const n = Math.floor(dur * SR), o = new Float32Array(n);
  for (const [m, g] of [[1, 1], [2, 0.28], [3, 0.07]]) {
    const s = osc(freq * m, dur, 'sine');
    for (let i = 0; i < n; i++) o[i] += s[i] * g;
  }
  const e = envAD(n, 0.004, dur, 4.5);
  for (let i = 0; i < n; i++) o[i] *= e[i] / 1.35;
  return { sig: o, gain };
}
function tick(gain = 0.06) {
  const n = noise(0.02), hp = highpass(n, 2800);
  return { sig: apply(hp, envAD(hp.length, 0.0005, 0.02, 8)), gain };
}

/* ---------- 延迟效果（电钢琴回声） ---------- */
function delayMix(start, sig, delaySec = 0.46875, fb = 0.28, wet = 0.24, gain = 1) {
  add(start, sig, gain);
  let s = sig, g = wet;
  for (let tap = 0; tap < 3; tap++) {
    const delayed = new Float32Array(s.length + Math.floor(delaySec * SR));
    for (let i = 0; i < s.length; i++) delayed[i] = s[i];
    add(start + (tap + 1) * delaySec, delayed, gain * g, tap % 2 ? 0.22 : -0.22);
    g *= fb;
    s = delayed;
    if (g < 0.03) break;
  }
}

/* ================================================================
   作曲（与 65s 画面时间轴对位）
================================================================ */
const NOTE = m => 440 * Math.pow(2, (m - 69) / 12);
const BAR = 2.5, BEAT = 0.625, EIGHTH = 0.3125;

/* 和声：Am9 → Fmaj7 → Cmaj9 → G6/9，每和弦 2 小节 */
const CHORDS = [
  { root: NOTE(45), pad: [NOTE(57), NOTE(60), NOTE(64), NOTE(71)] }, // A2
  { root: NOTE(41), pad: [NOTE(57), NOTE(60), NOTE(65), NOTE(69)] }, // F2
  { root: NOTE(48), pad: [NOTE(55), NOTE(60), NOTE(64), NOTE(67)] }, // C3
  { root: NOTE(43), pad: [NOTE(55), NOTE(59), NOTE(62), NOTE(67)] }, // G2
];
function chordAt(t) {
  const k = Math.floor((t - 5.0) / BAR);
  if (t < 5.0) return CHORDS[0];
  return CHORDS[Math.floor(k / 2) % 4];
}

/* --- 0–5s 温暖开场：单音电钢 + 轻垫浮现 --- */
{ const p = epiano(NOTE(69), 0.16, 2.2); delayMix(0.6, p.sig, EIGHTH * 1.5, 0.3, 0.26, p.gain); }
{ const p = epiano(NOTE(64), 0.13, 2.2); delayMix(1.9, p.sig, EIGHTH * 1.5, 0.3, 0.24, p.gain); }
add(0.5, lowpass(noise(4.2), 480), 0.02); // 极轻的气息垫

/* --- 垫乐（5.0 → 63.5） --- */
for (let t = 5.0; t < 63.5; t += BAR) {
  const c = chordAt(t + 0.01);
  const g = (t < 8.75 || t >= 48.75) ? 0.062 : (t >= 43.75 && t < 48.75) ? 0.07 : 0.05;
  const p = padChord(c.pad, BAR + 1.4, g);
  add(t, p.sig, p.gain, -0.08);
}

/* --- 6.25 Logo 揭幕：温柔和弦涌起（不用冲击） --- */
[NOTE(57), NOTE(60), NOTE(64)].forEach((f, i) => {
  const p = epiano(f, 0.11, 2.6);
  delayMix(6.25 + i * 0.06, p.sig, EIGHTH * 1.5, 0.3, 0.22, p.gain);
});
add(6.35, softDing(1760, 0.05, 1.8).sig, 0.05, 0.1);

/* --- 电钢琴旋律主线（时间, MIDI 音高, 力度） --- */
const MELODY = [
  // timer 场景
  [8.75, 76, 0.15], [10.0, 79, 0.15], [11.25, 76, 0.13], [12.5, 74, 0.13],
  [13.75, 72, 0.12], [15.0, 69, 0.14], [16.25, 74, 0.12], [17.5, 76, 0.13],
  // tasks 场景
  [18.75, 69, 0.14], [20.0, 72, 0.13], [21.25, 76, 0.13], [22.5, 79, 0.14],
  [24.1, 74, 0.12], [25.6, 72, 0.11],
  // stats 场景
  [26.25, 69, 0.13], [27.5, 72, 0.12], [28.75, 76, 0.12], [30.0, 74, 0.12],
  [31.25, 67, 0.11], [32.5, 69, 0.12],
  // 快剪（稍密、保持轻）
  [33.75, 76, 0.12], [34.375, 79, 0.11], [35.0, 81, 0.12], [36.25, 79, 0.11],
  [37.5, 76, 0.11], [38.125, 74, 0.10], [38.75, 72, 0.10], [40.0, 74, 0.11],
  [41.25, 76, 0.11], [42.5, 79, 0.12],
  // trust 呼吸段（稀疏）
  [43.75, 69, 0.12], [45.0, 72, 0.12], [46.25, 76, 0.13], [47.5, 74, 0.11],
  // 终章
  [50.0, 76, 0.15], [51.25, 79, 0.14], [52.5, 81, 0.15], [53.75, 79, 0.13],
  [55.0, 76, 0.13], [56.25, 74, 0.12], [57.5, 72, 0.12], [58.75, 74, 0.12],
  [60.0, 76, 0.12], [61.25, 72, 0.10],
];
for (const [t, m, g] of MELODY) {
  const p = epiano(NOTE(m), g, 1.9);
  delayMix(t, p.sig, EIGHTH * 1.5, 0.3, 0.25, p.gain);
}

/* --- 左手：每小节头 root+五度 轻弹（10–62） --- */
for (let t = 10.0; t < 62.0; t += BAR) {
  const c = chordAt(t + 0.01);
  const p1 = epiano(c.root * 2, 0.075, 2.2);
  add(t, p1.sig, p1.gain, -0.15);
  const p2 = epiano(c.root * 3, 0.055, 2.0);
  add(t + 0.02, p2.sig, p2.gain, 0.12);
}

/* --- 正弦贝斯（小节头长音托底） --- */
for (const [a, b] of [[10.0, 37.5], [48.75, 62.5]]) {
  for (let t = a; t < b; t += BAR) {
    const c = chordAt(t + 0.01);
    const bs = softBass(c.root, 2.1, 0.15);
    add(t, bs.sig, bs.gain);
  }
}
for (let t = 37.5; t < 48.75; t += BAR * 2) {  // 呼吸段更稀
  const c = chordAt(t + 0.01);
  add(t, softBass(c.root, 3.8, 0.12).sig, 0.12);
}

/* --- 半拍软鼓（心跳感） --- */
for (const [a, b] of [[10.0, 37.5], [48.75, 62.5]]) {
  for (let t = a; t < b; t += BEAT * 2) { const k = softKick(0.17); add(t, k.sig, k.gain); }
}

/* --- 轻沙锤八分（stats 与快剪段） --- */
for (const [a, b] of [[26.25, 33.75], [33.75, 43.75]]) {
  for (let t = a; t < b; t += EIGHTH) {
    const onBeat = Math.abs(t / BEAT - Math.round(t / BEAT)) < 0.01;
    const sh = shaker(onBeat ? 0.035 : 0.05);
    add(t, sh.sig, sh.gain, 0.15);
  }
}
/* --- 快剪段：每 1.25s 切换点一个轻响指 --- */
for (let t = 33.75; t < 43.7; t += 1.25) {
  const s = snap(0.075);
  add(t + 0.625, s.sig, s.gain, -0.1);
}

/* --- 终章 48.75：C 大和弦琶音温柔涌起 --- */
[NOTE(60), NOTE(64), NOTE(67), NOTE(72)].forEach((f, i) => {
  const p = epiano(f, 0.11, 3.0);
  delayMix(48.75 + i * 0.09, p.sig, EIGHTH * 1.5, 0.3, 0.24, p.gain);
});

/* --- 提示音对位 --- */
add(15.0, softDing(1568, 0.08, 2.0).sig, 0.08, 0.08);   // 番茄完成轻叮
add(22.65, tick(0.05).sig, 0.05);                        // 勾选
add(44.9, tick(0.045).sig, 0.045);                       // 安装完成
add(50.0, softDing(1318.5, 0.16, 2.8).sig, 0.16, -0.06); // 主“叮”
add(50.04, softDing(1318.5, 0.07, 2.0).sig, 0.07, 0.25); // 声像展宽

/* ================================================================
   母带：软压缩 → 归一化 → 淡入淡出 → WAV
================================================================ */
{
  let peak = 0;
  for (let i = 0; i < N; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  if (!Number.isFinite(peak)) throw new Error('缓冲区含 NaN');
  const drive = 0.85 / Math.max(peak, 1e-6) * 0.9;
  const tanhK = 0.9; // 缓软膝，保持柔和动态
  for (let i = 0; i < N; i++) {
    L[i] = Math.tanh(L[i] * drive * tanhK) / Math.tanh(tanhK);
    R[i] = Math.tanh(R[i] * drive * tanhK) / Math.tanh(tanhK);
  }
  const fi = Math.floor(0.35 * SR);
  for (let i = 0; i < fi; i++) { const g = i / fi; L[i] *= g; R[i] *= g; }
  const f0 = Math.floor(62.6 * SR);
  for (let i = f0; i < N; i++) {
    const g = Math.max(0, 1 - (i - f0) / (N - f0));
    L[i] *= g; R[i] *= g;
  }
  let p2 = 0;
  for (let i = 0; i < N; i++) p2 = Math.max(p2, Math.abs(L[i]), Math.abs(R[i]));
  const norm = 0.84 / p2;
  for (let i = 0; i < N; i++) { L[i] *= norm; R[i] *= norm; }
}

/* 写 WAV */
{
  const bytesPerSample = 2, channels = 2;
  const dataSize = N * channels * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(buf);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, channels, true); dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * channels * bytesPerSample, true);
  dv.setUint16(32, channels * bytesPerSample, true); dv.setUint16(34, 16, true);
  wstr(36, 'data'); dv.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < N; i++) {
    dv.setInt16(off, clamp(L[i], -1, 1) * 32767, true); off += 2;
    dv.setInt16(off, clamp(R[i], -1, 1) * 32767, true); off += 2;
  }
  writeFileSync(path.join(ROOT, 'audio.wav'), Buffer.from(buf));
  console.log(`audio.wav（温柔版）完成：${DUR}s / ${SR}Hz / 立体声 / ${(44 + dataSize) / 1024 / 1024} MB`);
}
