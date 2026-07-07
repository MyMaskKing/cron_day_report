/**
 * 资产服务：净资产计算、环比消费、月度趋势报表
 * 约定：金额单位元；信用支付(credit)为负债，计入净资产时为负
 * 投资钱包(investment)总额 = principal + profit，已在录入时写入 balance
 */

const CREDIT_TYPE = 'credit';

/** 保留两位小数 */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * 投资钱包字段解析：输入总资产 + 持有收益，反算本金
 * 本金 = 总资产 − 收益；钱包合计用总资产(balance)
 * @param {number} total - 总资产（当前市值）
 * @param {number} profit - 持有收益
 * @returns {Object} { balance, principal, profit }
 */
function resolveInvestment(total, profit) {
  const t = parseFloat(total) || 0;
  const p = parseFloat(profit) || 0;
  return { balance: t, principal: round2(t - p), profit: p };
}

/**
 * 计算某月净资产
 * 净资产 = 非信用钱包余额之和 − 信用钱包余额之和
 * @param {Array} records - 该月各钱包记录 [{ wallet_id, balance }]
 * @param {Map} walletType - wallet_id -> type
 * @returns {Object} { assets, debt, netWorth }
 */
function calcNetWorth(records, walletType) {
  let assets = 0, debt = 0;
  for (const r of records) {
    const type = walletType.get(r.wallet_id);
    if (type === CREDIT_TYPE) debt += r.balance || 0;
    else assets += r.balance || 0;
  }
  return { assets: round2(assets), debt: round2(debt), netWorth: round2(assets - debt) };
}

/**
 * 构建月度趋势报表
 * @param {Array} wallets - 用户钱包 [{ id, type, name }]
 * @param {Array} records - 全部月度记录 [{ wallet_id, month, balance }]
 * @returns {Object} { months, netWorthSeries, consumeSeries, latest, latestMonth,
 *   prevMonth, prevNetWorth, netWorthChange, byType }
 *   netWorthSeries: 各月净资产
 *   consumeSeries:  各月消费（上月净资产 − 本月净资产），首月为 null
 *   byType: 按钱包类型分组的当月/上月对比 [{ type, wallets:[{ id, name, cur, prev }] }]
 *   byTypeTotal: 各类型最新月合计 [{ type, balance, principal, profit }]
 */
function buildAssetReportData(wallets, records) {
  const walletType = new Map(wallets.map(w => [w.id, w.type]));

  // 按月分组
  const byMonth = new Map();
  for (const r of records) {
    if (!byMonth.has(r.month)) byMonth.set(r.month, []);
    byMonth.get(r.month).push(r);
  }
  const months = [...byMonth.keys()].sort();

  const netWorthSeries = [];
  const consumeSeries = [];
  months.forEach((m, i) => {
    const nw = calcNetWorth(byMonth.get(m), walletType).netWorth;
    netWorthSeries.push(nw);
    if (i === 0) {
      consumeSeries.push(null);
    } else {
      // 消费 = 上月净资产 − 本月净资产（余额减少即消费）
      consumeSeries.push(round2(netWorthSeries[i - 1] - nw));
    }
  });

  const latestMonth = months.length ? months[months.length - 1] : null;
  const prevMonth = months.length >= 2 ? months[months.length - 2] : null;
  const latest = latestMonth
    ? calcNetWorth(byMonth.get(latestMonth), walletType)
    : { assets: 0, debt: 0, netWorth: 0 };
  const prevNetWorth = prevMonth ? netWorthSeries[netWorthSeries.length - 2] : null;
  // 本月净资产较上月涨幅金额（正=增长）
  const netWorthChange = prevNetWorth != null ? round2(latest.netWorth - prevNetWorth) : null;

  // 按钱包类型分组：当月 vs 上月各钱包余额（同钱包同月多条累加）
  const curMap = new Map();  // wallet_id -> balance（当月合计）
  const prevMap = new Map(); // wallet_id -> balance（上月合计）
  if (latestMonth) for (const r of byMonth.get(latestMonth)) curMap.set(r.wallet_id, (curMap.get(r.wallet_id) || 0) + (r.balance || 0));
  if (prevMonth) for (const r of byMonth.get(prevMonth)) prevMap.set(r.wallet_id, (prevMap.get(r.wallet_id) || 0) + (r.balance || 0));
  const typeOrder = [];
  const typeGroup = new Map(); // type -> [{ id, name, cur, prev }]
  for (const w of wallets) {
    // 只展示当月或上月有记录的钱包
    if (!curMap.has(w.id) && !prevMap.has(w.id)) continue;
    if (!typeGroup.has(w.type)) { typeGroup.set(w.type, []); typeOrder.push(w.type); }
    typeGroup.get(w.type).push({
      id: w.id, name: w.name,
      cur: curMap.has(w.id) ? round2(curMap.get(w.id)) : null,
      prev: prevMap.has(w.id) ? round2(prevMap.get(w.id)) : null
    });
  }
  const byType = typeOrder.map(type => ({ type, wallets: typeGroup.get(type) }));

  // 各类型最新月合计（同类型所有钱包 balance 累加；投资类附本金/收益合计）
  const typeTotalMap = new Map(); // type -> { balance, principal, profit }
  if (latestMonth) {
    for (const r of byMonth.get(latestMonth)) {
      const type = walletType.get(r.wallet_id);
      if (!type) continue;
      if (!typeTotalMap.has(type)) typeTotalMap.set(type, { balance: 0, principal: 0, profit: 0 });
      const acc = typeTotalMap.get(type);
      acc.balance += r.balance || 0;
      acc.principal += r.principal || 0;
      acc.profit += r.profit || 0;
    }
  }
  const byTypeTotal = [...typeTotalMap.entries()].map(([type, v]) => ({
    type, balance: round2(v.balance), principal: round2(v.principal), profit: round2(v.profit)
  }));

  return {
    months, netWorthSeries, consumeSeries, latest, latestMonth,
    prevMonth, prevNetWorth, netWorthChange, byType, byTypeTotal
  };
}

/**
 * 计算年度目标进度
 * @param {number} target - 目标净资产
 * @param {number} current - 当前净资产
 * @returns {Object} { target, current, remaining, progress }
 */
function calcGoalProgress(target, current) {
  const remaining = round2(target - current);
  const progress = target > 0 ? round2((current / target) * 100) : 0;
  return { target: round2(target), current: round2(current), remaining, progress };
}

export {
  calcNetWorth, buildAssetReportData, calcGoalProgress, resolveInvestment, round2, CREDIT_TYPE
};
