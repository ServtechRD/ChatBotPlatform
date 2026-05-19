# ChatBot Platform UI

React 18 前端，使用 [Vite 6](https://vite.dev/) 建置。

## 開發

```bash
npm install
npm run dev
```

開發伺服器預設：`http://localhost:36000`

API 與 WebSocket 在開發模式下由 Vite proxy 轉發，目標主機見 `.env.development` 的 `PROXY_TARGET`。

## 建置與預覽

```bash
npm run build      # 產出 dist/
npm run preview    # 預覽 production build
npm run serve:prod # 以 serve 靜態服務 dist（port 3000）
```

## 環境變數

- 前端可讀變數需 `VITE_` 前綴，使用 `import.meta.env.VITE_*`
- `PROXY_TARGET` 僅供 `vite.config.js`（dev proxy），不會注入瀏覽器
- 範例見 [.env.example](.env.example)

## 指令對照（原 CRA）

| CRA | Vite |
|-----|------|
| `npm start` | `npm run dev` 或 `npm start` |
| `npm run build` → `build/` | `npm run build` → `dist/` |
