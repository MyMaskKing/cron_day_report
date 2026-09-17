-- 0006: 座右铭分设备展示频率与按设备独立的已读日期
-- motto_freq: JSON {"pc":..,"mobile":..,"app":..}, 取值 daily(每天一次,默认) | every(每次打开) | off(不展示)
--   pc=PC浏览器 mobile=手机浏览器(按视口<=640判定) app=原生壳(X-App-Shell, 服务端权威)
-- motto_seen: JSON {"pc":"YYYY-MM-DD",...}, 各设备独立记录最近已读日(按 app_settings.tz_offset 计日)
-- 旧列 motto_seen_date 不再读写, 保留供滚动部署期间的旧版本兼容
ALTER TABLE users ADD COLUMN motto_freq TEXT;
ALTER TABLE users ADD COLUMN motto_seen TEXT;
