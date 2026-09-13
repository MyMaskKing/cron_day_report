/**
 * 页面渲染：登录页 + 管理后台（服务端拼 HTML 字符串，无外部资源）
 */

/** HTML 转义 */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** ISO 时间转北京时间显示 */
export function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

const CSS = `
:root {
  --bg:#f5f6f8; --card:#fff; --text:#1f2329; --muted:#8a8f99; --line:#e5e6eb;
  --primary:#2f6bff; --primary-d:#2557d6; --danger:#e54848; --ok:#1a9c54;
  --code:#f2f3f5;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#17191d; --card:#202329; --text:#e4e6eb; --muted:#9aa0aa; --line:#33373e;
    --primary:#4c82ff; --primary-d:#3a6fe8; --danger:#f06868; --ok:#37b56f;
    --code:#2a2e35;
  }
}
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--text);
  font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
.container { max-width:760px; margin:24px auto; padding:0 16px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px;
  padding:20px; margin-bottom:16px; }
h1 { font-size:20px; margin:0 0 16px; }
h2 { font-size:16px; margin:0 0 14px; }
label { display:block; font-size:13px; color:var(--muted); margin:10px 0 4px; }
input, select { width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:6px;
  background:var(--card); color:var(--text); font-size:14px; }
input:focus, select:focus { outline:none; border-color:var(--primary); }
.row { display:flex; gap:12px; }
.row > div { flex:1; }
.btn { display:inline-block; padding:8px 16px; border:0; border-radius:6px; cursor:pointer;
  background:var(--primary); color:#fff; font-size:14px; }
.btn:hover { background:var(--primary-d); }
.btn.gray { background:transparent; color:var(--text); border:1px solid var(--line); }
.btn.danger { background:var(--danger); }
.btn.sm { padding:3px 10px; font-size:12px; }
.actions { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap; }
.topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.topbar h1 { margin:0; }
.flash { padding:10px 14px; border-radius:6px; margin-bottom:16px; font-size:13px; white-space:pre-wrap; }
.flash.ok { background:rgba(26,156,84,.12); color:var(--ok); }
.flash.err { background:rgba(229,72,72,.12); color:var(--danger); }
table { width:100%; border-collapse:collapse; font-size:13px; }
th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); vertical-align:middle; }
th { color:var(--muted); font-weight:500; }
code, .mono { font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
  background:var(--code); padding:2px 6px; border-radius:4px; font-size:12px; word-break:break-all; }
.badge { padding:1px 8px; border-radius:10px; font-size:12px; }
.badge.on { background:rgba(26,156,84,.14); color:var(--ok); }
.badge.off { background:rgba(138,143,153,.18); color:var(--muted); }
.form-inline { display:inline; }
.muted { color:var(--muted); font-size:12px; }
.copy-btn { cursor:pointer; border:1px solid var(--line); background:transparent; color:var(--muted);
  border-radius:4px; font-size:12px; padding:1px 8px; margin-left:6px; white-space:nowrap; }
.copy-btn:hover { color:var(--text); border-color:var(--primary); }
.hint { margin-top:6px; }
h3.sub { font-size:14px; margin:18px 0 6px; }
.copy-line { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:6px 0; }
.copy-line .mono { flex:1; min-width:220px; }
.guide th { width:110px; white-space:nowrap; }
.guide td .mono { display:block; }
`;

const COPY_JS = `
document.querySelectorAll('[data-copy]').forEach(function(btn){
  btn.addEventListener('click', async function(){
    try {
      await navigator.clipboard.writeText(btn.getAttribute('data-copy'));
      var old = btn.textContent; btn.textContent = '已复制';
      setTimeout(function(){ btn.textContent = old; }, 1200);
    } catch(e) {
      // 非 HTTPS/旧浏览器剪贴板不可用时，提示手工复制
      window.prompt('请手工复制：', btn.getAttribute('data-copy'));
    }
  });
});
`;

