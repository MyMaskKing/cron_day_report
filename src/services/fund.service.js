/**
 * 基金服务：净值获取、收益计算、日报生成
 *
 * 净值数据源：天天基金移动端 API（非官方，失效时只需改 fetchFundNav 一处）
 *   https://fundmobapi.eastmoney.com/FundMNewApi/FundMNBasicInformation
 *   返回 {Datas:{FCODE, SHORTNAME, FSRQ, DWJZ, RZDF, ...} | null}
 *   字段: FCODE 代码, SHORTNAME 简称, FSRQ 净值日期,
 *         DWJZ 单位净值(当日已确认;盘中返回昨日), RZDF 日涨幅(%)
 *   注: 原 fundgz.1234567.com.cn/js/{code}.js 已下线 (返回 404 页面)
 */

/**
 * 获取基金净值
 * @param {string} code - 基金代码
 * @returns {Promise<Object|null>} { code, name, nav, gsz, gszzl, navDate } 或 null
 */
async function fetchFundNav(code) {
  try {
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNBasicInformation`
              + `?FCODE=${code}&plat=Iphone&deviceid=1&product=EFund&version=6.4.4&Uid=`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
      },
      cf: { cacheTtl: 0 }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const d = data && data.Datas;
    if (!d) return null;                 // 代码不存在或无数据
    const nav = parseFloat(d.DWJZ) || 0;
    // 严格校验: DWJZ 为正数才认定成功
    // 否则视作失败返回 null, 避免 0 被当作当前净值导致 "今日收益=-本金"
    if (nav <= 0) return null;
    return {
      code: d.FCODE || code,
      name: d.SHORTNAME || '',
      nav,
      gsz: nav,                          // 新接口无盘中估算, 用当日已确认净值
      gszzl: parseFloat(d.RZDF) || 0,    // 日涨幅(%)
      navDate: d.FSRQ || ''
    };
  } catch {
    return null;
  }
}

/**
 * 获取基金历史单位净值（近 N 天）
 * 数据源：天天基金 F10 历史净值接口
 *   https://api.fund.eastmoney.com/f10/lsjz?fundCode={code}&pageIndex=1&pageSize={n}
 *   需 Referer=fund.eastmoney.com；返回 { Data: { LSJZList: [{ FSRQ:日期, DWJZ:单位净值 }] } }
 * @param {string} code - 基金代码
 * @param {number} pageSize - 取最近多少条（默认 30）
 * @returns {Promise<Array>} 按日期升序的 [{ date, nav }]，失败返回 []
 */
async function fetchNavHistory(code, pageSize = 30) {
  try {
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=${pageSize}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fundf10.eastmoney.com/'
      },
      cf: { cacheTtl: 0 }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const list = (data && data.Data && data.Data.LSJZList) || [];
    return list
      .map(r => ({ date: r.FSRQ, nav: parseFloat(r.DWJZ) || 0 }))
      .filter(r => r.date && r.nav > 0)
      .sort((a, b) => a.date < b.date ? -1 : 1);
  } catch {
    return [];
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
 * @param {Map} navMap - code -> navInfo (本次成功获取)
 * @param {Map} [fallbackNavMap] - code -> navInfo (来自 fund_nav_cache 的上次快照兜底; 可选)
 * @returns {Object} { items, totals }
 */
function buildPortfolio(funds, navMap, fallbackNavMap) {
  const fb = fallbackNavMap || new Map();
  const items = funds.map(f => {
    const nav = navMap.get(f.code);
    // currentNav 取值顺序: 本次估算 > 本次昨日净值 > 缓存估算 > 缓存净值 > 成本净值
    //   最后一档兜底成 cost_nav, 相当于"今日收益=0", 比 0 -> "-本金" 安全
    let currentNav = 0, nav_stale = false;
    if (nav && (nav.gsz > 0 || nav.nav > 0)) {
      currentNav = nav.gsz || nav.nav;
    } else {
      const fbNav = fb.get(f.code);
      if (fbNav && (fbNav.gsz > 0 || fbNav.nav > 0)) {
        currentNav = fbNav.gsz || fbNav.nav;
        nav_stale = true;
      } else {
        currentNav = f.cost_nav || 0;
        nav_stale = true;
      }
    }
    const profit = calcFundProfit(f, currentNav);
    // 展示用净值信息: 优先本次, 否则用兜底信息标注 stale
    const displayNav = nav || fb.get(f.code) || null;
    return {
      id: f.id,
      code: f.code,
      name: (nav && nav.name) || f.name || f.code,
      shares: f.shares,
      cost_nav: f.cost_nav,
      share_token: f.share_token || null,
      created_at: f.created_at || '',
      current_nav: currentNav,
      gszzl: nav ? nav.gszzl : 0,
      nav_date: displayNav ? (displayNav.navDate || '') : '',
      nav_stale,
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
 * 对本次 fetchNavBatch 未命中的 code, 从 fund_nav_cache 取上次成功快照作 fallback
 * 用法: 在 buildPortfolio 前调用, 结果作为第 3 参传入
 * @param {Object} storage - getStorage(env)
 * @param {Array} funds - 用户持仓列表(用于枚举 code)
 * @param {Map} navMap - fetchNavBatch 返回的成功 Map
 * @returns {Promise<Map>} code -> { nav, gsz, navDate }
 */
async function enrichNavWithCache(storage, funds, navMap) {
  const fallback = new Map();
  for (const f of funds) {
    if (navMap.has(f.code)) continue;
    const cached = await storage.fund.getNav(f.code);
    if (!cached) continue;
    const nav = +cached.nav || 0;
    const gsz = +cached.gsz || 0;
    if (nav <= 0 && gsz <= 0) continue;
    fallback.set(f.code, { nav, gsz, navDate: cached.nav_date || '' });
  }
  return fallback;
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
  fetchFundNav, fetchNavBatch, fetchNavHistory, calcFundProfit,
  buildPortfolio, enrichNavWithCache, analyzePortfolio,
  applyBuy, calcScenarios, round2
};
