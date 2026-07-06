/**
 * 报告文案模板集中地（日报 / 月报）
 *
 * 基金 / 体重 / 资产三模块的推送文案（text 与 html）统一放在此文件，
 * 想修改推送内容的文字、排版、emoji、链接展示方式，只改这一个文件即可。
 * 各 build*Report 只负责“把已算好的数据拼成字符串”，不做数据计算/取数。
 *
 * 数据计算仍在各自 service：
 *   基金 buildPortfolio → fund.service.js
 *   资产 buildAssetReportData / round2 → asset.service.js
 */

import { fmtDateTime } from './time.service.js';
import { buildChartUrl } from './chart.service.js';
import { round2 } from './asset.service.js';
import { analyzePortfolio } from './fund.service.js';

// ==================== 基金持仓日报 ====================

/**
 * 生成基金日报文本/HTML
 * @param {Object} portfolio - buildPortfolio 结果
 * @param {string} format - 'text' | 'html'
 * @param {Object} linkMap - 可选, { [fundId]: 加仓链接URL }, 有则在每只基金后附上快速加仓链接
 * @param {number} tzOffset - 时区偏移（小时），用于报告时间戳
 * @returns {string}
 */
function buildFundReport(portfolio, format = 'text', linkMap = null, tzOffset = 8) {
  const { items, totals } = portfolio;
  const analysis = analyzePortfolio(portfolio);
  if (format === 'html') return buildFundReportHTML(items, totals, linkMap, tzOffset, analysis);
  return buildFundReportText(items, totals, linkMap, tzOffset, analysis);
}

function fmtSign(n) {
  return (n >= 0 ? '+' : '') + n;
}

/**
 * 持仓分析文本（精简）：仅列组合提示与各基金的异常信号（止盈/止损/高集中度），
 * 过滤 info 级“持有观察”，不含止盈止损净值细节
 */
function buildAnalysisText(analysis) {
  const line = '━━━━━━━━━━━━━━';
  const lines = [];
  (analysis.summary || []).forEach(s => lines.push(`· ${s}`));
  for (const it of analysis.items) {
    const alerts = it.signals.filter(s => s.level !== 'info');
    for (const s of alerts) lines.push(`· ${it.name}：${s.text}`);
  }
  if (lines.length === 0) return '';
  return `${line}\n🔎 持仓分析\n${lines.join('\n')}\n`;
}

function buildFundReportText(items, totals, linkMap, tzOffset, analysis) {
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
  if (analysis) t += `\n${buildAnalysisText(analysis)}`;
  return t;
}

function buildFundReportHTML(items, totals, linkMap, tzOffset, analysis) {
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
  // 持仓分布饼图（仅 HTML；text 无法内嵌图片，故不放）
  const labels = items.map(i => i.name);
  const data = items.map(i => i.value);
  h += `<div><img src="${buildChartUrl({ type: 'doughnut', data: { labels, datasets: [{ data }] } })}" alt="持仓分布"></div>`;
  if (analysis) h += buildFundAnalysisHTML(analysis);
  h += '</div>';
  return h;
}

/** 持仓分析 HTML（完整）：组合提示 + 各基金信号 + 止盈止损参考净值 + 免责声明 */
function buildFundAnalysisHTML(analysis) {
  const SIGNAL_COLOR = { danger: '#cf1322', warn: '#d46b08', success: '#389e0d', info: '#6c757d' };
  let h = `<h3 style="margin:16px 0 8px;">🔎 持仓分析</h3>`;
  if (analysis.summary && analysis.summary.length) {
    h += `<div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:6px;padding:10px;margin-bottom:12px;">
      <b>组合提示</b><ul style="margin:6px 0 0 18px;">`;
    h += analysis.summary.map(s => `<li>${s}</li>`).join('');
    h += `</ul></div>`;
  }
  for (const it of analysis.items) {
    const sig = it.signals.map(s =>
      `<div style="color:${SIGNAL_COLOR[s.level] || '#666'};font-size:14px;">• ${s.text}</div>`
    ).join('');
    h += `<div style="background:#f8f9fa;border-radius:6px;padding:12px;margin-bottom:10px;">
      <div><b>${it.name} (${it.code})</b> · 占比 ${it.weight}%</div>
      ${sig}
      <div style="color:#6c757d;font-size:13px;margin-top:6px;">止损参考净值: ${it.targets.stopLossNav} · 止盈参考净值: ${it.targets.takeProfitNav}</div>
    </div>`;
  }
  h += `<p style="color:#6c757d;font-size:12px;margin-top:8px;">${analysis.disclaimer}</p>`;
  return h;
}

// ==================== 资产月报 ====================

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
 * @param {Object} walletLinkMap - 可选, { [walletId]: 免密录入链接URL }。html 在每个钱包后附“录入”链接；
 *   text 默认不展示（如需在 text 中附上，改此函数 text 分支即可）
 * @returns {string}
 */
