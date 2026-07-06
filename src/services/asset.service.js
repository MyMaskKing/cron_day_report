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

  // 按钱包类型分组：当月 vs 上月各钱包余额
  const curMap = new Map();  // wallet_id -> balance（当月）
  const prevMap = new Map(); // wallet_id -> balance（上月）
  if (latestMonth) for (const r of byMonth.get(latestMonth)) curMap.set(r.wallet_id, r.balance || 0);
  if (prevMonth) for (const r of byMonth.get(prevMonth)) prevMap.set(r.wallet_id, r.balance || 0);
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

  return {
    months, netWorthSeries, consumeSeries, latest, latestMonth,
    prevMonth, prevNetWorth, netWorthChange, byType
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

/** 钱包类型中文标签 */
const TYPE_LABEL = { bank: '银行卡', alipay: '支付宝', wechat: '微信', investment: '投资', credit: '信用支付', cash: '现金' };

/** 带正负号格式化金额 */
function fmtSign2(n) {
  return (n >= 0 ? '+' : '') + n;
}

/**
 * 生成资产月报文本/HTML
 * @param {Object} reportData - buildAssetReportData 结果
 * @param {string} format - 'text' | 'html'
 * @param {string} chartLink - 可选, 附加的图表链接/标签（text 或 html 片段）
 * @param {number|null} target - 可选, 年度目标净资产, 用于显示"离目标还差多少"
 * @returns {string}
 */
function buildAssetReport(reportData, format = 'text', chartLink = '', target = null) {
  const { latest, latestMonth, prevMonth, netWorthChange, consumeSeries, byType } = reportData;
  const lastConsume = consumeSeries.length ? consumeSeries[consumeSeries.length - 1] : null;
  const remaining = (target != null && target > 0) ? round2(target - latest.netWorth) : null;
  if (format === 'html') return buildAssetReportHTML(reportData, chartLink, target, remaining, lastConsume);

  // ===== text 排版 =====
  const line = '━━━━━━━━━━━━━━';
  let t = `💰 资产月报 ${latestMonth || ''}\n${line}\n`;
  t += `资产合计：${latest.assets}\n`;
  t += `负债(信用)：${latest.debt}\n`;
  t += `净资产：${latest.netWorth}\n`;
  if (netWorthChange != null) t += `较上月(${prevMonth})：${fmtSign2(netWorthChange)}\n`;
  if (lastConsume != null) t += `本月消费(环比)：${lastConsume}\n`;
  if (remaining != null) t += `年度目标：${round2(target)} · 还差：${remaining}\n`;
  // 各类型当月 vs 上月明细
  if (byType && byType.length) {
    t += `${line}\n【当月 vs 上月】\n`;
    for (const g of byType) {
      t += `\n◆ ${TYPE_LABEL[g.type] || g.type}\n`;
      for (const w of g.wallets) {
        const cur = w.cur != null ? w.cur : '—';
        const prev = w.prev != null ? w.prev : '—';
        t += `　${w.name}：${cur}（上月 ${prev}）\n`;
      }
    }
  }
  if (chartLink) t += chartLink;
  return t;
}

/**
 * 资产月报 HTML（手机适配：响应式表格，行内样式以兼容邮件客户端）
 */
function buildAssetReportHTML(reportData, chartLink, target, remaining, lastConsume) {
  const { latest, latestMonth, prevMonth, netWorthChange, byType } = reportData;
  const changeColor = netWorthChange != null && netWorthChange < 0 ? '#cf1322' : '#389e0d';
  let h = `<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:0 4px;">
    <h2 style="font-size:18px;">💰 资产月报 ${latestMonth || ''}</h2>
    <p style="margin:4px 0;">资产合计: <b>${latest.assets}</b> · 负债: ${latest.debt}</p>
    <p style="margin:4px 0;font-weight:bold;color:#4a6cf7;font-size:16px;">净资产: ${latest.netWorth}</p>`;
  if (netWorthChange != null) {
    h += `<p style="margin:4px 0;color:${changeColor};">较上月(${prevMonth}): ${fmtSign2(netWorthChange)} 元</p>`;
  }
  if (lastConsume != null) h += `<p style="margin:4px 0;">本月消费(环比): ${lastConsume} 元</p>`;
  if (remaining != null) {
    h += `<p style="margin:4px 0;">🎯 年度目标 ${round2(target)} · 还差 <b style="color:#cf1322;">${remaining}</b> 元</p>`;
  }
  // 各类型当月 vs 上月响应式表格
  if (byType && byType.length) {
    for (const g of byType) {
      h += `<h3 style="font-size:15px;margin:14px 0 6px;">${TYPE_LABEL[g.type] || g.type}</h3>`;
      h += `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;">
        <thead><tr style="background:#f5f7ff;">
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e6e8f0;word-break:break-all;">钱包</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #e6e8f0;width:28%;">当月</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #e6e8f0;width:28%;">上月</th>
        </tr></thead><tbody>`;
      for (const w of g.wallets) {
        const cur = w.cur != null ? w.cur : '—';
        const prev = w.prev != null ? w.prev : '—';
        h += `<tr>
          <td style="text-align:left;padding:6px 8px;border-bottom:1px solid #f0f0f0;word-break:break-all;">${w.name}</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #f0f0f0;">${cur}</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#999;">${prev}</td>
        </tr>`;
      }
      h += `</tbody></table>`;
    }
  }
  if (chartLink) h += chartLink;
  h += `</div>`;
  return h;
}

export {
  calcNetWorth, buildAssetReport, buildAssetReportData, calcGoalProgress, resolveInvestment, round2, CREDIT_TYPE
};
