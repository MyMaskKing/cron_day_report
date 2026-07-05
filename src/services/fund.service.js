/**
 * 基金服务：净值获取、收益计算、日报生成
 *
 * 净值数据源：天天基金公开接口（非官方，失效时只需改 fetchFundNav 一处）
 *   http://fundgz.1234567.com.cn/js/{code}.js  返回 jsonpgz({...})
 *   字段: fundcode 代码, name 名称, dwjz 单位净值(昨日),
 *         gsz 估算净值, gszzl 估算涨跌幅(%), gztime 估算时间
 */

/**
 * 获取基金净值
 * @param {string} code - 基金代码
 * @returns {Promise<Object|null>} { code, name, nav, gsz, gszzl, navDate } 或 null
 */
async function fetchFundNav(code) {
  try {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fund.eastmoney.com/'
      },
      cf: { cacheTtl: 0 }
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    // 解析 jsonpgz({...})
    const match = text.match(/jsonpgz\((.*)\)/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    return {
      code: data.fundcode || code,
      name: data.name || '',
      nav: parseFloat(data.dwjz) || 0,
      gsz: parseFloat(data.gsz) || 0,
      gszzl: parseFloat(data.gszzl) || 0,
      navDate: data.gztime || data.jzrq || ''
    };
  } catch {
    return null;
  }
}

/**
 * 批量获取净值（并发）
 * @param {Array<string>} codes
 * @returns {Promise<Map>} code -> navInfo
 */
async function fetchNavBatch(codes) {
  const uniq = [...new Set(codes)];
  const results = await Promise.all(uniq.map(c => fetchFundNav(c)));
  const map = new Map();
  uniq.forEach((c, i) => { if (results[i]) map.set(c, results[i]); });
  return map;
}

/**
 * 计算单只基金收益
 * @param {Object} fund - { shares, cost_nav }
 * @param {number} currentNav - 当前净值（优先用估算 gsz，无则用 dwjz）
 * @returns {Object} { cost, value, profit, rate }
 */
function calcFundProfit(fund, currentNav) {
  const shares = fund.shares || 0;
  const costNav = fund.cost_nav || 0;
  const cost = shares * costNav;                 // 本金
  const value = shares * (currentNav || 0);      // 现值
  const profit = value - cost;                   // 收益
  const rate = cost > 0 ? (profit / cost) * 100 : 0; // 收益率(%)
  return {
    cost: round2(cost),
    value: round2(value),
    profit: round2(profit),
    rate: round2(rate)
  };
}

/** 保留两位小数 */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * 组装单个用户的持仓明细（含实时净值与收益）
 * @param {Array} funds - 用户持仓列表
 * @param {Map} navMap - code -> navInfo
 * @returns {Object} { items, totals }
 */
function buildPortfolio(funds, navMap) {
  const items = funds.map(f => {
    const nav = navMap.get(f.code);
    const currentNav = nav ? (nav.gsz || nav.nav) : 0;
    const profit = calcFundProfit(f, currentNav);
    return {
      id: f.id,
      code: f.code,
      name: (nav && nav.name) || f.name || f.code,
      shares: f.shares,
      cost_nav: f.cost_nav,
      current_nav: currentNav,
      gszzl: nav ? nav.gszzl : 0,
      nav_date: nav ? nav.navDate : '',
      ...profit
    };
  });
  const totals = items.reduce((acc, it) => {
    acc.cost += it.cost;
    acc.value += it.value;
    acc.profit += it.profit;
    return acc;
  }, { cost: 0, value: 0, profit: 0 });
  totals.cost = round2(totals.cost);
  totals.value = round2(totals.value);
  totals.profit = round2(totals.profit);
  totals.rate = totals.cost > 0 ? round2((totals.profit / totals.cost) * 100) : 0;
  return { items, totals };
}

/**
 * 生成基金日报文本
 * @param {Object} portfolio - buildPortfolio 结果
 * @param {string} format - 'text' | 'html'
 * @returns {string}
 */
function buildFundReport(portfolio, format = 'text') {
  const { items, totals } = portfolio;
  if (format === 'html') return buildFundReportHTML(items, totals);
  return buildFundReportText(items, totals);
}

function fmtSign(n) {
  return (n >= 0 ? '+' : '') + n;
}

function buildFundReportText(items, totals) {
  let t = `📈 基金持仓日报 (${new Date().toLocaleString('zh-CN')})\n\n`;
  t += `💰 总本金: ${totals.cost}  现值: ${totals.value}\n`;
  t += `📊 总收益: ${fmtSign(totals.profit)}  收益率: ${fmtSign(totals.rate)}%\n\n`;
  items.forEach((it, i) => {
    const icon = it.profit >= 0 ? '🔴' : '🟢';
    t += `${i + 1}. ${icon} ${it.name} (${it.code})\n`;
    t += `   持仓: ${it.shares} 份 · 现价: ${it.current_nav} (${fmtSign(it.gszzl)}%)\n`;
    t += `   收益: ${fmtSign(it.profit)} (${fmtSign(it.rate)}%)\n`;
  });
  return t;
}

function buildFundReportHTML(items, totals) {
  const profitColor = totals.profit >= 0 ? '#cf1322' : '#389e0d';
  let h = `<div style="font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;">
    <h2>📈 基金持仓日报</h2>
    <p>${new Date().toLocaleString('zh-CN')}</p>
    <p>💰 总本金: ${totals.cost} · 现值: ${totals.value}</p>
    <p style="color:${profitColor};font-weight:bold;">📊 总收益: ${fmtSign(totals.profit)} (${fmtSign(totals.rate)}%)</p>`;
  items.forEach((it, i) => {
    const color = it.profit >= 0 ? '#cf1322' : '#389e0d';
    h += `<div style="background:#f8f9fa;margin:8px 0;padding:12px;border-radius:6px;border-left:4px solid ${color};">
      <div><b>${i + 1}. ${it.name} (${it.code})</b></div>
      <div style="color:#6c757d;font-size:14px;">持仓 ${it.shares} 份 · 现价 ${it.current_nav} (${fmtSign(it.gszzl)}%)</div>
      <div style="color:${color};">收益: ${fmtSign(it.profit)} (${fmtSign(it.rate)}%)</div>
    </div>`;
  });
  h += '</div>';
  return h;
}

export {
  fetchFundNav, fetchNavBatch, calcFundProfit,
  buildPortfolio, buildFundReport, round2
};
