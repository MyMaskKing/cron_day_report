-- 基金持仓 / 资产钱包封存：封存后不进入统计与推送，明细仍可添加和展示
-- archived: 0=正常（默认），1=已封存
ALTER TABLE funds ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wallets ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
