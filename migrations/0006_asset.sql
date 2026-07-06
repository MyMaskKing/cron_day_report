-- 迁移 0006: 资产报表模块
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0006_asset.sql
-- 所有金额单位为元

-- 钱包表
-- type: bank(银行卡) | alipay(支付宝) | wechat(微信) | investment(投资) | credit(信用支付, 负债) | cash(现金)
-- share_token: 免密录入链接 token
CREATE TABLE IF NOT EXISTS wallets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  share_token TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_share_token ON wallets(share_token);

-- 钱包月度记录表
-- month: YYYY-MM
-- balance: 普通钱包月末余额; 投资钱包用 principal(本金)+profit(收益), balance 存两者之和
CREATE TABLE IF NOT EXISTS wallet_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id  INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  month      TEXT NOT NULL,
  balance    REAL NOT NULL DEFAULT 0,
  principal  REAL NOT NULL DEFAULT 0,
  profit     REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_records_wallet ON wallet_records(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_records_month ON wallet_records(month);

-- 年度目标表（每个用户每年一条目标净资产）
CREATE TABLE IF NOT EXISTS asset_goals (
  user_id       INTEGER NOT NULL,
  year          TEXT NOT NULL,
  target_amount REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);
