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
 * @returns {Object} { months, netWorthSeries, consumeSeries, latest }
 *   netWorthSeries: 各月净资产
 *   consumeSeries:  各月消费（上月净资产 − 本月净资产），首月为 null
 */
function buildAssetReport(wallets, records) {
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
  const latest = latestMonth
    ? calcNetWorth(byMonth.get(latestMonth), walletType)
    : { assets: 0, debt: 0, netWorth: 0 };

  return { months, netWorthSeries, consumeSeries, latest, latestMonth };
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

export { calcNetWorth, buildAssetReport, calcGoalProgress, round2, CREDIT_TYPE };
