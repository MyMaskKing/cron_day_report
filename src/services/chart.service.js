/**
 * 图表图片服务：生成 QuickChart.io 图片 URL
 *
 * Worker 服务端无法运行 Chart.js（无 DOM/canvas），故 HTML 报告里的曲线图
 * 用 QuickChart.io 公开服务：把 Chart.js 配置编码进 URL，返回一张 PNG。
 * 邮件/网页客户端可直接 <img> 显示。单点封装，失效或迁移时只改此处。
 */

const QUICKCHART_BASE = 'https://quickchart.io/chart';

/**
 * 生成图表图片 URL
 * @param {Object} chartConfig - Chart.js 配置对象 { type, data, options }
 * @param {Object} opts - { width, height, backgroundColor }
 * @returns {string} 图片 URL
 */
function buildChartUrl(chartConfig, opts = {}) {
  const width = opts.width || 500;
  const height = opts.height || 300;
  const bg = opts.backgroundColor || 'white';
  const c = encodeURIComponent(JSON.stringify(chartConfig));
  return `${QUICKCHART_BASE}?w=${width}&h=${height}&bkg=${bg}&c=${c}`;
}

/**
 * 折线图配置快捷构造
 * @param {Array<string>} labels
 * @param {Array} datasets - [{ label, data, color }]
 * @returns {Object} Chart.js 配置
 */
function lineChartConfig(labels, datasets) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.label,
        data: d.data,
        borderColor: d.color || '#667eea',
        fill: false
      }))
    },
    options: { plugins: { legend: { display: datasets.length > 1 } } }
  };
}

export { buildChartUrl, lineChartConfig };
