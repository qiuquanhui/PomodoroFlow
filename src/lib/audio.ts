/**
 * 提示音：用 WebAudio 现场合成，避免携带音频素材文件。
 * - focusEnd（专注结束，进入休息）：C5-E5-G5 上行三音
 * - breakEnd（休息结束，回到专注）：E5-C5 下行双音
 */
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    return ctx
  } catch {
    return null
  }
}

/** 在用户手势中预热 AudioContext，避免自动播放策略静音。 */
export function warmAudio(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume()
}

export function playChime(kind: 'focusEnd' | 'breakEnd', volumePercent: number): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  const vol = Math.min(1, Math.max(0, volumePercent / 100)) * 0.4
  if (vol <= 0.001) return

  const t0 = c.currentTime + 0.03
  const notes: Array<{ freq: number; delay: number }> =
    kind === 'focusEnd'
      ? [
          { freq: 523.25, delay: 0 },
          { freq: 659.25, delay: 0.16 },
          { freq: 783.99, delay: 0.32 },
        ]
      : [
          { freq: 659.25, delay: 0 },
          { freq: 523.25, delay: 0.18 },
        ]

  for (const { freq, delay } of notes) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = t0 + delay
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(start)
    osc.stop(start + 0.6)
  }
}
