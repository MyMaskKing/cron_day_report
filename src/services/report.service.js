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

import { fmtDateTime, localParts } from './time.service.js';
import { buildChartUrl } from './chart.service.js';
import { round2 } from './asset.service.js';
import { analyzePortfolio } from './fund.service.js';

// ==================== 基金持仓日报 ====================

/**
 * 生成基金日报文本/HTML/Markdown
 * @param {Object} portfolio - buildPortfolio 结果
 * @param {string} format - 'text' | 'html' | 'markdown'
 * @param {Object} linkMap - 可选, { [fundId]: 加仓链接URL }, 有则在每只基金后附上快速加仓链接
 * @param {number} tzOffset - 时区偏移（小时），用于报告时间戳
 * @param {string} reportLink - 可选, 免密报告页链接（持仓分布饼图）；有则替代 QuickChart 直链
 * @param {Object} profitDelta - 可选, { today, yesterday, delta } 今日总收益较昨日差额；有则在总收益行下展示
 * @returns {string}
 */
function buildFundReport(portfolio, format = 'text', linkMap = null, tzOffset = 8, reportLink = '', profitDelta = null) {
  const { items, totals } = portfolio;
  const analysis = analyzePortfolio(portfolio);
  if (format === 'html') return buildFundReportHTML(items, totals, linkMap, tzOffset, analysis, reportLink, profitDelta);
  if (format === 'markdown') return buildFundReportMarkdown(items, totals, linkMap, tzOffset, analysis, reportLink, profitDelta);
  return buildFundReportText(items, totals, linkMap, tzOffset, analysis, reportLink, profitDelta);
}

function fmtSign(n) {
  return (n >= 0 ? '+' : '') + n;
}

