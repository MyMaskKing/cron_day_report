/**
 * 页面组装：登录、仪表盘、超管用户管理
 * 各功能模块页面（monitor/fund/weight）将在后续阶段补充
 */

import { renderPage, renderTopbar } from './layout.js';
import { LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS, FUND_JS, PUBLIC_BUY_JS } from './assets.js';

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
      <div id="chHelp" style="background:#f8f9ff;border:1px solid #e6e8f0;border-radius:6px;padding:12px;margin-bottom:12px;font-size:13px;line-height:1.7;"></div>
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

/** 基金追踪页 */
function fundPage(user) {
  const body = renderTopbar(user, 'fund') + `<div class="container">
    <div class="card">
      <h2>收益汇总</h2>
      <div class="grid-stats">
        <div class="stat"><div class="num" id="sumCost">0</div><div class="lbl">总本金</div></div>
        <div class="stat"><div class="num" id="sumValue">0</div><div class="lbl">现值</div></div>
        <div class="stat"><div class="num" id="sumProfit">0</div><div class="lbl">总收益</div></div>
        <div class="stat"><div class="num" id="sumRate">0%</div><div class="lbl">收益率</div></div>
      </div>
      <div style="max-width:420px;margin:20px auto 0;"><canvas id="fundChart"></canvas></div>
    </div>

    <div class="card">
      <h2>持仓明细
        <button class="btn sm" id="fNew" style="float:right;">+ 添加持仓</button>
      </h2>
      <table>
        <thead><tr><th>基金</th><th>份额</th><th>成本净值</th><th>现价(估)</th><th>本金</th><th>现值</th><th>收益</th><th>操作</th></tr></thead>
        <tbody id="fundTbody"></tbody>
      </table>
      <p class="muted" style="margin-top:8px;">现价为天天基金估算净值，交易时段为实时估值，收盘后为当日净值。</p>
    </div>

    <div class="card" id="fundFormWrap" style="display:none;">
      <h2>持仓编辑</h2>
      <input type="hidden" id="fId">
      <label>基金代码（6位数字）</label><input id="fCode" placeholder="如 000001">
      <div class="row">
        <div><label>持有份额</label><input id="fShares" type="number" step="0.01" placeholder="如 1000"></div>
        <div><label>成本净值（买入时单位净值）</label><input id="fCostNav" type="number" step="0.0001" placeholder="如 1.2345"></div>
      </div>
      <div style="margin-top:12px;">
        <button class="btn" id="fSave">保存</button>
        <button class="btn gray" id="fCancel">取消</button>
      </div>
    </div>

    <div class="card">
      <h2>每日报告推送</h2>
      <div class="row">
        <div><label>通知渠道</label><select id="rcChannel"></select></div>
        <div><label>报告格式</label>
          <select id="rcFormat"><option value="text">text</option><option value="html">html</option></select>
        </div>
      </div>
      <label><input type="checkbox" id="rcEnabled" style="width:auto;"> 启用每日自动推送（随 cron 定时任务一并发送）</label>
      <div style="margin-top:12px;">
        <button class="btn" id="rcSave">保存配置</button>
        <button class="btn gray" id="rcSend">立即发送日报</button>
      </div>
    </div>

    <div class="card">
      <h2>持仓分析 <span class="muted" style="font-size:12px;font-weight:normal;">（规则化提示，非投资建议）</span></h2>
      <div class="row">
        <div><label>止损线(%)</label><input id="anStopLoss" type="number" value="-10"></div>
        <div><label>止盈线(%)</label><input id="anTakeProfit" type="number" value="20"></div>
        <div><label>集中度告警(%)</label><input id="anConcentration" type="number" value="50"></div>
      </div>
      <button class="btn" id="anRun">生成分析</button>
      <div id="anResult" style="margin-top:14px;"></div>
    </div>

    <div class="card">
      <h2>情景测算 <span class="muted" style="font-size:12px;font-weight:normal;">（按你的假设推演，非市场预测）</span></h2>
      <div class="row">
        <div><label>基金代码（可选，留空则用买入净值）</label><input id="scCode" placeholder="如 000001"></div>
        <div><label>计划投入金额(元)</label><input id="scAmount" type="number" step="0.01" placeholder="如 10000"></div>
        <div><label>买入净值（留空则按代码取实时估值）</label><input id="scNav" type="number" step="0.0001"></div>
      </div>
      <div class="row">
        <div><label>止盈假设(%)</label><input id="scTakeProfit" type="number" value="20"></div>
        <div><label>止损假设(%)</label><input id="scStopLoss" type="number" value="-10"></div>
      </div>
      <button class="btn" id="scRun">开始测算</button>
      <div id="scResult" style="margin-top:14px;"></div>
    </div>

    <div class="card" id="shareBox" style="display:none;"></div>
  </div>`;
  return renderPage({ title: '基金追踪', body, script: FUND_JS });
}

/** 免密快速加仓公开页（无需登录） */
function publicBuyPage() {
  const body = `<div class="login-wrap" style="max-width:420px;">
    <div class="card">
      <h1 style="text-align:center;color:#4a6cf7;font-size:20px;margin-bottom:16px;">➕ 快速加仓</h1>
      <div id="msg" class="msg"></div>
      <div id="content" style="display:none;">
        <h2 id="fundName" style="font-size:16px;"></h2>
        <div class="grid-stats" style="margin:12px 0;">
          <div class="stat"><div class="num" id="curNav" style="font-size:18px;"></div><div class="lbl">当前净值(估)</div></div>
          <div class="stat"><div class="num" id="curShares" style="font-size:18px;"></div><div class="lbl">当前份额</div></div>
          <div class="stat"><div class="num" id="curCost" style="font-size:18px;"></div><div class="lbl">成本净值</div></div>
        </div>
        <form id="buyForm">
          <label>买入金额(元)</label>
          <input id="amount" type="number" step="0.01" required placeholder="如 1000">
          <label>买入净值（默认当前估值，可改）</label>
          <input id="buyNav" type="number" step="0.0001">
          <button class="btn" style="width:100%;" type="submit">确认加仓</button>
        </form>
        <p class="muted" style="font-size:12px;margin-top:10px;">按金额买入：份额=金额/净值，系统自动累计并重算持仓成本净值。</p>
      </div>
    </div>
  </div>`;
  return renderPage({ title: '快速加仓', body, script: PUBLIC_BUY_JS });
}

export { loginPage, dashboardPage, adminPage, setupPage, monitorPage, fundPage, publicBuyPage };
