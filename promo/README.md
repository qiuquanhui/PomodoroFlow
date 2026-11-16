# PomodoroFlow 产品宣传片

**成片**：`PomodoroFlow-promo.mp4` · 1920×1080 · 30fps · 65 秒 · 含原创配乐（温柔版，-16.0 LUFS）

一条纯代码生成的 motion graphics 宣传片：动画（HTML/JS 确定性时间轴）→ 逐帧截图（无头 Edge + CDP）→ ffmpeg 合成；配乐由 Node 直接合成 WAV（Rhodes 电钢琴 + 柔和垫乐 + 半拍软鼓，96 BPM 网格与画面时间轴逐点对位）。

## 分镜（65s）

| 时间 | 场景 |
|---|---|
| 0–4s | 开场钩子：通知芯片的混乱 → 冻结坠落 →「分心，正在偷走你的时间。」 |
| 4–8.75s | Logo 揭幕：红点心跳 → 圆环绘成 → PomodoroFlow 字标 + 徽章 |
| 8.75–18.75s | 计时器主打：25:00 倒计时、空格暂停、番茄完成切短休息、自定义时长、长休息预告 |
| 18.75–26.25s | 任务 × 番茄：勾选、专注会话关联、会话归档进历史 |
| 26.25–33.75s | 长期统计：14 天柱状图、今日占比环、连续天数计数、导出 CSV |
| 33.75–43.75s | 系统能力 8 连快剪：通知 / 托盘 / 全局热键 / 自启 / 双语 / 主题 / 导出 / 托盘菜单 |
| 43.75–48.75s | 轻量信任：1.4 MB 安装、离线、数据自持、零追踪 |
| 48.75–65s | 收尾：圆环完成 →「叮」→ 番茄标记 + CTA + 三阶段色点 |

## 三步重建

```bash
node make-audio.mjs        # 1. 合成配乐 audio.wav（44.1kHz 立体声）
node shoot.mjs 30 65       # 2. 无头 Edge 逐帧拍摄 .frames/（约 20 分钟）
ffmpeg -framerate 30 -i .frames/f%05d.png -i audio.wav \
  -c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart -shortest \
  PomodoroFlow-promo.mp4   # 3. 合成成片
```

改片长/分镜：编辑 `video.html` 顶部的 `CUT` 常量（全部卡在 96 BPM 的 1.25s 网格上），配乐段落时刻在 `make-audio.mjs` 中同步调整。

## 文件

- `video.html` — 动画本体；`seek(t)` 纯函数驱动每一帧，无时钟/随机依赖，逐帧渲染严格可复现
- `shoot.mjs` — CDP 逐帧拍摄（Node ≥ 21 自带 WebSocket/fetch，零依赖；截图前等待双 rAF 确保合成器提交新帧）
- `make-audio.mjs` — 配乐合成器（垫乐/鼓组/贝斯/琶音/冲击/riser/钟声，含软限幅母带）
