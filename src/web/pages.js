/**
 * 页面组装：登录、仪表盘、超管用户管理
 * 各功能模块页面（monitor/fund/weight）将在后续阶段补充
 */

import { renderPage, renderTopbar } from './layout.js';
import {
  LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS, FUND_JS, PUBLIC_BUY_JS,
  WEIGHT_JS, PUBLIC_WEIGHT_JS, SETTINGS_JS, ASSET_JS, PUBLIC_ASSET_JS, CHANNELS_JS,
  WEIGHT_REPORT_JS, ASSET_REPORT_JS, FUND_REPORT_JS,
  TODO_JS, PUBLIC_TODO_JS, TODO_REPORT_JS
} from './assets.js';

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
  // 斜对角全屏流动词墙：三行不同速度/方向的功能关键词，铺满背景做氛围
  // 每行内容渲染两遍以实现 translateX(-50%) 无缝循环
  const rowA = ['🖥️ 网站监控', '📈 基金持仓日报', '⏰ 定时自动推送', '⚖️ 体重曲线', '💰 资产月报'];
  const rowB = ['📢 企业微信', '🔗 免密公开链接', 'Webhook', '📧 邮件推送', '👥 多用户 · 超管'];
  const rowC = ['✍️ 家人免登填写', '🎯 年度目标进度', '📊 持仓分析', '🕐 到点即达', '📉 净值追踪'];
  const mkRow = (arr, cls, hotIdx) => {
    const chips = arr.map((t, i) => {
      const k = i % 3 === hotIdx ? ' hot' : (i % 4 === 2 ? ' glow' : '');
      return `<span class="lg-chip${k}">${t}</span>`;
    }).join('');
    return `<div class="lg-row ${cls}">${chips}${chips}</div>`;
  };
  const field = `<div class="lg-field">
    ${mkRow(rowA, 'a', 0)}
    ${mkRow(rowB, 'b', 1)}
    ${mkRow(rowC, 'c', 2)}
    ${mkRow(rowA, 'b', 1)}
    ${mkRow(rowB, 'a', 0)}
  </div>`;

  const brand = `<div class="lg-brand">
    <span class="lg-logo">🚀 生活面板 · 定时推送</span>
    <div class="lg-title">你的数据<br>到点<em>自动送达</em></div>
    <p class="lg-sub">网站监控、基金、体重、资产，一处管理，按你设定的时间推送到微信、Webhook 与邮件。</p>
  </div>`;

  const panel = `<div class="lg-panel">
    <h2>🚀 控制台</h2>
    <div class="lg-hint">登录或注册，开始搭建你的自动推送</div>
    <div id="msg" class="msg"></div>
    <div class="lg-tabs">
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
      <label>用户名 (3-32位，登录用)</label>
      <input id="ru" required>
      <label>昵称 (显示用，可选)</label>
      <input id="rn" placeholder="留空则同用户名">
      <label>密码 (至少6位)</label>
      <input id="rp" type="password" required>
      <button class="btn" style="width:100%;" type="submit">注册</button>
    </form>
  </div>`;

  const body = `<div class="lg-fs">${field}${brand}${panel}</div>`;
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
        <a class="stat" href="/asset"><div class="num">💰</div><div class="lbl">资产报表</div></a>
        <a class="stat" href="/weight"><div class="num">⚖️</div><div class="lbl">体重曲线</div></a>
        <a class="stat" href="/todo"><div class="num">📝</div><div class="lbl">待办清单</div></a>
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
      <h2>系统设置</h2>
      <div id="stMsg" class="msg"></div>
      <div class="row">
        <div><label>全局时区（UTC 偏移小时，中国为 8）</label>
          <input id="tzInput" type="number" min="-12" max="14" step="1">
        </div>
        <div style="display:flex;align-items:flex-end;margin-bottom:12px;"><button class="btn" id="tzSave">保存时区</button></div>
      </div>
      <p class="muted">影响所有推送内容与报告中的时间显示。当前部署在 Cloudflare（UTC），设为 8 即中国时间。</p>
      <div class="row">
        <div style="flex:1;"><label>站点公开地址（用于推送内免密链接，如 https://xxx.workers.dev）</label>
          <input id="baseUrlInput" type="text" placeholder="留空则回退配置文件 / 请求来源">
        </div>
        <div style="display:flex;align-items:flex-end;margin-bottom:12px;"><button class="btn" id="baseUrlSave">保存地址</button></div>
      </div>
      <p class="muted">优先级：此处设置 &gt; 配置文件 PUBLIC_BASE_URL &gt; 请求来源。留空即清空本项设置。</p>
    </div>
    <div class="card">
      <h2>全部用户
        <button class="btn sm" id="newUserBtn" style="float:right;">+ 新建用户</button>
      </h2>
      <table>
        <thead><tr><th>ID</th><th>用户名</th><th>昵称</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
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
      <label><input type="checkbox" id="tStandalone" style="width:auto;"> 独立发送（该任务结果单独一条消息；不勾则与同渠道其他任务合并）</label>
      <div style="margin-top:12px;">
        <button class="btn" id="tSave">保存</button>
        <button class="btn gray" id="tCancel">取消</button>
      </div>
    </div>

    <div class="card">
      <h2>定时执行</h2>
      <div class="row">
        <div><label>每天执行时间</label><div id="mpHour" class="multi-pick"></div></div>
      </div>
      <label><input type="checkbox" id="mpEn" style="width:auto;"> 启用每天自动执行（到点自动跑所有启用任务并按渠道发送）</label>
      <div style="margin-top:12px;"><button class="btn" id="mpSave">保存定时配置</button> <button class="btn gray" id="mpSend">立即执行并推送</button></div>
    </div>

    <p class="muted">通知渠道请在 <a href="/channels">通知渠道</a> 页统一管理。</p>

    <div class="card" id="logBox" style="display:none;"></div>
  </div>`;
  return renderPage({ title: '定时任务', body, script: MONITOR_JS });
}

/** 通知渠道管理页 */
function channelsPage(user) {
  const body = renderTopbar(user, 'channels') + `<div class="container">
    <div class="card">
      <h2>通知渠道 <button class="btn sm" id="chNew" style="float:right;">+ 新建渠道</button></h2>
      <table>
        <thead><tr><th>名称</th><th>类型</th><th>URL</th><th>状态</th><th>操作</th></tr></thead>
        <tbody id="chTbody"></tbody>
      </table>
      <p class="muted" style="margin-top:8px;">渠道用于监控任务、基金/资产/体重日报的消息推送。三种类型：企业微信机器人、通用 Webhook、邮件转发。</p>
    </div>
  </div>`;
  return renderPage({ title: '通知渠道', body, script: CHANNELS_JS });
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
      <h2>每日总收益曲线
        <select id="profitRange" class="btn sm gray" style="float:right;">
          <option value="7d">近7天</option>
          <option value="month">本月</option>
          <option value="year">本年</option>
          <option value="all">全部</option>
        </select>
      </h2>
      <div id="profitEmpty" class="muted" style="display:none;text-align:center;padding:40px;">暂无每日收益数据，次日 15:00 后自动生成首条快照</div>
      <div id="profitChartWrap" style="height:280px;max-width:720px;margin:20px auto 0;"><canvas id="profitChart"></canvas></div>
      <h3 style="margin:24px 0 8px;font-size:16px;">每日明细</h3>
      <div style="max-height:240px;overflow-y:auto;">
        <table><thead><tr style="background:#f8f9fa;"><th>日期</th><th>总收益(元)</th><th>较前一天增长(元)</th></tr></thead><tbody id="profitTbody"></tbody></table>
      </div>
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

    <div class="card">
      <h2>每日报告推送</h2>
      <div class="row">
        <div><label>通知渠道（可多选）</label><div id="rcChannel" class="multi-pick"></div></div>
        <div><label>报告格式</label>
          <select id="rcFormat"><option value="text">text</option><option value="html">html</option><option value="markdown">markdown</option></select>
        </div>
        <div><label>推送时间</label><div id="rcHour" class="multi-pick"></div></div>
      </div>
      <label><input type="checkbox" id="rcEnabled" style="width:auto;"> 启用每日自动推送</label>
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
  </div>`;
  return renderPage({ title: '基金追踪', body, script: FUND_JS });
}

