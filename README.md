# Neon Jump 霓虹跳跃

按住蓄力、松手起跳的竖屏单指街机小游戏。Phaser 3 + Vite + Playwright + GitHub Actions。

## 玩法
- 按住屏幕 / 鼠标 / 空格蓄力，松手起跳
- 落在下一个平台 +1，落在正中心 PERFECT +2
- 落空即结束，最高分存在本地

## 本地运行
```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # 产出 dist/
npm run preview  # 预览 dist/，http://127.0.0.1:4173
npm test         # Playwright：桌面 + iPhone 视口
```

## 部署
- **GitHub Pages（自动）**：推到 `main` 即触发 `.github/workflows/build.yml`：构建 → Playwright 测试 → 部署 Pages。首次需在仓库 Settings → Pages → Source 选 GitHub Actions。
- **Cloudflare Pages（手动直传）**：`cf-publish dist --project neon-jump`，地址 `https://neon-jump.pages.dev/`。

## 提交准备
- 微信小游戏：需另开 minigame 适配分支（Phaser 小游戏适配 + 分包），本版先定玩法与手感。
- CrazyGames：可先以无 SDK 版送审玩法，再按文档接入 SDK。
- B站 Toy：直接交 `dist/` + 封面图 + 玩法说明。

设计文档见 `DESIGN.md`。
