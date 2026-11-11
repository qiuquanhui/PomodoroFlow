#!/usr/bin/env node
/**
 * 生成应用图标源图 assets/icon-source.png（1024x1024 RGBA）。
 * 纯 Node 实现（zlib 内置），无第三方依赖；随后用
 * `npx tauri icon assets/icon-source.png` 生成全套平台图标。
 *
 * 图形：番茄 + 白色表盘（3 点指针），呼应“番茄钟”。
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const S = 1024
const cx = S / 2
const cy = S / 2 + 12
const R = 356

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
// 有符号距离 -> 边缘覆盖度（约 1.5px 抗锯齿带；d<0 在形状内）
const cov = (d) => clamp01(0.5 - d / 1.5)

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// alpha 合成：src over dst
function over(dstA, dstC, srcA, srcC) {
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return [0, [0, 0, 0]]
  const outC = [0, 1, 2].map((i) => (srcC[i] * srcA + dstC[i] * dstA * (1 - srcA)) / outA)
  return [outA, outC]
}

const TOP = [246, 108, 80] // 番茄红（亮）
const BOTTOM = [212, 60, 42] // 番茄红（深）
const RIM = [188, 45, 31] // 边缘暗红
const WHITE = [255, 255, 255]
const LEAF_L = [88, 178, 106]
const LEAF_R = [58, 144, 80]

function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const t = clamp01(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby))
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
}

// 表盘几何
const ringR1 = R * 0.6
const ringR2 = R * 0.685
const halfW = 14
const minuteHand = { ax: cx, ay: cy, bx: cx, by: cy - R * 0.44 } // 分针朝上
const hourHand = { ax: cx, ay: cy, bx: cx + R * 0.3, by: cy } // 时针朝右（3 点）
const centerR = 17
// 叶子：旋转椭圆，中心压在番茄顶部
const leaf = { x: cx, y: cy - R + 26, a: 118, b: 52, rad: (-18 * Math.PI) / 180 }

const raw = Buffer.alloc(S * (S * 4 + 1)) // 每行前置 PNG filter 字节 0

for (let y = 0; y < S; y++) {
  const rowStart = y * (S * 4 + 1)
  for (let x = 0; x < S; x++) {
    let alpha = 0
    let color = [0, 0, 0]

    // 番茄主体
    const distC = Math.hypot(x - cx, y - cy)
    const aBody = cov(distC - R)
    if (aBody > 0) {
      let c = mix(TOP, BOTTOM, clamp01((y - (cy - R)) / (2 * R)))
      c = mix(c, RIM, clamp01((distC - (R - 30)) / 30) * 0.55)
      ;[alpha, color] = over(alpha, color, aBody, c)
    }

    // 叶子
    const dx = x - leaf.x
    const dy = y - leaf.y
    const lx = dx * Math.cos(leaf.rad) + dy * Math.sin(leaf.rad)
    const ly = -dx * Math.sin(leaf.rad) + dy * Math.cos(leaf.rad)
    const nd = Math.hypot(lx / leaf.a, ly / leaf.b) - 1
    const aLeaf = cov(nd * Math.min(leaf.a, leaf.b))
    if (aLeaf > 0) {
      const c = mix(LEAF_L, LEAF_R, clamp01(lx / leaf.a / 2 + 0.5))
      ;[alpha, color] = over(alpha, color, aLeaf, c)
    }

    // 白色表盘环 + 时分针 + 中心点
    const aRing = cov(Math.max(ringR1 - distC, distC - ringR2))
    const aMinute = cov(segDist(x, y, minuteHand.ax, minuteHand.ay, minuteHand.bx, minuteHand.by) - halfW)
    const aHour = cov(segDist(x, y, hourHand.ax, hourHand.ay, hourHand.bx, hourHand.by) - halfW)
    const aDot = cov(distC - centerR)
    const aWhite = Math.max(aRing, aMinute, aHour, aDot)
    if (aWhite > 0) {
      ;[alpha, color] = over(alpha, color, aWhite, WHITE)
    }

    const idx = rowStart + 1 + x * 4
    raw[idx] = Math.round(color[0])
    raw[idx + 1] = Math.round(color[1])
    raw[idx + 2] = Math.round(color[2])
    raw[idx + 3] = Math.round(alpha * 255)
  }
}

// ---- PNG 编码（RGBA8, filter 0） ----
function crc32(buf) {
  if (!crc32.table) {
    crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crc32.table[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crc32.table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type: RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const out = path.join(__dirname, '..', 'assets', 'icon-source.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, png)
console.log(`icon source written: ${out} (${png.length} bytes)`)
