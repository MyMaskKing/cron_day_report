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
 * @returns {Object} { months, netWorthSeries, consumeSeries, latest }
 *   netWorthSeries: 各月净资产
 *   consumeSeries:  各月消费（上月净资产 − 本月净资产），首月为 null
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

/**
 * 生成资产月报文本/HTML
 * @param {Object} report - buildAssetReport 结果
 * @param {string} format - 'text' | 'html'
 * @param {string} chartImg - 可选, HTML 格式下附加的图表 <img> 标签
 * @returns {string}
 */
function buildAssetReport(reportData, format = 'text', chartImg = '') {
  const { latest, latestMonth, months, netWorthSeries, consumeSeries } = reportData;
  const lastConsume = consumeSeries.length ? consumeSeries[consumeSeries.length - 1] : null;
  if (format === 'html') {
    let h = `<div style="font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;">
      <h2>💰 资产月报 ${latestMonth || ''}</h2>
      <p>资产合计: ${latest.assets} · 负债: ${latest.debt}</p>
      <p style="font-weight:bold;color:#4a6cf7;">净资产: ${latest.netWorth}</p>
      ${lastConsume != null ? `<p>本月消费(环比): ${lastConsume}</p>` : ''}
      ${chartImg || ''}
    </div>`;
    return h;
  }
  let t = `💰 资产月报 ${latestMonth || ''}\n\n`;
  t += `资产合计: ${latest.assets}\n负债(信用): ${latest.debt}\n净资产: ${latest.netWorth}\n`;
  if (lastConsume != null) t += `本月消费(环比): ${lastConsume}\n`;
  return t;
}

export {
  calcNetWorth, buildAssetReport, buildAssetReportData, calcGoalProgress, resolveInvestment, round2, CREDIT_TYPE
};