function buildAssetReport(reportData, format = 'text', chartLink = '', target = null, walletLinkMap = null) {
  const { latest, latestMonth, prevMonth, netWorthChange, consumeSeries, byType } = reportData;
  const lastConsume = consumeSeries.length ? consumeSeries[consumeSeries.length - 1] : null;
  const remaining = (target != null && target > 0) ? round2(target - latest.netWorth) : null;
  if (format === 'html') return buildAssetReportHTML(reportData, chartLink, target, remaining, lastConsume, walletLinkMap);

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
function buildAssetReportHTML(reportData, chartLink, target, remaining, lastConsume, walletLinkMap) {
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
        const link = walletLinkMap && walletLinkMap[w.id]
          ? ` <a href="${walletLinkMap[w.id]}" style="color:#4a6cf7;font-size:12px;">录入</a>` : '';
        h += `<tr>
          <td style="text-align:left;padding:6px 8px;border-bottom:1px solid #f0f0f0;word-break:break-all;">${w.name}${link}</td>
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

// ==================== 体重日报 ====================

/**
 * 构造体重日报
 * 每个成员：已填当日则显示当日体重，未填则给快速填写链接；附最近7次历史；单位按用户设置；曲线给查看链接
 * @param {Array} members
 * @param {Array} records
 * @param {Object} opts - { format, unit, base, today, tokenMap, reportToken }
 * @returns {string}
 */
function buildWeightReport(members, records, opts) {
  const { format, unit, base, today, tokenMap, reportToken } = opts;
  const unitLabel = unit === 'kg' ? '公斤' : '斤';
  const disp = kg => unit === 'jin' ? Math.round(kg * 2 * 10) / 10 : kg;
  // 按成员分组、按日期排序
  const byMember = new Map();
  for (const r of records) {
    if (!byMember.has(r.member_id)) byMember.set(r.member_id, []);
    byMember.get(r.member_id).push(r);
  }
  for (const arr of byMember.values()) arr.sort((a, b) => a.record_date < b.record_date ? -1 : 1);

  const isHtml = format === 'html';
  const parts = [];
  for (const m of members) {
    const arr = byMember.get(m.id) || [];
    const todayRec = arr.find(r => r.record_date === today);
    const last7 = arr.slice(-7);
    let block = '';
    if (isHtml) {
      block += `<div style="margin:10px 0;padding:12px;background:#f8f9fa;border-radius:6px;">`;
      block += `<b style="font-size:15px;">${m.name}</b><br>`;
      if (todayRec) {
        block += `<span style="color:#389e0d;">今日：${disp(todayRec.weight)} ${unitLabel}</span><br>`;
      } else if (base) {
        block += `<span style="color:#cf1322;">今日未填</span> · <a href="${base}/w/${tokenMap[m.id]}">点此快速填写</a><br>`;
      } else {
        block += `今日未填<br>`;
      }
      if (last7.length) {
        // 最近记录纵向小列表（每条一行），窄屏不挤成一行
        block += `<div style="color:#888;font-size:13px;margin-top:6px;">最近记录：</div>`;
        block += `<table style="width:100%;border-collapse:collapse;font-size:13px;color:#666;">`;
        block += last7.map(r =>
          `<tr><td style="padding:2px 0;text-align:left;">${r.record_date.slice(5)}</td>` +
          `<td style="padding:2px 0;text-align:right;">${disp(r.weight)} ${unitLabel}</td></tr>`
        ).join('');
        block += `</table>`;
      }
      block += `</div>`;
    } else {
      block += `【${m.name}】\n`;
      if (todayRec) block += `　今日：${disp(todayRec.weight)} ${unitLabel}\n`;
      else if (base) block += `　今日未填，快速填写：${base}/w/${tokenMap[m.id]}\n`;
      else block += `　今日未填\n`;
      if (last7.length) {
        block += `　最近记录：\n`;
        block += last7.map(r => `　　${r.record_date.slice(5)}　${disp(r.weight)} ${unitLabel}`).join('\n') + '\n';
      }
    }
    parts.push(block);
  }

  if (isHtml) {
    let h = `<div style="font-family:-apple-system,sans-serif;max-width:600px;"><h2>⚖️ 体重日报</h2>`;
    h += parts.join('');
    if (base && reportToken) h += `<p>📈 <a href="${base}/wr/${reportToken}">查看完整曲线图</a></p>`;
    h += `</div>`;
    return h;
  }
  const line = '━━━━━━━━━━━━━━';
  let t = `⚖️ 体重日报\n${line}\n\n` + parts.join('\n');
  if (base && reportToken) t += `\n📈 查看曲线图：${base}/wr/${reportToken}\n`;
  return t;
}

export { buildFundReport, buildAssetReport, buildWeightReport };
