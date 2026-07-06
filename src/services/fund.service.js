/**
 * 基金服务：净值获取、收益计算、日报生成
 *
 * 净值数据源：天天基金公开接口（非官方，失效时只需改 fetchFundNav 一处）
 *   http://fundgz.1234567.com.cn/js/{code}.js  返回 jsonpgz({...})
 *   字段: fundcode 代码, name 名称, dwjz 单位净值(昨日),
 *         gsz 估算净值, gszzl 估算涨跌幅(%), gztime 估算时间
 */

import { fmtDateTime } from './time.service.js';

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
      share_token: f.share_token || null,
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
 * @param {Object} linkMap - 可选, { [fundId]: 加仓链接URL }, 有则在每只基金后附上快速加仓链接
 * @param {number} tzOffset - 时区偏移（小时），用于报告时间戳
 * @returns {string}
 */
function buildFundReport(portfolio, format = 'text', linkMap = null, tzOffset = 8) {
  const { items, totals } = portfolio;
  if (format === 'html') return buildFundReportHTML(items, totals, linkMap, tzOffset);
  return buildFundReportText(items, totals, linkMap, tzOffset);
}

function fmtSign(n) {
  return (n >= 0 ? '+' : '') + n;
}

function buildFundReportText(items, totals, linkMap, tzOffset) {
  const line = '━━━━━━━━━━━━━━';
  let t = `📈 基金持仓日报\n🕐 ${fmtDateTime(Date.now(), tzOffset)}\n${line}\n`;
  t += `💰 总本金：${totals.cost}\n`;
  t += `📈 现　值：${totals.value}\n`;
  t += `📊 总收益：${fmtSign(totals.profit)}（${fmtSign(totals.rate)}%）\n${line}\n`;
  items.forEach((it, i) => {
    const icon = it.profit >= 0 ? '🔴' : '🟢';
    t += `\n${icon} ${i + 1}. ${it.name}（${it.code}）\n`;
    t += `　持仓：${it.shares} 份\n`;
    t += `　现价：${it.current_nav}（${fmtSign(it.gszzl)}%）\n`;
    t += `　收益：${fmtSign(it.profit)}（${fmtSign(it.rate)}%）\n`;
    if (linkMap && linkMap[it.id]) t += `　➕ 快速加仓：${linkMap[it.id]}\n`;
  });
  return t;
}

function buildFundReportHTML(items, totals, linkMap, tzOffset) {
  const profitColor = totals.profit >= 0 ? '#cf1322' : '#389e0d';
  let h = `<div style="font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;">
    <h2>📈 基金持仓日报</h2>
    <p>${fmtDateTime(Date.now(), tzOffset)}</p>
    <p>💰 总本金: ${totals.cost} · 现值: ${totals.value}</p>
    <p style="color:${profitColor};font-weight:bold;">📊 总收益: ${fmtSign(totals.profit)} (${fmtSign(totals.rate)}%)</p>`;
  items.forEach((it, i) => {
    const color = it.profit >= 0 ? '#cf1322' : '#389e0d';
    const link = linkMap && linkMap[it.id]
      ? `<div style="margin-top:6px;"><a href="${linkMap[it.id]}" style="color:#4a6cf7;">➕ 快速加仓</a></div>` : '';
    h += `<div style="background:#f8f9fa;margin:8px 0;padding:12px;border-radius:6px;border-left:4px solid ${color};">
      <div><b>${i + 1}. ${it.name} (${it.code})</b></div>
      <div style="color:#6c757d;font-size:14px;">持仓 ${it.shares} 份 · 现价 ${it.current_nav} (${fmtSign(it.gszzl)}%)</div>
      <div style="color:${color};">收益: ${fmtSign(it.profit)} (${fmtSign(it.rate)}%)</div>
      ${link}
    </div>`;
  });
  h += '</div>';
  return h;
}

/**
 * 规则化持仓分析（非投资建议，仅根据阈值把数据翻译成参考提示）
 * @param {Object} portfolio - buildPortfolio 结果 { items, totals }
 * @param {Object} rules - { stopLoss, takeProfit, concentration } 百分比阈值
 * @returns {Object} { items: [{code, name, rate, weight, signals[], targets}], summary }
 */
