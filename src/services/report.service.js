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
import { todoDateLabel, rootDueOf } from './todo.service.js';

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
  // 净值接口异常告警: 若有基金走了缓存/成本价兜底, 顶部醒目提示, 便于用户第一时间发现数据源问题
  const staleItems = items.filter(it => it.nav_stale);
  if (staleItems.length) {
    t += `⚠️ 净值接口异常: ${staleItems.length}/${items.length} 只基金未取到实时净值\n`;
    t += `　可能原因: 天天基金接口变更或临时故障; 请打开 /fund 页点"🔄 刷新净值"重试\n`;
    t += `${line}\n`;
  }
  t += `💰 总本金：${totals.cost}\n`;
  t += `📈 现　值：${totals.value}\n`;
  t += `📊 总收益：${fmtSign(totals.profit)}（${fmtSign(totals.rate)}%）\n`;
  if (profitDelta && profitDelta.delta != null) t += `📅 较昨日：${fmtSign(round2(profitDelta.delta))} 元\n`;
  else t += `📅 暂无昨日对比数据，次日 15:00 后可见\n`;
  t += `${line}\n`;
  items.forEach((it, i) => {
    const icon = it.profit >= 0 ? '🔴' : '🟢';
    const staleTag = it.nav_stale ? '  ⚠️净值兜底' : '';
    t += `\n${icon} ${i + 1}. ${it.name}（${it.code}）${staleTag}\n`;
    t += `　持仓：${it.shares} 份（成本价 ${it.cost_nav}）\n`;
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
  const staleItems = items.filter(it => it.nav_stale);
  if (staleItems.length) {
    m += `> ⚠️ **净值接口异常**: ${staleItems.length}/${items.length} 只基金未取到实时净值\n`;
    m += `> 可能原因: 天天基金接口变更或临时故障; 请打开 \`/fund\` 页点"🔄 刷新净值"重试\n\n`;
  }
  m += `💰 总本金：**${totals.cost}** · 现值：**${totals.value}**\n`;
  m += `📊 总收益：**${fmtSign(totals.profit)}（${fmtSign(totals.rate)}%）**\n`;
  if (profitDelta && profitDelta.delta != null) m += `📅 较昨日：**${fmtSign(round2(profitDelta.delta))} 元**\n`;
  else m += `📅 暂无昨日对比数据，次日 15:00 后可见\n`;
  items.forEach((it, i) => {
    const icon = it.profit >= 0 ? '🔴' : '🟢';
    const staleTag = it.nav_stale ? ' ⚠️净值兜底' : '';
    m += `\n${icon} **${i + 1}. ${it.name}（${it.code}）${staleTag}**\n`;
    m += `> 持仓 ${it.shares} 份（成本价 ${it.cost_nav}） · 现价 ${it.current_nav}（${fmtSign(it.gszzl)}%）\n`;
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
    <p>${fmtDateTime(Date.now(), tzOffset)}</p>`;
  const staleItems = items.filter(it => it.nav_stale);
  if (staleItems.length) {
    h += `<div style="background:#fff2f0;border:1px solid #ffccc7;border-radius:6px;padding:10px 12px;margin:8px 0;color:#a8071a;">
      ⚠️ <b>净值接口异常</b>: ${staleItems.length}/${items.length} 只基金未取到实时净值
      <div style="color:#a8071a;font-size:13px;margin-top:4px;">可能原因: 天天基金接口变更或临时故障; 请打开 <code>/fund</code> 页点"🔄 刷新净值"重试</div>
    </div>`;
  }
  h += `<p>💰 总本金: ${totals.cost} · 现值: ${totals.value}</p>
    <p style="color:${profitColor};font-weight:bold;">📊 总收益: ${fmtSign(totals.profit)} (${fmtSign(totals.rate)}%)</p>`;
  if (profitDelta && profitDelta.delta != null) {
    const deltaColor = profitDelta.delta >= 0 ? '#cf1322' : '#389e0d';
    h += `<p style="color:${deltaColor};">📅 较昨日: ${fmtSign(round2(profitDelta.delta))} 元</p>`;
  } else {
    h += `<p style="color:#999;font-size:13px;">📅 暂无昨日对比数据，次日 15:00 后可见</p>`;
  }
  items.forEach((it, i) => {
    const color = it.profit >= 0 ? '#cf1322' : '#389e0d';
    const staleTag = it.nav_stale ? ' <span style="color:#a8071a;font-size:12px;font-weight:normal;">⚠️净值兜底</span>' : '';
    const link = linkMap && linkMap[it.id]
      ? `<div style="margin-top:6px;"><a href="${linkMap[it.id]}" style="color:#4a6cf7;">➕ 快速加仓</a></div>` : '';
    h += `<div style="background:#f8f9fa;margin:8px 0;padding:12px;border-radius:6px;border-left:4px solid ${color};">
      <div><b>${i + 1}. ${it.name} (${it.code})</b>${staleTag}</div>
      <div style="color:#6c757d;font-size:14px;">持仓 ${it.shares} 份（成本价 ${it.cost_nav}） · 现价 ${it.current_nav} (${fmtSign(it.gszzl)}%)</div>
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
 * 待办日报的顶层筛选：仅保留"显示日期=今天 或 已逾期"的顶层任务
 * 主任务显示日期走 rootDueOf：旧模式即顶层 due_date；child_due 新模式为子树未完成任务最早有效日期
 * @param {Array} trees - flattenPending 后的未完成任务树
 * @param {string} today - 北京时区当天 YYYY-MM-DD
 * @returns {Array} 过滤并按显示日期倒序（晚→早）的顶层树
 */
function filterTodayOverdue(trees, today) {
  const kept = trees.filter(t => {
    const d = rootDueOf(t);
    return d && today && d <= today;
  });
  // 显示日期倒序：日期晚的在前；同日期按 id 稳定
  kept.sort((a, b) => {
    const ad = rootDueOf(a), bd = rootDueOf(b);
    if (ad !== bd) return ad < bd ? 1 : -1;
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
 * 日报正文剪枝：仅保留"有效截止日期 <= today"的未完成叶子所在枝
 * 旧模式下进入日报的树叶子日期全部继承主任务(<=today)，剪枝后无变化；
 * 新模式(child_due)下主任务是长期容器，混有未来日期子任务与无日期备忘录，
 * 日报只报今天到期/逾期的叶子——未来任务与备忘录不进正文、不计入"N 件待办"
 * @param {Array} trees - filterTodayOverdue 筛选后的顶层树
 * @param {string} today - YYYY-MM-DD
 * @returns {Array} 新树（不改原树）
 */
function pruneDueLeaves(trees, today) {
  const prune = (node, inheritedDue) => {
    if (node.done) return null;
    const own = node.due_date || inheritedDue;
    const kids = node.children.map(c => prune(c, own)).filter(Boolean);
    if (kids.length > 0) return { ...node, children: kids };
    // 叶子（含无子女顶层）：有有效日期且今天到期/逾期才保留
    return (own && today && own <= today) ? { ...node, children: [] } : null;
  };
  return trees.map(n => prune(n, null)).filter(Boolean);
}

/**
 * 收集某顶层分组下用于日报的「可执行叶子」条目（以子任务为单位，与小组件 buildWidgetGroups 同口径）：
 * 递归收集末端叶子任务，中间层父任务不单列成行，其标题经 path 面包屑体现层级；
 * 若该主任务没有任何子任务（自身即可执行项），回退为主任务自身一条（selfRoot=true，降级显示）。
 * 输入应为 pruneDueLeaves 剪枝后的树（保留的叶子均为今天到期/逾期）。
 * @param {Object} root - 剪枝后的顶层树节点
 * @returns {Array<{id:number,title:string,category:string,priority:number,path:string[],due:string|null,selfRoot:boolean}>}
 */
function collectReportLeaves(root) {
  const items = [];
  const walk = (n, ancestors, isRoot, inheritedDue) => {
    const ownDue = n.due_date || inheritedDue;
    if (!isRoot && n.children.length === 0) {
      items.push({
        id: n.id, title: n.title, category: n.category, priority: n.priority,
        path: ancestors.slice(), due: ownDue, selfRoot: false
      });
    }
    for (const c of n.children) {
      walk(c, isRoot ? [] : [...ancestors, n.title], false, n.due_date || inheritedDue);
    }
  };
  walk(root, [], true, null);
  if (items.length === 0) {
    // 主任务自身无子任务 → 降级为一条叶子（path 为空），由主任务标题行/卡片头承载
    items.push({
      id: root.id, title: root.title, category: root.category, priority: root.priority,
      path: [], due: rootDueOf(root) || root.due_date || null, selfRoot: true
    });
  }
  return items;
}

/** 日期加减 delta 天，返回 YYYY-MM-DD（UTC 口径，与 todoDateLabel 的日差计算一致） */
function addDaysCN(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + delta * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 裁剪出"指定日期当天到期"的未完成叶子子树（有效日期口径同 pruneDueLeaves：自身优先，否则继承最近有日期的祖先） */
function pruneLeavesOnDate(trees, date) {
  const prune = (node, inheritedDue) => {
    if (node.done) return null;
    const own = node.due_date || inheritedDue;
    const kids = node.children.map(c => prune(c, own)).filter(Boolean);
    if (kids.length > 0) return { ...node, children: kids };
    return own === date ? { ...node, children: [] } : null;
  };
  return trees.map(n => prune(n, null)).filter(Boolean);
}

/**
 * 明日预告：仅当天最后两次定时推送（seq >= total-1；手动推送 seq=null 不显示）时构造。
 * @param {Array} trees - flattenPending 后的未完成任务树
 * @param {string} today - 北京时区当天 YYYY-MM-DD
 * @param {number|null} seq - 当天第几次推送
 * @param {number|null} total - 当天共几次推送
 * @returns {{date:string,count:number,trees:Array}|null} 明日无未完成到期叶子时返回 null
 */
function todoTomorrowPreview(trees, today, seq, total) {
  if (seq == null || !(total >= 1) || seq < total - 1) return null;
  if (!today || today.length < 10) return null;
  const date = addDaysCN(today, 1);
  const tTrees = pruneLeavesOnDate(trees, date);
  if (tTrees.length === 0) return null;
  // 件数口径同今日分组：collectReportLeaves（含无子任务主任务的 selfRoot 降级 1 件）
  const count = tTrees.reduce((n, root) => n + collectReportLeaves(root).length, 0);
  return count > 0 ? { date, count, trees: tTrees } : null;
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
  // 正文与统计只含今天到期/逾期的叶子：新模式容器主任务下的未来子任务/备忘录不进日报
  // （旧模式叶子日期全继承主任务且 <=today，剪枝结果与 sorted 相同，版式不变）
  const visible = pruneDueLeaves(sorted, today);
  // 日报口径统计：基于筛选后的树，统计未完成任务数与其中逾期数（含子任务）
  const stats = statsOfReport(visible, today);
  // 分档提醒语：按当天第几次/共几次推送，温和→强烈；今日已清空(0 件)时不套提醒语
  const remind = stats.pending > 0 ? todoRemindText(stats.pending, seq, total) : '';
  // 明日预告：仅当天最后两次定时推送出现（text/markdown 仅一行计数，html 完整区块）；手动推送 seq=null 不显示
  const tomorrow = todoTomorrowPreview(trees, today, seq, total);
  if (format === 'html') return buildTodoReportHTML(visible, base, token, reportToken, today, stats, remind, tomorrow);
  if (format === 'markdown') return buildTodoReportMarkdown(visible, base, token, reportToken, today, stats, remind, tomorrow);
  return buildTodoReportText(visible, base, token, reportToken, today, stats, remind, tomorrow);
}

/** 统计筛选后树里的未完成任务数与逾期数
 * 叶子口径：有子任务的父任务不计入，只统计末端叶子（与列表页 countStats 一致）；
 * 叶子有效日期自身优先、否则继承最近有日期的祖先（旧模式即顶层主任务日期） */
function statsOfReport(trees, today) {
  let pending = 0, overdue = 0;
  const walk = (node, inheritedDue) => {
    // 完成节点代表该分支已结束，后代即使保留未完成状态也不再统计
    if (node.done) return;
    const own = node.due_date || inheritedDue;
    if (node.children.length > 0) {
      // 有子任务：父不计入，仅递归统计子任务
      for (const c of node.children) walk(c, own);
      return;
    }
    // 叶子任务：未完成才计入
    pending++;
    if (own && today && own < today) overdue++;
  };
  for (const root of trees) walk(root, root.due_date || null);
  return { pending, overdue };
}

/** 日报里任务的日期标签：逾期红色标注，否则普通显示；dueDate 为继承后的有效日期
 * 显示走 todoDateLabel: 今天/明天/昨天/本周 X, 范围外 MM/DD; 网页 UI 与日报文案保持一致
 * 日报只含今天到期或逾期(filterTodayOverdue)，非逾期即当天到期，用醒目徽章突出 */
function todoDateTag(dueDate, today, kind) {
  if (!dueDate) return '';
  const over = today && dueDate < today;
  const disp = todoDateLabel(dueDate, today);
  if (kind === 'html') {
    const pill = 'display:inline-block;border-radius:11px;padding:1px 10px;font-size:12px;font-weight:600;line-height:1.7;margin-left:2px;';
    return over
      ? ` <span style="${pill}background:#fff1f0;color:#cf1322;">⚠️ 逾期 ${disp}</span>`
      : ` <span style="${pill}background:#e6f4ff;color:#0958d9;">📌 ${disp}</span>`;
  }
  if (kind === 'markdown') {
    return over ? ` **⚠️ 逾期 ${disp}**` : ` **📌 ${disp}**`;
  }
  return over ? ` ⚠️逾期 ${disp}` : ` 📌${disp}`;
}

function buildTodoReportText(trees, base, token, reportToken, today, stats, remind = '', tomorrow = null) {
  // 参考微信 TODO 格式: 标题带日期后缀 + 计数句 + 🔸 分隔线包每条任务 + 叶子以 ├─/└─ 树状串接
  // 顶层任务前缀 ❇️待办N: <pri><title>(MM/DD or ⚠️逾期MM/DD)
  const bar = '🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸';
  const dateBadge = (dueDate) => {
    if (!dueDate) return '';
    const disp = todoDateLabel(dueDate, today);
    const over = today && dueDate < today;
    return over ? `(⚠️逾期${disp})` : `(${disp})`;
  };
  const titleDate = today && today.length >= 10 ? `[今天:${Number(today.slice(5,7))}月${Number(today.slice(8,10))}]` : '';
  let t = `📌 待办日报${titleDate}\n\n`;
  // 定时推送(有 remind)时, remind 已含"还有 N 个待办"的时段化提示, 跳过固定统计句避免重复;
  // 手动推送/预览无 remind, 保留原统计句
  if (stats && !remind) {
    if (stats.pending > 0) t += `🥳您今天有 ${stats.pending} 件待办${stats.overdue ? `，其中 ${stats.overdue} 件逾期` : ''}。↙️\n`;
    else t += `🎉您今天暂无到期待办。\n`;
  }
  if (remind) t += `${remind}\n`;
  t += `\n`;

  if (trees.length === 0) {
    t += `${bar}\n🎉 今日无到期或逾期待办\n${bar}\n`;
  } else {
    t += `${bar}\n`;
    // 以子任务(可执行叶子)为单位: 主任务作分组头, 组内平铺末端叶子; 中间层父任务不单列,
    // 经「中间层 / …：」面包屑体现层级。主任务无子任务时(selfRoot)下方无 ├─ 子项,
    // 主任务标题行本身即那条待办(降级显示), 与小组件 collapsible=false 同口径。
    trees.forEach((root, ri) => {
      const cat = root.category ? `〔${root.category}〕` : '';
      const rootDue = rootDueOf(root);
      const leaves = collectReportLeaves(root);
      // 组内可执行叶子数(无子任务的降级主任务自身计 1 件), 与顶部"N 件待办"逐组对账
      // text 版不加优先级圆圈: 微信/短信客户端里各家 emoji 尺寸不一, 反而挤占标题空间
      t += `❇️待办${ri + 1}：${root.shared_cat_id != null ? '👥' : ''}${root.title}${cat}(${leaves.length}件)${dateBadge(rootDue)}\n`;
      // 叶子扁平成树: ├─ 串接、组内末项 └─; 不画跨层 │(中间层父任务不成行, 竖线会悬空),
      // 层级深度经面包屑(path)体现。每行前缀等长, 微信窄屏省空间, 也无竖线对齐问题
      leaves.forEach((it, li) => {
        if (it.selfRoot) return; // 降级项已由上面的主任务行承载
        const branch = li === leaves.length - 1 ? '└─ ' : '├─ ';
        const crumb = it.path.length ? it.path.join(' / ') + '：' : '';
        const icat = it.category ? `〔${it.category}〕` : '';
        const badge = (it.due && it.due !== rootDue) ? dateBadge(it.due) : '';
        t += `${branch}${crumb}${it.title}${icat}${badge}\n`;
      });
      t += `${bar}\n`;
    });
  }
  // 明日预告（仅最后两次定时推送有值）：一行计数，不列明细
  if (tomorrow) t += `⏭️ 明日需要做 ${tomorrow.count} 件待办\n`;
  if (base && reportToken) t += `\n➕ 协作添加/勾选：${base}/tc/${reportToken}\n`;
  if (base && reportToken) t += `📋 查看全部待办：${base}/tr/${reportToken}\n`;
  return t;
}

function buildTodoReportMarkdown(trees, base, token, reportToken, today, stats, remind = '', tomorrow = null) {
  // markdown 版沿用参考格式的分组结构, 但换用 markdown 语法(粗体/嵌套列表), 兼容飞书/钉钉/邮件
  const bar = '🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸';
  const dateBadge = (dueDate) => {
    if (!dueDate) return '';
    const disp = todoDateLabel(dueDate, today);
    const over = today && dueDate < today;
    return over ? `（**⚠️逾期${disp}**）` : `（${disp}）`;
  };
  const titleDate = today && today.length >= 10 ? `[今天:${Number(today.slice(5,7))}月${Number(today.slice(8,10))}]` : '';
  let m = `## 📌 待办日报${titleDate}\n\n`;
  // 定时推送(有 remind)时, remind 已含"还有 N 个待办"的时段化提示, 跳过固定统计句避免重复;
  // 手动推送/预览无 remind, 保留原统计句
  if (stats && !remind) {
    if (stats.pending > 0) m += `🥳您今天有 **${stats.pending}** 件待办${stats.overdue ? `，其中 **${stats.overdue}** 件逾期` : ''}。↙️\n\n`;
    else m += `🎉 您今天暂无到期待办。\n\n`;
  }
  if (remind) m += `${remind}\n\n`;

  if (trees.length === 0) {
    m += `${bar}\n🎉 今日无到期或逾期待办\n${bar}\n`;
  } else {
    m += `${bar}\n`;
    // 以子任务(叶子)为单位: 主任务分组头 + 平铺末端叶子列表(中间层不单列, 经面包屑体现层级);
    // 无子任务的主任务(selfRoot)下方无叶子列表, 加粗标题行本身即那条待办(降级显示)。
    trees.forEach((root, ri) => {
      const cat = root.category ? ` \`${root.category}\`` : '';
      const pri = TODO_PRI_ICON[root.priority] || '⚪';
      const rootDue = rootDueOf(root);
      const leaves = collectReportLeaves(root);
      m += `**❇️待办${ri + 1}：${pri}${root.shared_cat_id != null ? '👥' : ''}${root.title}**${cat}（${leaves.length} 件）${dateBadge(rootDue)}\n`;
      leaves.forEach((it) => {
        if (it.selfRoot) return;
        const crumb = it.path.length ? it.path.join(' / ') + '：' : '';
        const icat = it.category ? ` \`${it.category}\`` : '';
        const ipri = TODO_PRI_ICON[it.priority] || '⚪';
        const badge = (it.due && it.due !== rootDue) ? dateBadge(it.due) : '';
        m += `- ▸ ${ipri}${crumb}${it.title}${icat}${badge}\n`;
      });
      m += `${bar}\n`;
    });
  }
  // 明日预告（仅最后两次定时推送有值）：一行加粗计数，不列明细
  if (tomorrow) m += `**⏭️ 明日需要做 ${tomorrow.count} 件待办**\n`;
  if (base && reportToken) m += `\n[➕ 协作添加/勾选](${base}/tc/${reportToken})\n`;
  if (base && reportToken) m += `[📋 查看全部待办](${base}/tr/${reportToken})\n`;
  return m;
}

function buildTodoReportHTML(trees, base, token, reportToken, today, stats, remind = '', tomorrow = null) {
  // 整体字号相对之前放大: 正文 15→16, 主任务 15→18, 子任务 13→15, 更适合手机阅读
  // 层级视觉: 主任务卡片头(左 4px 品牌蓝竖条) + 子任务卡片体内以 ▸ 箭头 + 左细竖线 + 深度缩进逐级下钻
  let h = `<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;font-size:16px;line-height:1.6;color:#1f2430;">
    <h2 style="font-size:22px;margin:8px 0 12px;">📝 待办日报${todoTitleDate(today)}</h2>`;
  if (stats) {
    h += `<p style="margin:6px 0;color:#4a6cf7;font-weight:600;font-size:16px;">未完成 ${stats.pending} 项`;
    if (stats.overdue) h += ` · <span style="color:#cf1322;">逾期 ${stats.overdue} 项</span>`;
    h += `</p>`;
  }
  if (remind) h += `<p style="margin:8px 0;padding:10px 14px;background:#fff7e6;border-left:3px solid #fa8c16;border-radius:4px;color:#874d00;font-size:15px;">${remind}</p>`;
  // 优先级圆点色板(红=高 琥珀=中 灰=低)与网页端 .todo-dot 一致
  const PRI_DOT = { 2: '#e5484d', 1: '#e8a317', 0: '#b4bccb' };
  // 内联圆点: 邮件客户端 emoji 渲染不一, 用 background 画点更统一可控
  const dot = (p) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${PRI_DOT[p] || '#b4bccb'};margin-right:8px;vertical-align:middle;"></span>`;
  const catTag = (c) => c
    ? ` <span style="background:#eef1ff;color:#4a6cf7;border-radius:4px;padding:1px 8px;font-size:13px;">${c}</span>` : '';
  // 以子任务(可执行叶子)为单位: 主任务卡片头作分组, 卡内平铺末端叶子; 中间层父任务不单列,
  // 经浅色面包屑(path)体现层级, 左内边距按面包屑深度递增。主任务无子任务时(selfRoot)无叶子行,
  // 卡片头单独承载那一条待办(降级显示, 不出"N 项子任务"徽章), 与小组件 collapsible=false 同口径。
  for (const root of trees) {
    const rootDue = rootDueOf(root);
    const leaves = collectReportLeaves(root).filter((it) => !it.selfRoot);
    const subBadge = leaves.length > 0
      ? ` <span style="display:inline-block;margin-left:6px;padding:1px 8px;background:#eef1ff;color:#4a6cf7;border-radius:10px;font-size:12px;font-weight:500;">${leaves.length} 项子任务</span>`
      : '';
    // 主任务卡片: 品牌蓝分组条头(层级通道) + 优先级圆点 + 加粗标题 + 主任务显示日期 + 子任务数提示
    h += `<div style="margin:16px 0;border:1px solid #eceff5;border-radius:8px;overflow:hidden;">
      <div style="padding:11px 14px;background:#f7f8fa;border-left:4px solid #4a6cf7;">
        ${dot(root.priority)}<span style="font-size:18px;font-weight:700;color:#1f2430;vertical-align:middle;">${root.shared_cat_id != null ? '👥 ' : ''}${root.title}</span>${catTag(root.category)}${todoDateTag(rootDue, today, 'html')}${subBadge}
      </div>`;
    if (leaves.length) {
      h += `<div style="padding:8px 12px 10px;">`;
      leaves.forEach((it) => {
        const pad = 12 + it.path.length * 18;
        const dateTag = (it.due && it.due !== rootDue) ? todoDateTag(it.due, today, 'html') : '';
        const crumb = it.path.length
          ? `<span style="color:#8a94b0;font-size:13px;margin-right:6px;">${it.path.join(' / ')}</span>` : '';
        h += `<div style="margin:4px 0;padding:6px 10px 6px ${pad}px;border-left:2px solid #e3e8f0;background:#fbfcfe;">
          <span style="color:#8a94b0;margin-right:6px;">▸</span>${dot(it.priority)}${crumb}<span style="font-size:15px;color:#333;vertical-align:middle;">${it.title}</span>${catTag(it.category)}${dateTag}
        </div>`;
      });
      h += `</div>`;
    }
    h += `</div>`;
  }
  if (trees.length === 0) h += `<p style="color:#389e0d;font-size:16px;">🎉 今日无到期或逾期待办</p>`;
  // 明日到期预告区块（仅最后两次定时推送有值）
  if (tomorrow) h += todoTomorrowSectionHtml(tomorrow, today);
  if (base && reportToken) {
    h += `<div style="margin:14px 0;"><a href="${base}/tc/${reportToken}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 18px;background:#4a6cf7;color:#fff;border-radius:6px;text-decoration:none;font-size:15px;">➕ 协作添加 / 勾选</a></div>`;
  }
  if (base && reportToken) {
    h += `<p style="margin:8px 0;font-size:15px;"><a href="${base}/tr/${reportToken}" style="color:#4a6cf7;">📋 查看全部待办</a></p>`;
  }
  h += `</div>`;
  return h;
}

/**
 * 待办日报 HTML「明日到期」预告区块（仅最后两次定时推送出现）：
 * 复刻今日卡片结构，换青色系表达"预告、不紧急"；明日件数不计入顶部统计。
 * @param {{date:string,count:number,trees:Array}} tomorrow - todoTomorrowPreview 结果
 * @param {string} today - 北京时区当天 YYYY-MM-DD
 */
function todoTomorrowSectionHtml(tomorrow, today) {
  // 优先级圆点色板与今日卡片一致（红=高 琥珀=中 灰=低）
  const PRI_DOT = { 2: '#e5484d', 1: '#e8a317', 0: '#b4bccb' };
  const dot = (p) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${PRI_DOT[p] || '#b4bccb'};margin-right:8px;vertical-align:middle;"></span>`;
  const catTag = (c) => c
    ? ` <span style="background:#e6fffb;color:#08979c;border-radius:4px;padding:1px 8px;font-size:13px;">${c}</span>` : '';
  const pill = 'display:inline-block;border-radius:11px;padding:1px 10px;font-size:12px;font-weight:600;line-height:1.7;margin-left:2px;';
  const dayTag = (due) => ` <span style="${pill}background:#e6fffb;color:#08979c;">🗓️ ${todoDateLabel(due, today)}</span>`;
  const md = tomorrow.date.length >= 10 ? `${tomorrow.date.slice(5, 7)}/${tomorrow.date.slice(8, 10)}` : '';
  let h = `<div style="margin:24px 0 0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
      <span style="font-size:18px;font-weight:700;color:#08979c;">⏭️ 明日到期</span>
      <span style="display:inline-block;padding:1px 10px;border-radius:11px;background:#e6fffb;color:#08979c;font-size:12px;font-weight:600;">${md} · ${tomorrow.count} 项</span>
    </div>
    <p style="margin:2px 0 8px;font-size:13px;color:#8a94b0;">提前看一眼，做好安排 · 不计入今日未完成</p>`;
  for (const root of tomorrow.trees) {
    const rootDue = rootDueOf(root);
    const leaves = collectReportLeaves(root).filter((it) => !it.selfRoot);
    const subBadge = leaves.length > 0
      ? ` <span style="display:inline-block;margin-left:6px;padding:1px 8px;background:#e6fffb;color:#08979c;border-radius:10px;font-size:12px;font-weight:500;">${leaves.length} 项子任务</span>`
      : '';
    // 区块固定标"明天"：组内叶子均为明日到期（rootDue 可能因主任务自带日期而为今天，故不取 rootDue）
    h += `<div style="margin:8px 0;border:1px solid #d9f3f0;border-radius:8px;overflow:hidden;">
      <div style="padding:11px 14px;background:#f0fdfa;border-left:4px solid #13c2c2;">
        ${dot(root.priority)}<span style="font-size:18px;font-weight:700;color:#334b4d;vertical-align:middle;">${root.shared_cat_id != null ? '👥 ' : ''}${root.title}</span>${catTag(root.category)}${subBadge}${dayTag(tomorrow.date)}
      </div>`;
    if (leaves.length) {
      h += `<div style="padding:8px 12px 10px;">`;
      leaves.forEach((it) => {
        const pad = 12 + it.path.length * 18;
        // 子任务日期与主任务相同则不重复标注（与今日卡片同规则）
        const dateTag = (it.due && it.due !== rootDue) ? dayTag(it.due) : '';
        const crumb = it.path.length
          ? `<span style="color:#8a94b0;font-size:13px;margin-right:6px;">${it.path.join(' / ')}</span>` : '';
        h += `<div style="margin:4px 0;padding:6px 10px 6px ${pad}px;border-left:2px solid #b5f5ec;background:#fcfeff;">
          <span style="color:#87d4cf;margin-right:6px;">▸</span>${dot(it.priority)}${crumb}<span style="font-size:15px;color:#556;vertical-align:middle;">${it.title}</span>${catTag(it.category)}${dateTag}
        </div>`;
      });
      h += `</div>`;
    }
    h += `</div>`;
  }
  return h;
}

export { buildFundReport, buildAssetReport, buildWeightReport, buildTodoReport, filterTodayOverdue, todoTomorrowPreview };
