/**
 * 监控服务：访问 URL 并返回结果（迁移自原 index.js）
 * 与原实现保持一致的判定逻辑（含 206、完整性校验、超时控制）
 */

/**
 * 访问单个 URL 并返回结果
 * @param {string} url
 * @param {string} name - 任务名称
 * @param {Object} timeoutConfig - { timeout, responseTimeout }
 * @returns {Promise<Object>} 访问结果
 */
async function accessUrl(url, name, timeoutConfig) {
  const startTime = Date.now();
  const { timeout, responseTimeout } = timeoutConfig;
  let requestTimeoutId, responseTimeoutId;

  try {
    const requestController = new AbortController();
    requestTimeoutId = setTimeout(() => requestController.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: requestController.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    clearTimeout(requestTimeoutId);

    const responseController = new AbortController();
    responseTimeoutId = setTimeout(() => responseController.abort(), responseTimeout);

    let responseBody = '';
    let isComplete = false;

    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        responseBody += decoder.decode(value, { stream: true });
        if (Date.now() - startTime > responseTimeout) {
          responseController.abort();
          throw new Error(`响应体加载超时 (${responseTimeout}ms)`);
        }
      }
      isComplete = true;
    } catch (readError) {
      isComplete = false;
      if (readError.name === 'AbortError') {
        console.warn(`响应体加载超时: ${readError.message}`);
      } else {
        console.warn(`读取响应体失败: ${readError.message}`);
      }
    } finally {
      clearTimeout(responseTimeoutId);
    }

    const responseTime = Date.now() - startTime;
    const isTrulySuccessful = response.ok && isComplete && response.status !== 206;

    let finalStatus = response.status;
    let finalStatusText = response.statusText;
    let finalSuccess = isTrulySuccessful;

    if (response.status === 206) {
      if (isComplete) {
        finalStatusText = 'Partial Content (已完整加载)';
        finalSuccess = true;
      } else {
        finalStatusText = 'Partial Content (未完整加载)';
        finalSuccess = false;
      }
    }

    return {
      name, url, status: finalStatus, statusText: finalStatusText,
      responseTime, success: finalSuccess, isComplete,
      responseSize: responseBody.length, timestamp: new Date().toISOString()
    };
  } catch (error) {
    clearTimeout(requestTimeoutId);
    clearTimeout(responseTimeoutId);
    const responseTime = Date.now() - startTime;

    let errorMessage = error.message;
    if (error.name === 'AbortError') {
      errorMessage = error.message.includes('响应体加载超时')
        ? `响应体加载超时 (${responseTimeout}ms)`
        : `请求超时 (${timeout}ms)`;
    }

    return {
      name, url, status: 'ERROR', statusText: errorMessage,
      responseTime, success: false, isComplete: false,
      responseSize: 0, timestamp: new Date().toISOString()
    };
  }
}

/**
 * 批量访问任务（并发+批次延迟）
 * @param {Array} tasks - [{ name, url }, ...]
 * @param {Object} timeoutConfig - { concurrencyLimit, batchDelay, timeout, responseTimeout }
 * @returns {Promise<Array>} 结果数组（含原任务字段）
 */
async function batchAccessUrls(tasks, timeoutConfig) {
  const results = [];
  const { concurrencyLimit, batchDelay } = timeoutConfig;

  for (let i = 0; i < tasks.length; i += concurrencyLimit) {
    const batch = tasks.slice(i, i + concurrencyLimit);
    const batchPromises = batch.map(async (t) => {
      const r = await accessUrl(t.url, t.name, timeoutConfig);
      return { ...r, task_id: t.id, user_id: t.user_id, channel_id: t.channel_id, return_type: t.return_type };
    });
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (i + concurrencyLimit < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  return results;
}

/**
 * 格式化结果为文本（迁移自原 formatResultsAsText）
 * @param {Array} results
 * @returns {string}
 */
function formatResultsAsText(results) {
  let text = `🌅 定时任务执行报告 (${new Date().toLocaleString('zh-CN')})\n\n`;
  const total = results.length;
  const success = results.filter(r => r.success).length;
  const failed = total - success;
  text += `📊 执行统计：总计 ${total} 个，成功 ${success} 个，失败 ${failed} 个\n\n`;

  results.forEach((result, index) => {
    const statusIcon = result.success ? '✅' : '❌';
    const completionStatus = result.isComplete ? '完整' : '不完整';
    text += `${index + 1}. ${statusIcon} ${result.name}\n`;
    text += `   URL: ${result.url}\n`;
    text += `   状态: ${result.status} ${result.statusText}\n`;
    text += `   响应时间: ${result.responseTime}ms\n`;
    text += `   响应完整性: ${completionStatus}\n`;
    if (result.responseSize > 0) text += `   响应大小: ${result.responseSize} 字符\n`;
    text += `   时间: ${result.timestamp}\n\n`;
  });
  return text;
}

/**
 * 格式化结果为 HTML（迁移自原 formatResultsAsHTML）
 * @param {Array} results
 * @returns {string}
 */
function formatResultsAsHTML(results) {
  const total = results.length;
  const success = results.filter(r => r.success).length;
  const failed = total - success;

  let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;">
    <h2>🌅 定时任务执行报告</h2>
    <p>${new Date().toLocaleString('zh-CN')}</p>
    <p>📊 总计 ${total} 个，成功 ${success} 个，失败 ${failed} 个</p>`;

  results.forEach((result, index) => {
    const statusIcon = result.success ? '✅' : '❌';
    const color = result.success ? '#28a745' : '#dc3545';
    html += `<div style="background:#f8f9fa;margin:10px 0;padding:12px;border-radius:6px;border-left:4px solid ${color};">
      <div><b>${index + 1}. ${statusIcon} ${result.name}</b></div>
      <div style="color:#6c757d;font-size:14px;">URL: ${result.url}</div>
      <div style="color:${color};">状态: ${result.status} ${result.statusText}</div>
      <div style="color:#6c757d;font-size:12px;">响应时间: ${result.responseTime}ms · 完整性: ${result.isComplete ? '完整' : '不完整'}</div>
    </div>`;
  });
  html += '</div>';
  return html;
}

/**
 * 按返回格式格式化
 * @param {Array} results
 * @param {string} returnType - 'text' | 'html'
 * @returns {string}
 */
function formatResults(results, returnType) {
  if (!results || results.length === 0) return '⚠️ 没有可执行的监控任务';
  return returnType === 'html' ? formatResultsAsHTML(results) : formatResultsAsText(results);
}

export { accessUrl, batchAccessUrls, formatResults, formatResultsAsText, formatResultsAsHTML };
