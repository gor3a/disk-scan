import { BrowserWindow } from 'electron'

// The brand mark (gauge ring + check), inline so the splash needs no asset files.
const MARK = `
<svg class="mark" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="em" x1="0.1" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#33A57E"/><stop offset="1" stop-color="#0F3D2E"/>
  </linearGradient></defs>
  <g transform="translate(120,120)">
    <circle r="78" fill="none" stroke="#E4DCCD" stroke-width="22"/>
    <circle r="78" fill="none" stroke="url(#em)" stroke-width="22" stroke-linecap="round"
            stroke-dasharray="382 108" transform="rotate(-90)"/>
    <path d="M-36,4 L-10,33 L39,-33" fill="none" stroke="url(#em)"
          stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden;
    -webkit-user-select:none;cursor:default}
  .card{height:100%;border-radius:20px;display:grid;place-items:center;
    background:
      radial-gradient(120% 80% at 50% -10%, rgba(31,122,92,.14), transparent 60%),
      linear-gradient(#FCF9F3,#EDE4D4);
    box-shadow:0 24px 60px -20px rgba(34,29,24,.5), inset 0 0 0 1px rgba(34,29,24,.05)}
  .wrap{text-align:center;animation:rise .6s cubic-bezier(.2,.7,.2,1) both}
  .mark{width:92px;height:92px;animation:pop .7s cubic-bezier(.2,.8,.2,1) both}
  .name{font-family:Georgia,'Times New Roman',serif;font-size:32px;color:#221D18;
    letter-spacing:.5px;margin-top:14px}
  .sub{font-family:-apple-system,system-ui,sans-serif;font-size:12px;color:#6D6357;
    margin-top:5px;letter-spacing:.4px}
  .bar{width:130px;height:3px;border-radius:2px;background:#E4DCCD;margin:20px auto 0;overflow:hidden}
  .bar i{display:block;height:100%;width:42%;border-radius:2px;background:#1F7A5C;
    animation:slide 1.15s ease-in-out infinite}
  @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes pop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}
  @keyframes slide{0%{transform:translateX(-130%)}100%{transform:translateX(330%)}}
</style></head><body><div class="card"><div class="wrap">
  ${MARK}
  <div class="name">dscan</div>
  <div class="sub">Reclaiming space…</div>
  <div class="bar"><i></i></div>
</div></div></body></html>`

// createSplash shows a small frameless branded window while the main window loads.
export function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 380,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: { contextIsolation: true },
  })
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML))
  splash.once('ready-to-show', () => splash.show())
  return splash
}