function layout(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body><div class="container">${body}</div></body></html>`;
}

/** 登录页 */
export function loginPage(error = '') {
  return layout('登录 · mailrelay', `
    <div class="card" style="max-width:360px;margin:60px auto;">
      <h1>📮 mailrelay 管理后台</h1>
      ${error ? `<div class="flash err">${esc(error)}</div>` : ''}
      <form method="post" action="/login">
        <label>用户名</label>
        <input name="username" autocomplete="username" required autofocus>
        <label>密码</label>
        <input type="password" name="password" autocomplete="current-password" required>
        <div class="actions"><button class="btn" type="submit">登录</button></div>
      </form>
    </div>`);
}

/**
 * 管理后台
 * @param {object} smtp getSmtpPublic() 脱敏后的配置
 * @param {Array} tokens token 列表
 * @param {{type?:string, text?:string}} flash 重定向带回的提示
 * @param {string} adminUsername 当前管理员用户名（回显用）
 */
export function adminPage(smtp, tokens, flash = {}, adminUsername = '', baseUrl = '') {
  const t0 = (tokens.find(t => t.enabled) || {}).token || 'mr_xxxx';
  // 一行「说明 + 可复制值」
  const copyLine = (value, label = '') => `
    <div class="copy-line">${label ? `<span class="muted" style="white-space:nowrap;">${esc(label)}</span>` : ''}
      <span class="mono">${esc(value)}</span><button type="button" class="copy-btn" data-copy="${esc(value)}">复制</button>
    </div>`;
  const tokenRows = tokens.map(t => {
    const directUrl = `${baseUrl}/send?token=${encodeURIComponent(t.token)}`;
    return `
    <tr>
      <td>${esc(t.name)}</td>
      <td><span class="mono">${esc(t.token)}</span><button type="button" class="copy-btn" data-copy="${esc(t.token)}">复制</button>
        <div class="muted hint" style="margin-top:6px;">URL 直用：</div>
        <div><span class="mono" style="font-size:11px;">${esc(directUrl)}</span><button type="button" class="copy-btn" data-copy="${esc(directUrl)}">复制</button></div>
      </td>
      <td>${t.enabled ? '<span class="badge on">启用</span>' : '<span class="badge off">停用</span>'}</td>
      <td class="muted">${esc(fmtTime(t.createdAt))}<br>${esc(fmtTime(t.lastUsedAt))}</td>
      <td style="white-space:nowrap;">
        <form class="form-inline" method="post" action="/admin/tokens/${esc(t.id)}/toggle">
          <button class="btn sm gray" type="submit">${t.enabled ? '停用' : '启用'}</button>
        </form>
        <form class="form-inline" method="post" action="/admin/tokens/${esc(t.id)}/delete"
              onsubmit="return confirm('确认删除 token「${esc(t.name)}」？使用它的调用方将立即失效。');">
          <button class="btn sm danger" type="submit">删除</button>
        </form>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px;">还没有 token，先在下面生成一个</td></tr>`;

  return layout('管理后台 · mailrelay', `
    <div class="topbar">
      <h1>📮 mailrelay 管理后台</h1>
      <form class="form-inline" method="post" action="/logout"><button class="btn sm gray" type="submit">退出登录</button></form>
    </div>
    ${flash.text ? `<div class="flash ${flash.type === 'ok' ? 'ok' : 'err'}">${esc(flash.text)}</div>` : ''}

    <div class="card">
      <h2>SMTP 发信配置</h2>
      <form method="post" action="/admin/smtp?action=save">
        <div class="row">
          <div style="flex:2;"><label>SMTP 服务器</label>
            <input name="host" value="${esc(smtp.host)}" placeholder="smtp.qq.com"></div>
          <div style="flex:1;"><label>端口</label>
            <input name="port" type="number" min="1" max="65535" value="${esc(smtp.port)}"></div>
          <div style="flex:1.4;"><label>加密方式</label>
            <select name="secure">
              <option value="true" ${smtp.secure ? 'selected' : ''}>SSL（通常 465）</option>
              <option value="false" ${!smtp.secure ? 'selected' : ''}>STARTTLS（通常 587）</option>
            </select></div>
        </div>
        <div class="row">
          <div><label>账号（完整邮箱）</label>
            <input name="user" value="${esc(smtp.user)}" placeholder="you@qq.com"></div>
          <div><label>授权码 ${smtp.hasPass ? '' : '（首次必填）'}</label>
            <input name="pass" type="password" autocomplete="new-password"
              placeholder="${smtp.hasPass ? '已设置，留空不修改' : '邮箱 SMTP 授权码，非登录密码'}"></div>
          <div><label>发件人显示名（可选）</label>
            <input name="fromName" value="${esc(smtp.fromName)}" placeholder="定时面板"></div>
        </div>
        <label style="margin-top:14px;">测试收件邮箱（仅点“发送测试邮件”时使用，不会保存配置）</label>
        <div class="row">
          <div style="flex:2;"><input name="testTo" placeholder="如 you@qq.com"></div>
          <div style="flex:1;"><button class="btn gray" type="submit"
            formaction="/admin/smtp?action=test">发送测试邮件</button></div>
        </div>
        <div class="muted hint">测试使用上方当前填写的内容；授权码框留空时沿用已保存的授权码。</div>
        <div class="actions">
          <button class="btn" type="submit">保存配置</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2>调用 Token</h2>
      <table>
        <thead><tr><th>名称</th><th>Token</th><th>状态</th><th>创建 / 最近使用</th><th>操作</th></tr></thead>
        <tbody>${tokenRows}</tbody>
      </table>
      <form method="post" action="/admin/tokens" class="row" style="margin-top:14px;">
        <div style="flex:2;"><input name="name" placeholder="新 token 名称，如：cron面板、家里NAS" required></div>
        <div style="flex:1;"><button class="btn" type="submit">＋ 生成新 token</button></div>
      </form>
    </div>

    <div class="card">
      <h2>使用教程</h2>
      <p class="muted" style="margin-top:0;">发信统一走 <b>POST</b> 请求，请求体是 JSON：<span class="mono">{"to":"收件邮箱","subject":"标题","content":"正文"}</span>（to 支持多个，用逗号分隔）。下面示例已自动填入你的地址${tokens.find(t => t.enabled) ? '和第一个启用 token' : ''}，复制后按需替换收件邮箱。</p>

      <h3 class="sub">关于纯文本 / HTML 邮件（自动识别，不用额外设置）</h3>
      <ul class="muted" style="margin:4px 0 4px 18px; line-height:1.9;">
        <li><span class="mono">content</span> 是普通文字 → 发<b>纯文本</b>邮件；</li>
        <li><span class="mono">content</span> 里含 HTML 标签（如 <span class="mono">&lt;table&gt; &lt;div&gt; &lt;br&gt;</span>）→ <b>自动按 HTML 排版发送</b>，并附带一份纯文本给不支持 HTML 的客户端；</li>
        <li>也可以显式用 <span class="mono">"html":"&lt;p&gt;...&lt;/p&gt;"</span> 字段发 HTML（此时 <span class="mono">content</span> 可留作纯文本备选）。</li>
      </ul>
      <p class="muted hint">注意：定时面板的“通用 Webhook”渠道目前会把“html 格式”自动降级成纯文本再发（面板侧行为），所以面板经 Webhook 推过来的是纯文本；若要面板直接推 HTML 邮件，需要调整面板代码。其他工具直接 POST HTML 到本服务则可正常渲染。</p>

      <h3 class="sub">方式一：只填一个 URL 就能用（最简单，推荐给只支持填 URL 的工具）</h3>
      <p class="muted" style="margin:4px 0;">把 token 直接拼在地址后面，作为该工具的请求 URL（请求方法选 POST）：</p>
      ${copyLine(`${baseUrl}/send?token=${encodeURIComponent(t0)}`)}
      <p class="muted hint">注意：这种写法 token 会出现在对方的访问记录/日志里，内网自用没问题；若经公网使用请改用方式二。上方每个 token 也都有各自的“URL 直用”可复制。</p>

      <h3 class="sub">方式二：请求头带 token（更规范，token 不进 URL）</h3>
      <p class="muted" style="margin:4px 0;">请求头加 <span class="mono">Authorization: Bearer &lt;token&gt;</span>。curl 自测：</p>
      ${copyLine(`curl -X POST '${baseUrl}/send' -H 'Authorization: Bearer ${t0}' -H 'Content-Type: application/json' -d '{"to":"you@qq.com","subject":"测试","content":"hello"}'`)}

      <h3 class="sub">方式三：接入定时面板 cron_day_report（选“通用 Webhook”渠道）</h3>
      <table class="guide">
        <tbody>
          <tr><th>URL</th><td>${copyLine(`${baseUrl}/send`)}</td></tr>
          <tr><th>请求头 JSON</th><td>${copyLine(`{"Authorization":"Bearer ${t0}","Content-Type":"application/json"}`)}</td></tr>
          <tr><th>Body 模板</th><td>${copyLine(`{"to":"you@qq.com","subject":"定时面板推送","content":"{{content}}"}`)}
            <span class="muted hint">把 you@qq.com 改成你的收件邮箱；{{content}} 原样保留（两侧双引号不能删）。</span></td></tr>
        </tbody>
      </table>
      <p class="muted hint">返回 200 并带 messageId 即发送成功；401=token 错误/停用，400=参数有误，502=SMTP 发送失败（按提示检查授权码）。</p>
    </div>

    <div class="card">
      <h2>修改管理员账号密码</h2>
      <form method="post" action="/admin/password">
        <div class="row">
          <div><label>用户名</label><input name="username" value="${esc(adminUsername)}"></div>
          <div><label>旧密码</label><input type="password" name="oldPassword" autocomplete="current-password" required></div>
        </div>
        <div class="row">
          <div><label>新密码（至少 8 位）</label>
            <input type="password" name="newPassword" autocomplete="new-password" minlength="8" required></div>
          <div><label>确认新密码</label>
            <input type="password" name="newPassword2" autocomplete="new-password" minlength="8" required></div>
        </div>
        <div class="actions"><button class="btn" type="submit">修改密码</button></div>
      </form>
    </div>
    <script>${COPY_JS}</script>`);
}