/** 免密快速加仓公开页（无需登录） */
function publicBuyPage() {
  const body = `<div class="login-wrap" style="max-width:420px;">
    <div class="card">
      <h1 style="text-align:center;color:#4a6cf7;font-size:20px;margin-bottom:16px;">➕ 快速加仓</h1>
      <div style="text-align:center;margin-bottom:12px;"><button class="btn sm gray" id="quickLoginBtn">🔑 用本人账号登录</button></div>
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

/** 体重曲线页 */
function weightPage(user) {
  const body = renderTopbar(user, 'weight') + `<div class="container">
    <div class="card">
      <h2>成员
        <button class="btn sm" id="mAdd" style="float:right;">+ 新建成员</button>
        <select id="unitSel" class="btn sm gray" style="float:right;width:auto;margin-right:8px;padding:4px 8px;">
          <option value="jin">单位：斤</option>
          <option value="kg">单位：公斤</option>
        </select>
      </h2>
      <div id="memberList"></div>
    </div>

    <div class="card">
      <h2>录入体重</h2>
      <div class="row">
        <div><label>成员</label><select id="recMember"></select></div>
        <div><label id="recWeightLabel">体重(斤)</label><input id="recWeight" type="number" step="0.1" placeholder="如 130"></div>
        <div><label>日期</label><input id="recDate" type="date"></div>
      </div>
      <button class="btn" id="recAdd">保存记录</button>
      <p class="muted" style="margin-top:6px;">同一成员同一天再次录入将覆盖当天数据。</p>
    </div>

    <div class="card">
      <h2>体重曲线</h2>
      <div class="row">
        <div><label>时间区间</label>
          <select id="rangePreset"><option value="month">本月</option><option value="year">本年</option></select>
        </div>
        <div><label>开始</label><input id="fStart" type="date"></div>
        <div><label>结束</label><input id="fEnd" type="date"></div>
      </div>
      <canvas id="weightChart" style="max-height:340px;"></canvas>
    </div>

    <div class="card">
      <h2>每日推送</h2>
      <div class="row">
        <div><label>通知渠道（可多选）</label><div id="pushCh" class="multi-pick"></div></div>
        <div><label>格式</label>
          <select id="pushFmt"><option value="text">text</option><option value="html">html</option><option value="markdown">markdown</option></select>
        </div>
        <div><label>推送时间</label><div id="pushHour" class="multi-pick"></div></div>
      </div>
      <label><input type="checkbox" id="pushEn" style="width:auto;"> 启用每日自动推送</label>
      <div style="margin-top:12px;"><button class="btn" id="pushSave">保存推送配置</button> <button class="btn gray" id="pushSend">立即推送</button></div>
    </div>

    <div class="card">
      <h2>历史记录</h2>
      <table>
        <thead><tr><th>日期</th><th>成员</th><th>体重</th><th>较上次</th><th>操作</th></tr></thead>
        <tbody id="recTbody"></tbody>
      </table>
    </div>

    <div class="card" id="compareCard" style="display:none;">
      <h2>多用户对比（超管）</h2>
      <div id="cmpUsers" style="margin-bottom:10px;"></div>
      <button class="btn" id="cmpRun">生成对比曲线</button>
      <canvas id="compareChart" style="max-height:340px;margin-top:14px;"></canvas>
    </div>
  </div>`;
  return renderPage({ title: '体重曲线', body, script: WEIGHT_JS });
}

/** 体重免密快速填写公开页 */
function publicWeightPage() {
  const body = `<div class="login-wrap" style="max-width:420px;">
    <div class="card">
      <h1 style="text-align:center;color:#4a6cf7;font-size:20px;margin-bottom:6px;">⚖️ <span id="memberName"></span></h1>
      <p id="streakTitle" style="text-align:center;color:#389e0d;font-weight:600;margin-bottom:2px;"></p>
      <p id="monthDays" style="text-align:center;color:#888;font-size:13px;margin-bottom:16px;"></p>
      <div style="text-align:center;margin-bottom:12px;"><button class="btn sm gray" id="quickLoginBtn">🔑 用本人账号登录</button></div>
      <div id="msg" class="msg"></div>
      <div id="content" style="display:none;">
        <form id="wForm">
          <label>日期（今日，不可修改）</label>
          <input id="todayDate" readonly disabled style="background:#f5f5f5;text-align:center;">
          <label id="weightLabel">今日体重(斤)</label>
          <input id="weight" type="number" step="0.1" required placeholder="如 130">
          <button class="btn" style="width:100%;" type="submit">提交今日体重</button>
        </form>
        <canvas id="miniChart" style="margin-top:16px;max-height:220px;"></canvas>
        <div id="histBox" style="margin-top:16px;"></div>
      </div>
    </div>
  </div>`;
  return renderPage({ title: '体重打卡', body, script: PUBLIC_WEIGHT_JS });
}

/** 个人设置页 */
function settingsPage(user) {
  const body = renderTopbar(user, '') + `<div class="container">
    <div class="card" style="max-width:480px;margin:0 auto;">
      <h2>个人设置</h2>
      <div id="msg" class="msg"></div>
      <form id="nickForm">
        <label>用户名（登录用，不可修改）</label>
        <input id="pfUsername" readonly disabled style="background:#f5f5f5;">
        <label>昵称</label>
        <input id="pfNick" maxlength="32">
        <button class="btn" type="submit">保存昵称</button>
      </form>
      <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
      <form id="pwdForm">
        <h2 style="font-size:15px;">修改密码</h2>
        <label>原密码</label>
        <input id="pwOld" type="password" autocomplete="current-password">
        <label>新密码（至少6位）</label>
        <input id="pwNew" type="password" autocomplete="new-password">
        <button class="btn" type="submit">修改密码</button>
      </form>
    </div>
  </div>`;
  return renderPage({ title: '个人设置', body, script: SETTINGS_JS });
}

/** 资产报表页 */
function assetPage(user) {
  const body = renderTopbar(user, 'asset') + `<div class="container">
    <div class="card">
      <h2>资产总览</h2>
      <div class="grid-stats">
        <div class="stat"><div class="num" id="sAssets">0</div><div class="lbl">资产合计</div></div>
        <div class="stat"><div class="num" id="sDebt">0</div><div class="lbl">负债(信用)</div></div>
        <div class="stat"><div class="num" id="sNet">0</div><div class="lbl">净资产</div></div>
        <div class="stat"><div class="num" id="sMonth" style="font-size:18px;">—</div><div class="lbl">最新月份</div></div>
      </div>
      <div id="goalBox" style="margin-top:14px;padding:10px;background:#f8f9ff;border-radius:6px;font-size:14px;"></div>
      <div id="typeTotalBox" style="margin-top:14px;"></div>
      <div class="row" style="margin-top:12px;">
        <div style="flex:none;width:100%;">
          <label>设置当年目标净资产(元)</label>
          <div style="display:flex;gap:12px;align-items:center;">
            <input id="goalInput" type="number" step="0.01" style="flex:1;min-width:140px;">
            <button class="btn" id="goalSave" style="flex:none;">保存目标</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>时间区间</h2>
      <div class="row">
        <div><label>预设</label>
          <select id="afPreset"><option value="year">本年</option><option value="month">本月</option></select>
        </div>
        <div><label>开始月份</label><input id="afStart" type="month"></div>
        <div><label>结束月份</label><input id="afEnd" type="month"></div>
      </div>
    </div>

    <div class="card">
      <h2>净资产趋势</h2>
      <canvas id="netChart" style="max-height:300px;"></canvas>
    </div>
    <div class="card">
      <h2>每月净存（本月−上月净资产，负值为减少）</h2>
      <canvas id="consumeChart" style="max-height:300px;"></canvas>
    </div>

    <div class="card">
      <h2>每月推送</h2>
      <div class="row">
        <div><label>通知渠道（可多选）</label><div id="pushCh" class="multi-pick"></div></div>
        <div><label>格式</label>
          <select id="pushFmt"><option value="text">text</option><option value="html">html</option><option value="markdown">markdown</option></select>
        </div>
      </div>
      <div class="row">
        <div><label>每月几号</label><div id="pushDay" class="multi-pick"></div></div>
        <div><label>推送时间</label><div id="pushHour" class="multi-pick"></div></div>
      </div>
      <label><input type="checkbox" id="pushEn" style="width:auto;"> 启用每月自动推送</label>
      <div style="margin-top:12px;"><button class="btn" id="pushSave">保存推送配置</button> <button class="btn gray" id="pushSend">立即推送</button></div>
    </div>

    <div class="card">
      <h2>钱包 <span id="walletMonthTag" class="muted" style="font-size:13px;font-weight:normal;"></span> <button class="btn sm" id="walletAdd" style="float:right;">+ 新建钱包</button></h2>
      <table>
        <thead><tr><th>类型</th><th>名称</th><th>本月金额</th><th>操作</th></tr></thead>
        <tbody id="walletTbody"></tbody>
      </table>
      <p class="muted" style="margin-top:6px;">投资钱包分本金/持有收益；信用支付计为负债。每个钱包可「录入本月/其他月」或生成免密录入链接。</p>
    </div>

    <div class="card">
      <h2>月度各类型合计</h2>
      <table>
        <thead id="mttHead"></thead>
        <tbody id="mttBody"></tbody>
      </table>
      <p class="muted" style="margin-top:6px;">每行一个月，横向为各类型钱包当月合计；净资产为负标红。随上方时间区间联动。</p>
    </div>

    <div class="card">
      <h2>月度记录</h2>
      <table>
        <thead><tr><th>月份</th><th>类型</th><th>钱包</th><th>金额</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody id="recTbody"></tbody>
      </table>
    </div>
  </div>`;
  return renderPage({ title: '资产报表', body, script: ASSET_JS });
}

/** 资产免密录入公开页 */
function publicAssetPage() {
  const body = `<div class="login-wrap" style="max-width:420px;">
    <div class="card">
      <h1 style="text-align:center;color:#4a6cf7;font-size:20px;margin-bottom:6px;">💰 <span id="walletName"></span></h1>
      <p style="text-align:center;color:#888;font-size:13px;margin-bottom:16px;">录入 <span id="monthLabel"></span>金额</p>
      <div style="text-align:center;margin-bottom:12px;"><button class="btn sm gray" id="quickLoginBtn">🔑 用本人账号登录</button></div>
      <div id="msg" class="msg"></div>
      <div id="content" style="display:none;">
        <form id="aForm">
          <div id="fields"></div>
          <button class="btn" style="width:100%;" type="submit">提交本月记录</button>
        </form>
      </div>
    </div>
  </div>`;
  return renderPage({ title: '资产录入', body, script: PUBLIC_ASSET_JS });
}

/** 体重免密报告查看页 */
function weightReportPage() {
  const body = `<div class="container" style="max-width:760px;margin:24px auto;">
    <div class="card">
      <h2>⚖️ 体重曲线 <button class="btn sm gray" id="quickLoginBtn" style="float:right;">🔑 用本人账号登录</button></h2>
      <div id="content" style="display:none;">
        <canvas id="rptChart" style="max-height:420px;"></canvas>
        <div id="rptHist" style="margin-top:20px;"></div>
      </div>
    </div>
  </div>`;
  return renderPage({ title: '体重曲线', body, script: WEIGHT_REPORT_JS });
}

/** 资产免密报告查看页 */
function assetReportPage() {
  const body = `<div class="container" style="max-width:760px;margin:24px auto;">
    <div style="text-align:right;margin-bottom:12px;"><button class="btn sm gray" id="quickLoginBtn">🔑 用本人账号登录</button></div>
    <div id="content" style="display:none;">
      <div class="card"><h2>💰 净资产趋势</h2><canvas id="netChart" style="max-height:340px;"></canvas></div>
      <div class="card"><h2>每月消费</h2><canvas id="consumeChart" style="max-height:340px;"></canvas></div>
    </div>
  </div>`;
  return renderPage({ title: '资产趋势', body, script: ASSET_REPORT_JS });
}

/** 基金持仓分布免密报告页 */
function fundReportPage() {
  const body = `<div class="container" style="max-width:640px;margin:24px auto;">
    <div style="text-align:right;margin-bottom:12px;"><button class="btn sm gray" id="quickLoginBtn">🔑 用本人账号登录</button></div>
    <div class="card">
      <h2>📊 持仓分布</h2>
      <div id="content" style="display:none;">
        <canvas id="pieChart" style="max-height:420px;"></canvas>
      </div>
    </div>
    <div class="card" id="profitBox" style="display:none;">
      <h2>📈 近30天总收益曲线</h2>
      <canvas id="profitChart" style="max-height:300px;"></canvas>
      <h3 style="margin:20px 0 8px;font-size:16px;">每日明细</h3>
      <div style="max-height:240px;overflow-y:auto;">
        <table><thead><tr style="background:#f8f9fa;"><th>日期</th><th>总收益(元)</th><th>较前一天增长(元)</th></tr></thead><tbody id="profitTbody"></tbody></table>
      </div>
    </div>
  </div>`;
  return renderPage({ title: '持仓分布', body, script: FUND_REPORT_JS });
}

/** 待办清单页 */
function todoPage(user) {
  const body = renderTopbar(user, 'todo') + `<div class="container">
    <div class="card">
      <h2>概览</h2>
      <div class="todo-stats">
        <div class="todo-stat"><div class="n" id="stPending">0</div><div class="l">未完成</div></div>
        <div class="todo-stat overdue"><div class="n" id="stOverdue">0</div><div class="l">已逾期</div></div>
        <div class="todo-stat done"><div class="n" id="stDone">0</div><div class="l">已完成</div></div>
        <div class="todo-stat"><div class="n" id="stTotal">0</div><div class="l">总计</div></div>
      </div>
    </div>

    <div class="card">
      <h2>待办清单
        <button class="btn sm" id="tAdd" style="float:right;">+ 新建任务</button>
        <label style="float:right;margin-right:14px;font-weight:normal;color:#666;font-size:13px;"><input type="checkbox" id="hideDone" style="width:auto;"> 隐藏已完成</label>
      </h2>
      <div id="todoTree" class="todo-tree"></div>
      <p class="muted" style="margin-top:8px;">勾选父任务将连带其全部子任务；每个顶层任务可生成免密协作链接，家人无需登录即可添加或勾选。</p>
    </div>

    <div class="card">
      <h2>每日推送</h2>
      <div class="row">
        <div><label>通知渠道（可多选）</label><div id="pushCh" class="multi-pick"></div></div>
        <div><label>格式</label>
          <select id="pushFmt"><option value="text">text</option><option value="html">html</option><option value="markdown">markdown</option></select>
        </div>
        <div><label>推送时间</label><div id="pushHour" class="multi-pick"></div></div>
      </div>
      <label><input type="checkbox" id="pushEn" style="width:auto;"> 启用每日自动推送（仅推送未完成待办，逾期优先）</label>
      <div style="margin-top:12px;"><button class="btn" id="pushSave">保存推送配置</button> <button class="btn gray" id="pushSend">立即推送</button></div>
    </div>
  </div>`;
  return renderPage({ title: '待办清单', body, script: TODO_JS });
}

/** 待办免密协作公开页 */
function publicTodoPage() {
  const body = `<div class="container" style="max-width:560px;margin:24px auto;">
    <div class="card">
      <h2>📝 <span id="rootTitle">待办</span> <button class="btn sm gray" id="quickLoginBtn" style="float:right;">🔑 用本人账号登录</button></h2>
      <p id="ownerLine" class="muted" style="margin-bottom:12px;"></p>
      <div id="msg" class="msg"></div>
      <div id="content" style="display:none;">
        <div style="margin-bottom:12px;"><button class="btn sm" id="tAddRoot">+ 添加任务</button></div>
        <div id="todoTree" class="todo-tree"></div>
      </div>
    </div>
  </div>`;
  return renderPage({ title: '待办协作', body, script: PUBLIC_TODO_JS });
}

/** 待办免密报告查看页 */
function todoReportPage() {
  const body = `<div class="container" style="max-width:640px;margin:24px auto;">
    <div style="text-align:right;margin-bottom:12px;"><button class="btn sm gray" id="quickLoginBtn">🔑 用本人账号登录</button></div>
    <div id="content" style="display:none;">
      <div class="card">
        <h2>📝 全部待办</h2>
        <div class="todo-stats">
          <div class="todo-stat"><div class="n" id="stPending">0</div><div class="l">未完成</div></div>
          <div class="todo-stat overdue"><div class="n" id="stOverdue">0</div><div class="l">已逾期</div></div>
          <div class="todo-stat done"><div class="n" id="stDone">0</div><div class="l">已完成</div></div>
        </div>
        <div id="todoTree" class="todo-tree" style="margin-top:14px;"></div>
      </div>
    </div>
  </div>`;
  return renderPage({ title: '全部待办', body, script: TODO_REPORT_JS });
}

export {
  loginPage, dashboardPage, adminPage, setupPage, monitorPage, fundPage, publicBuyPage,
  weightPage, publicWeightPage, settingsPage, assetPage, publicAssetPage, channelsPage,
  weightReportPage, assetReportPage, fundReportPage,
  todoPage, publicTodoPage, todoReportPage
};
