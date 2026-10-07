/**
 * Markdown 附件对账纯函数（平台无关，不碰存储）
 *
 * 编辑器插入的图片/附件形如 ![](../todo-file/<token>)、[名称](../todo-file/<token>)，
 * 用户也可能改成绝对 URL；token 为 base64url（auth/password.js#generateToken）。
 */

const FILE_TOKEN_RE = /todo-file\/([A-Za-z0-9_-]+)/g;

/** 提取正文内全部 /todo-file/<token>，返回 Set */
function extractFileTokens(content) {
  const out = new Set();
  if (typeof content !== 'string' || !content) return out;
  FILE_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = FILE_TOKEN_RE.exec(content)) !== null) out.add(m[1]);
  return out;
}

/**
 * 选出可清理的文件行：token 不在当前正文、也不在任何其他受管正文里。
 * @param {Array} rows files 行（含 file_token）
 * @param {string} content 本次保存的正文
 * @param {Array<string>} otherContents 其余受管正文（全员投资策略 + 公告 + 下载页）
 */
function selectPrunableFiles(rows, content, otherContents) {
  const current = extractFileTokens(content);
  let referenced = null;
  return (rows || []).filter(r => {
    if (current.has(r.file_token)) return false;
    // 惰性构建一次全局引用集合
    if (referenced === null) {
      referenced = new Set();
      (otherContents || []).forEach(t => extractFileTokens(t).forEach(x => referenced.add(x)));
    }
    return !referenced.has(r.file_token);
  });
}

export { extractFileTokens, selectPrunableFiles };