/** 日报标题日期后缀，如 (07/09)，按时区偏移取当天月/日 */
function titleDate(tzOffset = 8) {
  const p = localParts(Date.now(), tzOffset);
  const pad = n => (n < 10 ? '0' : '') + n;
  return ` (${pad(p.month)}/${pad(p.day)})`;
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

function buildFundReportText(items, totals, linkMap, tzOffset, analysis, reportLink = '', profitDelta = null) {
  const line = '━━━━━━━━━━━━━━';
  let t = `📈 基金持仓日报${titleDate(tzOffset)}\n🕐 ${fmtDateTime(Date.now(), tzOffset)}\n${line}\n`;
  t += `💰 总本金：${totals.cost}\n`;
  t += `📈 现　值：${totals.value}\n`;
  t += `📊 总收益：${fmtSign(totals.profit)}（${fmtSign(totals.rate)}%）\n`;
  if (profitDelta && profitDelta.delta != null) t += `📅 较昨日：${fmtSign(round2(profitDelta.delta))} 元\n`;
  else t += `📅 暂无昨日对比数据，次日 15:00 后可见\n`;
  t += `${line}\n`;
  items.forEach((it, i) => {
    const icon = it.profit >= 0 ? '🔴' : '🟢';
    t += `\n${icon} ${i + 1}. ${it.name}（${it.code}）\n`;
    t += `　持仓：${it.shares} 份\n`;
    t += `　现价：${it.current_nav}（${fmtSign(it.gszzl)}%）\n`;
    t += `　收益：${fmtSign(it.profit)}（${fmtSign(it.rate)}%）\n`;
    if (linkMap && linkMap[it.id]) t += `　➕ 快速加仓：${linkMap[it.id]}\n`;
  });
  if (reportLink) t += `\n📊 查看持仓分布图：${reportLink}\n`;
  if (analysis) t += `\n${buildAnalysisText(analysis)}`;
  return t;
}

/**
 * 持仓分析 Markdown（精简，同 text 口径）：组合提示 + 各基金异常信号，过滤 info 级
 */
function buildAnalysisMarkdown(analysis) {
  const lines = [];
  (analysis.summary || []).forEach(s => lines.push(`- ${s}`));
  for (const it of analysis.items) {
    const alerts = it.signals.filter(s => s.level !== 'info');
    for (const s of alerts) lines.push(`- **${it.name}**：${s.text}`);
  }
  if (lines.length === 0) return '';
  return `\n**🔎 持仓分析**\n${lines.join('\n')}\n`;
}

function buildFundReportMarkdown(items, totals, linkMap, tzOffset, analysis, reportLink = '', profitDelta = null) {
  let m = `## 📈 基金持仓日报${titleDate(tzOffset)}\n🕐 ${fmtDateTime(Date.now(), tzOffset)}\n\n`;
  m += `💰 总本金：**${totals.cost}** · 现值：**${totals.value}**\n`;
  m += `📊 总收益：**${fmtSign(totals.profit)}（${fmtSign(totals.rate)}%）**\n`;
  if (profitDelta && profitDelta.delta != null) m += `📅 较昨日：**${fmtSign(round2(profitDelta.delta))} 元**\n`;
  else m += `📅 暂无昨日对比数据，次日 15:00 后可见\n`;
  items.forEach((it, i) => {
    const icon = it.profit >= 0 ? '🔴' : '🟢';
    m += `\n${icon} **${i + 1}. ${it.name}（${it.code}）**\n`;
    m += `> 持仓 ${it.shares} 份 · 现价 ${it.current_nav}（${fmtSign(it.gszzl)}%）\n`;
    m += `> 收益 ${fmtSign(it.profit)}（${fmtSign(it.rate)}%）\n`;
    if (linkMap && linkMap[it.id]) m += `> [➕ 快速加仓](${linkMap[it.id]})\n`;
  });
  // 持仓分布饼图：有免密报告页链接则用之，否则回退 QuickChart 图 URL
  if (reportLink) {
    m += `\n[📊 查看持仓分布图](${reportLink})\n`;
  } else {
    const labels = items.map(i => i.name);
    const data = items.map(i => i.value);
    const chartUrl = buildChartUrl({ type: 'doughnut', data: { labels, datasets: [{ data }] } });
    m += `\n[📊 查看持仓分布图](${chartUrl})\n`;
  }
  if (analysis) m += buildAnalysisMarkdown(analysis);
  return m;
}

function buildFundReportHTML(items, totals, linkMap, tzOffset, analysis, reportLink = '', profitDelta = null) {
  const profitColor = totals.profit >= 0 ? '#cf1322' : '#389e0d';
  let h = `<div style="font-family:-apple-system,sans-serif;max-width:800px;margin:0 auto;">
    <h2>📈 基金持仓日报</h2>
    <p>${fmtDateTime(Date.now(), tzOffset)}</p>
    <p>💰 总本金: ${totals.cost} · 现值: ${totals.value}</p>
    <p style="color:${profitColor};font-weight:bold;">📊 总收益: ${fmtSign(totals.profit)} (${fmtSign(totals.rate)}%)</p>`;
  if (profitDelta && profitDelta.delta != null) {
    const deltaColor = profitDelta.delta >= 0 ? '#cf1322' : '#389e0d';
    h += `<p style="color:${deltaColor};">📅 较昨日: ${fmtSign(round2(profitDelta.delta))} 元</p>`;
  } else {
    h += `<p style="color:#999;font-size:13px;">📅 暂无昨日对比数据，次日 15:00 后可见</p>`;
  }
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
  // 持仓分布饼图：有免密报告页则链接到免密页（可交互 + 快速登录），否则回退 QuickChart 图 URL
  const chartHref = reportLink || buildChartUrl({ type: 'doughnut', data: { labels: items.map(i => i.name), datasets: [{ data: items.map(i => i.value) }] } });
  h += `<div style="margin:12px 0;"><a href="${chartHref}" target="_blank" rel="noopener" style="display:inline-block;padding:8px 14px;background:#4a6cf7;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;">📊 点击查看持仓分布饼状图</a></div>`;
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
  const { latest, latestMonth, prevMonth, netWorthChange, byType } = reportData;
  const remaining = (target != null && target > 0) ? round2(target - latest.netWorth) : null;
  if (format === 'html') return buildAssetReportHTML(reportData, chartLink, target, remaining, walletLinkMap);
  if (format === 'markdown') return buildAssetReportMarkdown(reportData, chartLink, target, remaining, walletLinkMap);

  // ===== text 排版 =====
  const line = '━━━━━━━━━━━━━━';
  let t = `💰 资产月报 ${latestMonth || ''}\n${line}\n`;
  t += `资产合计：${latest.assets}\n`;
  t += `负债(信用)：${latest.debt}\n`;
  t += `净资产：${latest.netWorth}\n`;
  if (netWorthChange != null) t += `较上月(${prevMonth})：${fmtSign2(netWorthChange)}\n`;
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
 * 资产月报 Markdown（表格降级为列表；企业微信 markdown 不支持表格/图片）
 * 钱包附 [录入] 免密链接；趋势图链接由调用方经 chartLink 传入
 */
function buildAssetReportMarkdown(reportData, chartLink, target, remaining, walletLinkMap) {
  const { latest, latestMonth, prevMonth, netWorthChange, byType } = reportData;
  let m = `## 💰 资产月报 ${latestMonth || ''}\n`;
  m += `资产合计：**${latest.assets}** · 负债：${latest.debt}\n`;
  m += `净资产：**${latest.netWorth}**\n`;
  if (netWorthChange != null) m += `较上月(${prevMonth})：${fmtSign2(netWorthChange)}\n`;
  if (remaining != null) m += `🎯 年度目标 ${round2(target)} · 还差 **${remaining}**\n`;
  // 各类型当月 vs 上月：降级为列表
  if (byType && byType.length) {
    for (const g of byType) {
      m += `\n**${TYPE_LABEL[g.type] || g.type}**\n`;
      for (const w of g.wallets) {
        const cur = w.cur != null ? w.cur : '—';
        const prev = w.prev != null ? w.prev : '—';
        const link = walletLinkMap && walletLinkMap[w.id] ? ` [录入](${walletLinkMap[w.id]})` : '';
        m += `- ${w.name}：${cur}（上月 ${prev}）${link}\n`;
      }
    }
  }
  if (chartLink) m += chartLink;
  return m;
}

/**
 * 资产月报 HTML（手机适配：响应式表格，行内样式以兼容邮件客户端）
 */
function buildAssetReportHTML(reportData, chartLink, target, remaining, walletLinkMap) {
  const { latest, latestMonth, prevMonth, netWorthChange, byType } = reportData;
  const changeColor = netWorthChange != null && netWorthChange < 0 ? '#cf1322' : '#389e0d';
  let h = `<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:0 4px;">
    <h2 style="font-size:18px;">💰 资产月报 ${latestMonth || ''}</h2>
    <p style="margin:4px 0;">资产合计: <b>${latest.assets}</b> · 负债: ${latest.debt}</p>
    <p style="margin:4px 0;font-weight:bold;color:#4a6cf7;font-size:16px;">净资产: ${latest.netWorth}</p>`;
  if (netWorthChange != null) {
    h += `<p style="margin:4px 0;color:${changeColor};">较上月(${prevMonth}): ${fmtSign2(netWorthChange)} 元</p>`;
  }
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
 * 取成员记录最近 7 条（按时间倒序），每条附较前一条的体重差（kg）
 * @param {Array} arr - 已按 record_date 升序排序的记录
 * @returns {Array} [{ r, delta }] delta 为 null 表示无更早记录
 */
function recentWithDelta(arr) {
  const last7 = arr.slice(-7);
  const start = arr.length - last7.length;
  return last7
    .map((r, i) => ({ r, delta: (start + i) > 0 ? r.weight - arr[start + i - 1].weight : null }))
    .reverse();
}

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
  if (format === 'markdown') return buildWeightReportMarkdown(members, records, opts);
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
        block += `<span style="color:#389e0d;">今日：${disp(todayRec.weight)} ${unitLabel}</span>`;
        if (base) block += ` · <a href="${base}/w/${tokenMap[m.id]}" style="display:inline-block;padding:2px 10px;background:#4a6cf7;color:#fff;border-radius:4px;text-decoration:none;font-size:13px;">快速录入</a>`;
        block += `<br>`;
      } else if (base) {
        block += `<span style="color:#cf1322;">今日未填</span> · <a href="${base}/w/${tokenMap[m.id]}" style="display:inline-block;padding:2px 10px;background:#4a6cf7;color:#fff;border-radius:4px;text-decoration:none;font-size:13px;">快速录入</a><br>`;
      } else {
        block += `今日未填<br>`;
      }
      if (last7.length) {
        // 最近记录纵向小列表（倒序，每条一行），附较前一日增减；增重红色加粗
        block += `<div style="color:#888;font-size:13px;margin-top:6px;">最近记录：</div>`;
        block += `<table style="width:100%;border-collapse:collapse;font-size:13px;color:#666;">`;
        block += recentWithDelta(arr).map(({ r, delta }) => {
          let deltaHtml = '';
          if (delta != null) {
            const dv = disp(Math.abs(delta));
            if (delta > 0) deltaHtml = ` <span style="color:#cf1322;font-weight:700;">(+${dv} ${unitLabel})</span>`;
            else if (delta < 0) deltaHtml = ` <span style="color:#389e0d;">(-${dv} ${unitLabel})</span>`;
          }
          return `<tr><td style="padding:2px 0;text-align:left;">${r.record_date.slice(5)}</td>` +
            `<td style="padding:2px 0;text-align:right;">${disp(r.weight)} ${unitLabel}${deltaHtml}</td></tr>`;
        }).join('');
        block += `</table>`;
      }
      block += `</div>`;
    } else {
      block += `【${m.name}】\n`;
      if (todayRec) block += base ? `　今日：${disp(todayRec.weight)} ${unitLabel}，快速录入：${base}/w/${tokenMap[m.id]}\n` : `　今日：${disp(todayRec.weight)} ${unitLabel}\n`;
      else if (base) block += `　今日未填，快速录入：${base}/w/${tokenMap[m.id]}\n`;
      else block += `　今日未填\n`;
      if (last7.length) {
        block += `　最近记录：\n`;
        block += recentWithDelta(arr).map(({ r, delta }) => {
          let d = '';
          if (delta != null) {
            const dv = disp(Math.abs(delta));
            // text 无颜色，增重用 ⚠️+↑ 着重标明
            if (delta > 0) d = `（⚠️ +${dv} ${unitLabel} ↑）`;
            else if (delta < 0) d = `（-${dv} ${unitLabel}）`;
          }
          return `　　${r.record_date.slice(5)}　${disp(r.weight)} ${unitLabel}${d}`;
        }).join('\n') + '\n';
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
  let t = `⚖️ 体重日报${today && today.length >= 10 ? ` (${today.slice(5, 7)}/${today.slice(8, 10)})` : ''}\n${line}\n\n` + parts.join('\n');
  if (base && reportToken) t += `\n📈 查看曲线图：${base}/wr/${reportToken}\n`;
  return t;
}

/**
 * 体重日报 Markdown：成员名加粗，填写/曲线链接用 markdown 语法
 */
function buildWeightReportMarkdown(members, records, opts) {
  const { unit, base, today, tokenMap, reportToken } = opts;
  const unitLabel = unit === 'kg' ? '公斤' : '斤';
  const disp = kg => unit === 'jin' ? Math.round(kg * 2 * 10) / 10 : kg;
  const byMember = new Map();
  for (const r of records) {
    if (!byMember.has(r.member_id)) byMember.set(r.member_id, []);
    byMember.get(r.member_id).push(r);
  }
  for (const arr of byMember.values()) arr.sort((a, b) => a.record_date < b.record_date ? -1 : 1);

  let m = `## ⚖️ 体重日报${today && today.length >= 10 ? ` (${today.slice(5, 7)}/${today.slice(8, 10)})` : ''}\n`;
  for (const mem of members) {
    const arr = byMember.get(mem.id) || [];
    const todayRec = arr.find(r => r.record_date === today);
    const last7 = arr.slice(-7);
    m += `\n**${mem.name}**\n`;
    if (todayRec) m += base ? `> 今日：${disp(todayRec.weight)} ${unitLabel} · [快速录入](${base}/w/${tokenMap[mem.id]})\n` : `> 今日：${disp(todayRec.weight)} ${unitLabel}\n`;
    else if (base) m += `> 今日未填 · [快速录入](${base}/w/${tokenMap[mem.id]})\n`;
    else m += `> 今日未填\n`;
    if (last7.length) {
      // 倒序逐行，附较前一日增减；增重用加粗着重
      const hist = recentWithDelta(arr).map(({ r, delta }) => {
        let d = '';
        if (delta != null) {
          const dv = disp(Math.abs(delta));
          if (delta > 0) d = ` **(+${dv}${unitLabel} ↑)**`;
          else if (delta < 0) d = ` (-${dv}${unitLabel})`;
        }
        return `${r.record_date.slice(5)} ${disp(r.weight)}${unitLabel}${d}`;
      }).join('\n> ');
      m += `> 最近：\n> ${hist}\n`;
    }
  }
  if (base && reportToken) m += `\n[📈 查看完整曲线图](${base}/wr/${reportToken})\n`;
  return m;
}

// ==================== 待办日报 ====================

/** 优先级图标（高/中/低） */
const TODO_PRI_ICON = { 2: '🔴', 1: '🟡', 0: '⚪' };
const TODO_PRI_LABEL = { 2: '高', 1: '中', 0: '低' };

/**
 * 待办日报的顶层筛选：仅保留"截止=今天 或 已逾期"的顶层任务
 * 子任务日期继承顶层，故按顶层 due_date 判断整棵树
 * @param {Array} trees - flattenPending 后的未完成任务树
 * @param {string} today - 北京时区当天 YYYY-MM-DD
 * @returns {Array} 过滤并按截止日期倒序（晚→早，无日期排最后）的顶层树
 */
function filterTodayOverdue(trees, today) {
  const kept = trees.filter(t => t.due_date && today && t.due_date <= today);
  // 截止日期倒序：日期晚的在前；同日期按 id 稳定
  kept.sort((a, b) => {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? 1 : -1;
    return (a.id || 0) - (b.id || 0);
  });
  return kept;
}

/** 待办日报标题日期后缀，如 （07/09） */
function todoTitleDate(today) {
  if (!today || today.length < 10) return '';
  return `（${today.slice(5, 7)}/${today.slice(8, 10)}）`;
}

/**
 * 待办日报提醒语：按"当天第 seq 次 / 共 total 次推送"给温和→强烈三档提示
 * 首次温和鼓励，中间催促，末次（当天最后一次）强烈提醒抓紧
 * @param {number} pending - 未完成项数
 * @param {number} seq - 当天第几次推送（1-based）
 * @param {number} total - 当天共推送几次
 * @returns {string} 无有效序号时返回空串
 */
function todoRemindText(pending, seq, total) {
  if (!seq || !total || total < 1) return '';
  if (seq >= total && total > 1) return `⏰ 今天快结束了，还剩 ${pending} 个待办没完成，抓紧最后时间处理！`;
  if (seq <= 1) return `☀️ 今天还有 ${pending} 个待办，安排上，加油完成吧 💪`;
  return `⌛ 还有 ${pending} 个待办未完成，别拖啦，尽快推进～`;
}

/**
 * 生成待办日报文本/HTML/Markdown
 * 仅呈现"截止今天或已逾期"的未完成顶层任务（含其未完成子任务），顶层按截止日期倒序
 * @param {Array} trees - flattenPending 后的未完成任务树
 * @param {Object} opts - { format, base, token, reportToken, today, stats, seq, total }
 *   token: 顶层无 token 时可为 null；base+token 有值则在末尾附免密协作链接
 *   reportToken: 免密报告查看页 token
 *   seq/total: 当天第几次/共几次推送，用于分档提醒语（缺省不显示提醒语）
 * @returns {string}
 */
function buildTodoReport(trees, opts = {}) {
  const { format = 'text', base = '', token = null, reportToken = null, today = '', seq = null, total = null } = opts;
  // 仅留截止今天/逾期的顶层任务，并按截止日期倒序
  const sorted = filterTodayOverdue(trees, today);
  // 日报口径统计：基于筛选后的树，统计未完成任务数与其中逾期数（含子任务）
  const stats = statsOfReport(sorted, today);
  // 分档提醒语：按当天第几次/共几次推送，温和→强烈
  const remind = todoRemindText(stats.pending, seq, total);
  if (format === 'html') return buildTodoReportHTML(sorted, base, token, reportToken, today, stats, remind);
  if (format === 'markdown') return buildTodoReportMarkdown(sorted, base, token, reportToken, today, stats, remind);
  return buildTodoReportText(sorted, base, token, reportToken, today, stats, remind);
}

/** 统计筛选后树里的未完成任务数与逾期数
 * 叶子口径：有子任务的父任务不计入，只统计末端叶子（与列表页 countStats 一致）；
 * 子任务逾期继承顶层祖先的截止日期 */
function statsOfReport(trees, today) {
  let pending = 0, overdue = 0;
  const walk = (node, rootDue) => {
    if (node.children.length > 0) {
      // 有子任务：父不计入，仅递归统计子任务
      for (const c of node.children) walk(c, rootDue);
      return;
    }
    // 叶子任务：未完成才计入
    if (!node.done) {
      pending++;
      if (rootDue && today && rootDue < today) overdue++;
    }
  };
  for (const root of trees) walk(root, root.due_date);
  return { pending, overdue };
}

/** 日报里任务的日期标签：逾期红色标注，否则普通显示；dueDate 为继承后的有效日期
 * 显示只取月/日（MM/DD），逾期判断仍用完整日期
 * 日报只含今天到期或逾期(filterTodayOverdue)，非逾期即当天到期，用醒目徽章突出 */
function todoDateTag(dueDate, today, kind) {
  if (!dueDate) return '';
  const over = today && dueDate < today;
  const disp = dueDate.length >= 10 ? `${dueDate.slice(5, 7)}/${dueDate.slice(8, 10)}` : dueDate;
  if (kind === 'html') {
    const pill = 'display:inline-block;border-radius:11px;padding:1px 10px;font-size:12px;font-weight:600;line-height:1.7;margin-left:2px;';
    return over
      ? ` <span style="${pill}background:#fff1f0;color:#cf1322;">⚠️ 逾期 ${disp}</span>`
      : ` <span style="${pill}background:#e6f4ff;color:#0958d9;">📌 今日 ${disp}</span>`;
  }
  if (kind === 'markdown') {
    return over ? ` **⚠️ 逾期 ${disp}**` : ` **📌 今日 ${disp}**`;
  }
  return over ? ` ⚠️逾期 ${disp}` : ` 📌今日 ${disp}`;
}

function buildTodoReportText(trees, base, token, reportToken, today, stats, remind = '') {
  const line = '━━━━━━━━━━━━━━';
  let t = `📝 待办日报${todoTitleDate(today)}\n${line}\n`;
  if (stats) t += `未完成 ${stats.pending} 项${stats.overdue ? `，其中逾期 ${stats.overdue} 项` : ''}\n`;
  if (remind) t += `${remind}\n`;
  t += `${line}\n`;
  // 子任务用树形连接线体现从属；方块 ▪ 与主任务圆点形成形状对比；子任务不标优先级，日期继承主任务
  const walkChild = (node, prefix, isLast) => {
    const cat = node.category ? `〔${node.category}〕` : '';
    t += `${prefix}${isLast ? '└─ ' : '├─ '}▪ ${node.title}${cat}\n`;
    const childPrefix = prefix + (isLast ? '   ' : '│  ');
    node.children.forEach((c, i) => walkChild(c, childPrefix, i === node.children.length - 1));
  };
  trees.forEach((root, ri) => {
    if (ri > 0) t += '\n';
    const cat = root.category ? `〔${root.category}〕` : '';
    // 主任务：竖条 ▍ 作层级标识 + 彩色圆点表优先级
    t += `▍${TODO_PRI_ICON[root.priority] || '⚪'} ${root.title}${cat}${todoDateTag(root.due_date, today, 'text')}\n`;
    root.children.forEach((c, i) => walkChild(c, '', i === root.children.length - 1));
  });
  if (trees.length === 0) t += '🎉 今日无到期或逾期待办\n';
  if (base && reportToken) t += `\n➕ 协作添加/勾选：${base}/tc/${reportToken}\n`;
  if (base && reportToken) t += `📋 查看全部待办：${base}/tr/${reportToken}\n`;
  return t;
}

function buildTodoReportMarkdown(trees, base, token, reportToken, today, stats, remind = '') {
  let m = `## 📝 待办日报${todoTitleDate(today)}\n`;
  if (stats) m += `未完成 **${stats.pending}** 项${stats.overdue ? ` · 逾期 **${stats.overdue}** 项` : ''}\n`;
  if (remind) m += `${remind}\n`;
  // 子任务用嵌套列表；方块 ▪ 与主任务圆点形成形状对比；子任务不标优先级，日期继承主任务
  const walkChild = (node, depth) => {
    const indent = '  '.repeat(depth);
    const cat = node.category ? ` \`${node.category}\`` : '';
    m += `${indent}- ▪ ${node.title}${cat}\n`;
    for (const c of node.children) walkChild(c, depth + 1);
  };
  for (const root of trees) {
    const cat = root.category ? ` \`${root.category}\`` : '';
    // 主任务：竖条 ▍ 作层级标识 + 彩色圆点表优先级
    m += `\n**▍${TODO_PRI_ICON[root.priority] || '⚪'} ${root.title}**${cat}${todoDateTag(root.due_date, today, 'markdown')}\n`;
    for (const c of root.children) walkChild(c, 0);
  }
  if (trees.length === 0) m += `\n🎉 今日无到期或逾期待办\n`;
  if (base && reportToken) m += `\n[➕ 协作添加/勾选](${base}/tc/${reportToken})\n`;
  if (base && reportToken) m += `[📋 查看全部待办](${base}/tr/${reportToken})\n`;
  return m;
}

function buildTodoReportHTML(trees, base, token, reportToken, today, stats, remind = '') {
  let h = `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
    <h2 style="font-size:18px;">📝 待办日报${todoTitleDate(today)}</h2>`;
  if (stats) {
    h += `<p style="margin:4px 0;color:#4a6cf7;font-weight:600;">未完成 ${stats.pending} 项`;
    if (stats.overdue) h += ` · <span style="color:#cf1322;">逾期 ${stats.overdue} 项</span>`;
    h += `</p>`;
  }
  if (remind) h += `<p style="margin:6px 0;padding:8px 12px;background:#fff7e6;border-left:3px solid #fa8c16;border-radius:4px;color:#874d00;font-size:14px;">${remind}</p>`;
  // 优先级圆点色板（红=高 琥珀=中 灰=低）；与网页端 .todo-dot 一致，仅表达优先级
  const PRI_DOT = { 2: '#e5484d', 1: '#e8a317', 0: '#b4bccb' };
  // 内联圆点：邮件客户端 emoji 渲染不一，用 background 画点更统一可控
  const dot = (p) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${PRI_DOT[p] || '#b4bccb'};margin-right:6px;vertical-align:middle;"></span>`;
  const catTag = (c) => c
    ? ` <span style="background:#eef1ff;color:#4a6cf7;border-radius:4px;padding:1px 7px;font-size:12px;">${c}</span>` : '';
  // 子任务：卡片内缩进 + 左侧连接线，明确从属于上方主任务；优先级用圆点
  const walkChild = (node) => {
    h += `<div style="margin:4px 0 4px 14px;padding:5px 10px;border-left:2px solid #e3e8f0;">
      ${dot(node.priority)}<span style="font-size:13px;color:#333;vertical-align:middle;">${node.title}</span>${catTag(node.category)}
    </div>`;
    for (const c of node.children) walkChild(c);
  };
  for (const root of trees) {
    // 主任务卡片：品牌蓝分组条头（层级通道）+ 优先级圆点 + 加粗标题 + 日期只此一处
    h += `<div style="margin:14px 0;border:1px solid #eceff5;border-radius:8px;overflow:hidden;">
      <div style="padding:9px 12px;background:#f7f8fa;border-left:4px solid #4a6cf7;">
        ${dot(root.priority)}<span style="font-size:15px;font-weight:700;color:#1f2430;vertical-align:middle;">${root.title}</span>${catTag(root.category)}${todoDateTag(root.due_date, today, 'html')}
      </div>`;
    if (root.children.length) {
      h += `<div style="padding:6px 10px 8px;">`;
      for (const c of root.children) walkChild(c);
      h += `</div>`;
    }
    h += `</div>`;
  }
  if (trees.length === 0) h += `<p style="color:#389e0d;">🎉 今日无到期或逾期待办</p>`;
  if (base && reportToken) {
    h += `<div style="margin:12px 0;"><a href="${base}/tc/${reportToken}" target="_blank" rel="noopener" style="display:inline-block;padding:8px 14px;background:#4a6cf7;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;">➕ 协作添加 / 勾选</a></div>`;
  }
  if (base && reportToken) {
    h += `<p style="margin:8px 0;"><a href="${base}/tr/${reportToken}" style="color:#4a6cf7;">📋 查看全部待办</a></p>`;
  }
  h += `</div>`;
  return h;
}

export { buildFundReport, buildAssetReport, buildWeightReport, buildTodoReport, filterTodayOverdue };
