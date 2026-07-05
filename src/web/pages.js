/**
 * 页面组装：登录、仪表盘、超管用户管理
 * 各功能模块页面（monitor/fund/weight）将在后续阶段补充
 */

import { renderPage, renderTopbar } from './layout.js';
import { LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS } from './assets.js';

/** 初始化超管页 */
function setupPage() {
  const body = `<div class="login-wrap">
    <div class="card">
      <h1>🔧 系统初始化</h1>
      <p class="muted" style="text-align:center;margin-bottom:16px;">创建第一个超级管理员账号</p>
      <div id="msg" class="msg"></div>
      <form id="setupForm">
        <label>超管用户名 (3-32位)</label>
        <input id="su" autocomplete="username" required>
        <label>密码 (至少6位)</label>
        <input id="sp" type="password" autocomplete="new-password" required>
        <div id="tokenField" style="display:none;">
          <label>初始化令牌 (ADMIN_BOOTSTRAP_TOKEN)</label>
          <input id="st" autocomplete="off">
        </div>
        <button class="btn" style="width:100%;" type="submit">创建超管</button>
      </form>
    </div>
  </div>`;
  return renderPage({ title: '系统初始化', body, script: SETUP_JS });
}

/** 登录 / 注册页 */
function loginPage() {
  const body = `<div class="login-wrap">
    <div class="card">
      <h1>🚀 控制台登录</h1>
      <div id="msg" class="msg"></div>
      <div class="row" style="margin-bottom:16px;">
        <button id="tabLogin" class="btn">登录</button>
        <button id="tabReg" class="btn gray">注册</button>
      </div>
      <form id="loginForm">
        <label>用户名</label>
        <input id="lu" autocomplete="username" required>
        <label>密码</label>
        <input id="lp" type="password" autocomplete="current-password" required>
        <button class="btn" style="width:100%;" type="submit">登录</button>
      </form>
      <form id="regForm" style="display:none;">
        <label>用户名 (3-32位)</label>
        <input id="ru" required>
        <label>密码 (至少6位)</label>
        <input id="rp" type="password" required>
        <button class="btn" style="width:100%;" type="submit">注册</button>
      </form>
    </div>
  </div>`;
  return renderPage({ title: '登录', body, script: LOGIN_JS });
}

/** 仪表盘 */
function dashboardPage(user) {
  const body = renderTopbar(user, 'dashboard') + `<div class="container">
    <div class="card">
      <h2 id="welcome">仪表盘</h2>
      <p class="muted">选择上方导航进入各功能模块。</p>
    </div>
    <div class="card">
      <h2>功能入口</h2>
      <div class="grid-stats">
        <a class="stat" href="/monitor"><div class="num">⏰</div><div class="lbl">定时任务</div></a>
        <a class="stat" href="/fund"><div class="num">📈</div><div class="lbl">基金追踪</div></a>
        <a class="stat" href="/weight"><div class="num">⚖️</div><div class="lbl">体重曲线</div></a>
        ${user.role === 'admin' ? '<a class="stat" href="/admin"><div class="num">👥</div><div class="lbl">用户管理</div></a>' : ''}
      </div>
    </div>
  </div>`;
  return renderPage({ title: '仪表盘', body, script: DASHBOARD_JS });
}

/** 超管用户管理页 */
function adminPage(user) {
  const body = renderTopbar(user, 'admin') + `<div class="container">
    <div class="card">
      <h2>全部用户</h2>
      <table>
        <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody id="userTbody"></tbody>
      </table>
    </div>
    <div class="card" id="detail" style="display:none;"></div>
  </div>`;
  return renderPage({ title: '用户管理', body, script: ADMIN_JS });
}

/** 定时任务管理页 */
function monitorPage(user) {
  const body = renderTopbar(user, 'monitor') + `<div class="container">
    <div class="card">
      <h2>监控任务
        <button class="btn sm" id="tNew" style="float:right;margin-left:8px;">+ 新建任务</button>
        <button class="btn sm gray" id="runNow" style="float:right;">立即执行全部</button>
      </h2>
      <table>
        <thead><tr><th>名称</th><th>URL</th><th>格式</th><th>通知渠道</th><th>状态</th><th>操作</th></tr></thead>
        <tbody id="taskTbody"></tbody>
      </table>
    </div>

    <div class="card" id="taskFormWrap" style="display:none;">
      <h2>任务编辑</h2>
      <input type="hidden" id="tId">
      <label>任务名称</label><input id="tName">
      <label>URL</label><input id="tUrl" placeholder="https://...">
      <div class="row">
        <div><label>返回格式</label>
          <select id="tType"><option value="text">text</option><option value="html">html</option></select>
        </div>
        <div><label>通知渠道</label><select id="tChannel"></select></div>
      </div>
      <label><input type="checkbox" id="tEnabled" style="width:auto;" checked> 启用</label>
      <div style="margin-top:12px;">
        <button class="btn" id="tSave">保存</button>
        <button class="btn gray" id="tCancel">取消</button>
      </div>
    </div>

    <div class="card">
      <h2>通知渠道
        <button class="btn sm" id="chNew" style="float:right;">+ 新建渠道</button>
      </h2>
      <table>
        <thead><tr><th>名称</th><th>类型</th><th>URL</th><th>状态</th><th>操作</th></tr></thead>
        <tbody id="chTbody"></tbody>
      </table>
    </div>

    <div class="card" id="chFormWrap" style="display:none;">
      <h2>渠道编辑</h2>
      <input type="hidden" id="chId">
      <label>渠道名称</label><input id="chName">
      <div class="row">
        <div><label>类型</label>
          <select id="chType">
            <option value="wechat">企业微信机器人</option>
            <option value="webhook">通用 Webhook</option>
            <option value="email">邮件(webhook转发)</option>
          </select>
        </div>
        <div><label>请求方法</label>
          <select id="chMethod"><option value="POST">POST</option><option value="PUT">PUT</option><option value="GET">GET</option></select>
        </div>
      </div>
      <label>URL</label><input id="chUrl" placeholder="https://...">
      <label>自定义请求头 JSON（可选，webhook/email 用）</label>
      <textarea id="chHeaders" rows="2" placeholder='{"Authorization":"Bearer xxx"}'></textarea>
      <label>Body 模板（可选，含 {{content}} 占位符，仅 webhook）</label>
      <textarea id="chBody" rows="2" placeholder='{"msgtype":"text","text":{"content":"{{content}}"}}'></textarea>
      <label><input type="checkbox" id="chEnabled" style="width:auto;" checked> 启用</label>
      <div style="margin-top:12px;">
        <button class="btn" id="chSave">保存</button>
        <button class="btn gray" id="chCancel">取消</button>
      </div>
    </div>

    <div class="card" id="logBox" style="display:none;"></div>
  </div>`;
  return renderPage({ title: '定时任务', body, script: MONITOR_JS });
}

export { loginPage, dashboardPage, adminPage, setupPage, monitorPage };