function analyzePortfolio(portfolio, rules = {}) {
  const stopLoss = rules.stopLoss != null ? rules.stopLoss : -10;      // 止损线(%)
  const takeProfit = rules.takeProfit != null ? rules.takeProfit : 20; // 止盈线(%)
  const concentration = rules.concentration != null ? rules.concentration : 50; // 集中度(%)

  const { items, totals } = portfolio;
  const totalValue = totals.value || 0;

  const analyzed = items.map(it => {
    const weight = totalValue > 0 ? round2((it.value / totalValue) * 100) : 0;
    const signals = [];

    if (it.rate <= stopLoss) {
      signals.push({ level: 'danger', text: `浮亏 ${it.rate}%，已触及止损参考线 ${stopLoss}%，关注是否止损或评估基本面` });
    } else if (it.rate >= takeProfit) {
      signals.push({ level: 'success', text: `浮盈 ${it.rate}%，已触及止盈参考线 ${takeProfit}%，可关注分批止盈` });
    } else if (it.rate < 0) {
      signals.push({ level: 'warn', text: `浮亏 ${it.rate}%，未及止损线，持有观察` });
    } else {
      signals.push({ level: 'info', text: `浮盈 ${it.rate}%，持有观察` });
    }

    if (weight >= concentration) {
      signals.push({ level: 'warn', text: `占总仓位 ${weight}%，集中度偏高，注意单一基金风险` });
    }

    // 止盈/止损对应的净值价位（数学计算，非预测）
    const targets = {
      stopLossNav: round2(it.cost_nav * (1 + stopLoss / 100)),
      takeProfitNav: round2(it.cost_nav * (1 + takeProfit / 100))
    };

    return {
      code: it.code, name: it.name, rate: it.rate, profit: it.profit,
      weight, current_nav: it.current_nav, cost_nav: it.cost_nav,
      signals, targets
    };
  });

  // 组合层面提示
  const summary = [];
  if (items.length > 0 && items.length < 3) {
    summary.push('持仓数量较少，分散度有限，可关注配置更多品类以分散风险');
  }
  const maxWeight = analyzed.reduce((m, x) => Math.max(m, x.weight), 0);
  if (maxWeight >= concentration) {
    summary.push(`存在单只基金占比达 ${maxWeight}%，组合集中度偏高`);
  }
  if (totals.rate <= stopLoss) {
    summary.push(`组合整体浮亏 ${totals.rate}%，注意风险控制`);
  } else if (totals.rate >= takeProfit) {
    summary.push(`组合整体浮盈 ${totals.rate}%，可关注止盈`);
  }

  return {
    rules: { stopLoss, takeProfit, concentration },
    items: analyzed,
    summary,
    disclaimer: '以上均为基于你持仓数据与设定阈值的规则化提示，仅供参考，不构成任何投资建议。市场有风险，决策需谨慎。'
  };
}

/**
 * 加仓重算：按买入金额累计份额并重算加权成本净值
 * 新份额 = 金额 / 买入净值
 * 新成本净值 = (旧份额×旧成本 + 买入金额) / (旧份额 + 新份额)
 * @param {Object} fund - 现持仓 { shares, cost_nav }
 * @param {number} amount - 买入金额(元)
 * @param {number} buyNav - 买入净值
 * @returns {Object} { addShares, newShares, newCostNav }
 */
function applyBuy(fund, amount, buyNav) {
  const oldShares = fund.shares || 0;
  const oldCost = fund.cost_nav || 0;
  const addShares = buyNav > 0 ? amount / buyNav : 0;
  const newShares = oldShares + addShares;
  const totalCost = oldShares * oldCost + amount;
  const newCostNav = newShares > 0 ? totalCost / newShares : 0;
  return {
    addShares: round2(addShares),
    newShares: round2(newShares),
    newCostNav: Math.round((newCostNav + Number.EPSILON) * 10000) / 10000
  };
}

/**
 * 情景测算：基于用户假设涨幅，计算投入后各情景收益（非预测，均为假设推演）
 * @param {number} amount - 计划投入金额(元)
 * @param {number} nav - 当前净值（买入价）
 * @param {Object} opts - { scenarios: [涨幅%...], takeProfit, stopLoss }
 * @returns {Object} { shares, scenarios[], targets, disclaimer }
 */
function calcScenarios(amount, nav, opts = {}) {
  const scenarios = opts.scenarios || [10, 0, -10];
  const takeProfit = opts.takeProfit != null ? opts.takeProfit : 20;
  const stopLoss = opts.stopLoss != null ? opts.stopLoss : -10;
  const shares = nav > 0 ? amount / nav : 0;

  const list = scenarios.map(pct => {
    const value = amount * (1 + pct / 100);
    const profit = value - amount;
    return {
      changePct: pct,
      targetNav: round2(nav * (1 + pct / 100)),
      value: round2(value),
      profit: round2(profit),
      rate: pct
    };
  });

  return {
    amount: round2(amount),
    buyNav: nav,
    shares: round2(shares),
    scenarios: list,
    targets: {
      takeProfitPct: takeProfit,
      takeProfitNav: round2(nav * (1 + takeProfit / 100)),
      takeProfitProfit: round2(amount * (takeProfit / 100)),
      stopLossPct: stopLoss,
      stopLossNav: round2(nav * (1 + stopLoss / 100)),
      stopLossProfit: round2(amount * (stopLoss / 100))
    },
    disclaimer: '以上为按你输入的假设涨幅推演的测算结果，非市场预测，不构成投资建议。实际涨跌由市场决定。'
  };
}

export {
  fetchFundNav, fetchNavBatch, calcFundProfit,
  buildPortfolio, buildFundReport, analyzePortfolio,
  applyBuy, calcScenarios, round2
};
