# Android App 开发手册（Todo Widget）

生活清单（品牌名「定时 Post」）的 Android 配套应用：**原生壳 + 单 WebView**（待办/基金/体重/资产四个 Tab 直接加载后端网页）+ **Glance App Widget**（桌面小组件，原生 Compose 渲染，不依赖 WebView）。

- 包名 / applicationId：`xyz.a10023456.todowidget`
- minSdk 26（Android 8.0），target/compile 35，JVM 17
- 技术栈：Kotlin、Jetpack Compose（Material3）、**Glance App Widget**、WorkManager、OkHttp、kotlinx.serialization、WebView + SwipeRefreshLayout
- 后端接口：同仓库 `src/`（Cloudflare Worker / Docker Node 双运行时），改 todo 公开接口时记得核对本端调用（见第 5 节）

> 后端/网页侧的架构见仓库根目录 `DEV_GUIDE.md`；本手册只覆盖 `android/`。

---

## 1. 构建环境与运行

- 用 **Android Studio** 打开 `android/` 目录（独立 Gradle 项目）。需要 **JDK 17–22**（Gradle 8.9 不支持 JDK 8，也不支持 JDK 23+；Android Studio 自带的 JBR 即可）。
- 命令行：`./gradlew :app:assembleDebug`（Windows 用 `gradlew.bat`）。
- 版本号：CI 通过环境变量 `VERSION_CODE` / `VERSION_NAME` 注入（见 `app/build.gradle.kts`）；本地未设环境变量时回退 `1` / `1.0.0`。
- release 签名：CI 通过 4 个环境变量注入——`RELEASE_KEYSTORE_PATH`、`RELEASE_STORE_PASSWORD`、`RELEASE_KEY_ALIAS`、`RELEASE_KEY_PASSWORD`；未配置时回退 debug 签名。本地生成签名 keystore：

  ```bash
  keytool -genkeypair -v -keystore release.keystore -alias todo -keyalg RSA -keysize 2048 -validity 36500
  ```

---

## 2. 模块地图（`app/src/main/java/xyz/a10023456/todowidget/`）

| 文件 | 职责 |
|------|------|
| `MainActivity.kt` | App 主体：原生壳 + 单 WebView + 底部 5 Tab（待办/基金/体重/资产/我的）。含 sid Cookie 同步、深链总线、`todoChanged` JS 桥、软键盘高度注入、下拉刷新冲突处理 |
| `MeScreen.kt` | 「我的」原生菜单：服务器地址修改、浏览器打开、主题、退出登录 |
| `AppConfig.kt` | **全局服务器地址**（SP `app_config`），含 `normalize()` 规范化 |
| `ApiClient.kt` | OkHttp 网络层：`fetchWidget`（小组件数据）、`markDone`（勾选）；10s 超时、手动跟随 3xx 重定向（防 PUT 被降级 GET） |
| `WidgetRepo.kt` | 小组件数据仓储：拉取、写缓存、失败记录；`friendlyErrorMsg()` 错误信息友好映射 |
| `Prefs.kt` | **全部持久化**：按 `appWidgetId` 存 token/scope/缓存/折叠/UI 设置，全局存 sid/主题/服务器地址（SP `todo_widget_prefs`） |
| `WidgetStateStore.kt` | 进程级 `StateFlow<WidgetFrame>`：组合内 `collectAsState` 订阅驱动重组；SP 是唯一持久层，`publish()` 每次从 SP 全量重读 |
| `WidgetUi.kt` | 小组件全部 Glance UI：`TodoAppWidget.provideGlance`、Header、GroupCard、ChildRow、卡片/颜色/尺寸 |
| `WidgetActions.kt` | Glance `ActionCallback`（刷新/勾选/折叠点击）：onAction 只写瞬时 loading，耗时操作交 Worker |
| `WidgetActionWorker.kt` | 动作执行 Worker：complete/refresh 网络流程、遮罩状态机（loading→done/error→idle） |
| `RefreshWorker.kt` | 三种刷新入口：周期 15 分钟 WorkManager、立即一次性任务、`refreshAllNow()` 进程内直连 |
| `ConfigActivity.kt` | 小组件配置面板（底部弹窗）：服务器连通测试、显示范围、不透明度、字号、子任务标题、显示模式 |
| `Actions.kt` | `TodoAppWidgetReceiver`：生命周期（onUpdate 注册周期刷新、onDeleted 清理 SP） |
| `Models.kt` | `@Serializable` 数据模型（`WidgetResponse/WidgetGroup/WidgetItem/...`） |
| `GlanceUtils.kt` | `GlanceId.resolveAppWidgetId()` 等 Glance 扩展工具 |

---

## 3. 服务器域名配置

**三级来源，改一处即可：**

1. **App 内（推荐给用户）**：「我的」→「🔗 服务器地址」→ 修改服务器地址。
   - 保存后会**清空 Cookie 并清除 sid**（`onChangeBaseUrl`），需在新服务器上重新登录。
2. **编译期默认值**：`AppConfig.kt` 的常量 `DEFAULT_BASE_URL = "https://cron.10023456.xyz"`。自托管改版时改这里。
3. 小组件读取顺序（`Prefs.getBaseUrl`）：组件单独地址（`baseurl_$widgetId`，当前无 UI 入口）→ 全局 `AppConfig` 地址。

**地址规则（`AppConfig.normalize`）：**

- 自动 trim、去尾部 `/`；
- 必须以 `http://` 或 `https://` 开头，否则回退默认地址；
- **不自动升级 http→https**：兼容局域网 Docker / 自托管纯 http 部署（`AndroidManifest.xml` 已开 `usesCleartextTraffic`）。

后端侧配套：Docker 首次部署后，超管登录网页到「系统设置」填 **PUBLIC_BASE_URL**（推送消息内免密链接的域名），三级回退为 DB 设置 → 环境变量 → 请求 origin。

---

## 4. 密钥 / Token 体系

App 涉及三类凭证，**普通用户只需登录，不用手动管 token**：

| 凭证 | 是什么 | 从哪来 / 在哪配 |
|------|--------|----------------|
| **sid**（会话 Cookie） | 登录态会话，小组件走 `GET /api/todo-widget`（含共享分类数据） | App WebView 登录后**自动**从 HttpOnly Cookie 提取写入 SP（`MainActivity.onPageFinished`）；登出/换服务器自动清除 |
| **report_token**（免密 Token） | 未登录 App 时小组件的备用凭证，走 `GET /api/public/todo-widget/:token`（仅个人任务） | 网页 **个人设置 → 免密 Token**：每个模块一个，打开页面时**自动生成**（后端 `generateToken()`，缺失即建并持久化）；复制「待办」模块的 token 填到小组件配置面板。重置后该模块全部旧免密链接（含小组件）立即失效 |
| **release keystore** | APK 签名密钥 | 见第 1 节 keytool 命令；CI 用 4 个 `RELEASE_*` 环境变量注入 |

补充：

- 小组件配置面板（⚙️）里「测试连接」可验证 sid/token 是否有效；已登录 App 时 token 留空即可。
- 后端首个超管由 `POST /api/auth/bootstrap` + 环境变量 **`ADMIN_BOOTSTRAP_TOKEN`** 创建（部署侧密钥，与 App 无关）。
- 邀请码（家庭共享）是网页侧 8 位短码（`genInviteCode`），不属于 App 凭证。

---

## 5. 小组件 ↔ 后端接口契约

| 端 | 接口 | 用途 |
|----|------|------|
| 登录态 | `GET /api/todo-widget?scope=&limit=` | App 已登录（sid Cookie）；含共享分类 |
| 免密 | `GET /api/public/todo-widget/:token?scope=&limit=` | report_token；仅个人任务 |
| 勾选 | `PUT /api/todo/:id/done` 或 `PUT /api/public/todo-all/:token/:id/done` | body `{"done":true}`；重复任务由后端自动滚动到下一次 |

- `scope ∈ cur(默认,今日+逾期) | today | overdue | all`；`limit` 默认 20，clamp [1,50]。
- 响应体：`{ success, owner_name, today, stats, groups[] }`；`groups[].children[]` 为任务行（无子任务的主任务以 `id == 分组 id` 的回退行下发）。改字段时同步改 `Models.kt`（`ignoreUnknownKeys = true`，后端加字段不会崩旧版）。

---

## 6. 小组件 UI 调整指南（尺寸 / 圆角 / 颜色）

全部在 **`WidgetUi.kt`**。卡片间距与圆角已抽成文件顶部常量：

```kotlin
private val CARD_GAP = 5.dp     // 卡片之间的垂直间距（分组卡片、简洁列表共用）
private val CARD_RADIUS = 12.dp // 卡片圆角半径
```

常用调整位置一览：

| 想调什么 | 改哪里 | 当前值 |
|------|------|------|
| 卡片间距 | 顶部常量 `CARD_GAP` | 5.dp |
| 卡片圆角 | 顶部常量 `CARD_RADIUS`（`CardScaffold` 引用） | 12.dp |
| 整个小组件外轮廓圆角 | `WidgetRoot` 与 `WidgetOverlay` 里的 `.cornerRadius(22.dp)`（**两处一起改**；仅 API31+ 生效，低版本直角降级） | 22.dp |
| 卡片内边距（文字到卡片边缘） | `CardScaffold` 的 `.padding(start=12, end=12, top=6, bottom=3)` | 左右 12 / 上 6 / 下 3 |
| 卡片到组件边缘距离 | `WidgetBody` 内容区 Column 的 `.padding(start=10, end=10, top=8)` | 左右 10 / 顶 8 |
| 任务行行距 | `ChildRow` 的 `.padding(start=6, top=3, bottom=3)` | 上下各 3 |
| 勾选圆与标题距离 | `ChildRow` 里 `Spacer(GlanceModifier.width(8.dp))` | 8.dp |
| 勾选圆大小 | `CheckCircle` 的 `.size(22.dp)` / 内圆 `.size(18.dp)` | 22 / 18 |
| 字号档位 | `fontFactor()`（0=小 0.88、1=中 1、2=大 1.15）；各 `fs(fontScale, N)` 的 N 是基准 sp | — |
| 卡片底色 | `cardBgColor(opacity, dark)`（浅色=纯白 `#FFFFFF` / 深色=`#38383A`，alpha 随不透明度） | — |
| 面板底色（卡片外灰底） | `panelBgColor(opacity, dark)`（浅=`#EDEDED` / 深=`#1C1C1E`）；灰底比卡片更透，alpha = `(不透明度/100) × PANEL_ALPHA_SCALE`（常量默认 0.6f，调小更透、调 1f 全实） | — |
| 标题栏底色 | `headerBgColor(opacity, dark)`（浅=`#F5F5F5` / 深=`#2C2C2E`） | — |
| 文字/图标色 | `W(dark).text / .sub / .overdue / .brand`（配色对象 `WLight` / `WDark`） | — |
| 勾选环内心色 | drawable **双套**：`bg_circle_surface`（浅 `#FFFFFF`）/ `bg_circle_surface_dark`（深 `#38383A`），`CheckCircle` 按 `dark` 选 resId；**必须与卡片底色一致**才呈空心环 | — |
| 统计 chip 底 | drawable **双套**：`bg_chip`（浅 `#E8E8E8`）/ `bg_chip_dark`（深 `#48484A`），`StatChip` 按 `dark` 选 | — |
| 品牌色（勾选圆/按钮/链接） | `W(dark).brand` 与配置面板 `brand = Color(0xFFA855F7)`（浅深同为紫） | 紫色 |

**主题机制（浅色/深色，不跟随系统）：**

- 小组件主题在**小组件设置面板**里手动切（「主题：浅色/深色」），存 SP 键 `wtheme_$widgetId`（`"light"` 默认 / `"dark"`），**不跟随手机系统深色模式**。
- 链路与其他 UI 偏好一致：`Prefs.getWidgetTheme/setWidgetTheme` → `WidgetFrame.widgetTheme` → `provideGlance` 里 `val dark = frame.widgetTheme == "dark"` → 逐层透传给各 Composable。
- 配色**不**再用 `DayNightColor(day,night)`（那是自动跟系统）；改为 `WLight/WDark` 两套固定色 + 单参 `ColorProvider(Color)`（不随 uiMode 变），`W(dark)` 按主题取；三个背景函数都收 `dark` 参数。
- drawable 形状色（勾选环内心、统计 chip 底）无法用代码色控制，做成 `xxx` / `xxx_dark` 两个 XML，代码按 `dark` 选 `R.drawable.xxx_dark`。
- 主题切换预览：写 SP + `publish` + 主线程 `updateAll`（drawable resId 变化需全量重绘兜底，同显示模式）。
- 注意区别：App 内 WebView 网页的浅色/暗色/护眼是另一套（账号 `users.theme`，全局 `app_theme`），与小组件主题互不相干。

**Glance 布局坑（改之前必读）：**

1. **卡片缝隙只能用卡片外的 `Spacer(height = CARD_GAP)`**。Glance 的 `padding` 翻译成 `View.setPadding`，背景会铺满 padding 区，给卡片加 margin 无效。
2. `LazyColumn` 的每个 `item` 尽量带**稳定 `itemId`**（用任务/分组的全局 id）。数据集结构变化（如显示模式切换、增删分组）时无 id item 在增量重组下可能不刷新。
3. 改 UI 设置类偏好（不透明度/字号/换行/显示模式/主题）要走完整链路：`Prefs` 存取 → `WidgetStateStore.WidgetFrame` 加字段 + `readFrame` 读取 → `provideGlance/WidgetRoot/WidgetBody` 透传 → `ConfigActivity` 面板开关（写 SP 后 `publish`，模式/主题/drawable 切换类变化再补一次主线程 `updateAll` 兜底）。
4. 颜色按手动主题走：文字/背景用 `W(dark)` 与 `xxxBgColor(opacity, dark)` 的固定 `ColorProvider(Color)`；drawable 形状色出 `_dark` 双套按 `dark` 选 resId。不要用回 `DayNightColor(day,night)`（会跟随系统，与手动主题冲突）。

---

## 7. 刷新与状态机制（改行为前必读）

- **重组驱动**：`WidgetStateStore` 是进程级 `StateFlow<WidgetFrame>`，组合内 `collectAsState` 订阅；任何写 SP 的路径之后调 `publish(context, widgetId)` 即驱动存活 session 重组。SP 是唯一持久层（进程死亡后重建从 SP 读初值）。历史背景：Glance `update()` 对存活 session 的会话事件真机证实不触发重组，不要回退到"写 SP + update"的旧模式。
- **刷新时机**：
  - 周期：`RefreshWorker` 每 15 分钟（WorkManager 周期下限，带「需联网」约束，App 关闭也跑）；
  - 立即：小组件 ↻ 按钮、配置保存、登录成功 → 一次性 Worker / `refreshAllNow()` 进程内直连；
  - App 内网页待办增删改：网页 JS 调 `AppShell.todoChanged()` 桥 → 原生防抖 800ms → `refreshAllNow()`；
  - session 重建（开机/进程重启）：`provideGlance → maybeAutoRefresh`，无缓存或缓存超 15 分钟静默拉一次。
- **遮罩状态机**：`idle | loading | done | error`，写 SP（6 秒过期兜底，防进程被杀后遮罩常驻）+ publish；动作 Worker 成功/失败停留 1.4s 后回 idle。
- **缓存与失败**：成功 `Prefs.setCache`（写数据 + 清 failed/failed_msg）；失败 `Prefs.setFailed(true, e.message)`，界面显示上次缓存 + `friendlyErrorMsg()` 映射的失败原因（登录失效/服务器异常/网络不通）。失败**不安排自动重试**，靠下一次周期/手动刷新恢复。

---

## 8. 常见坑清单

1. **JDK 版本**：构建需 JDK 17–22；JDK 8 报 "No Java compiler found"，JDK 23+ 报版本号错误。
2. **Glance `update()`/`updateAll()` 必须在主线程**（组合/翻译需要主线程推进）；网络与 SP 读写在 IO。
3. Worker 一律返回 `Result.success()`：未捕获异常会被 WorkManager 按 retry + 指数退避重排，导致遮罩终态迟迟不写（"刷新中"常驻）。
4. `LazyColumn → ListView` 的 item TextView 会被复用：`maxLines` 等属性切换模式时要显式给具体值（换行用 50，不能用 `Int.MAX_VALUE`——默认值 Glance 不发射 setMaxLines，复用残留旧值）。
5. WebView 侧：必须保持 edge-to-edge（不能用 `adjustResize`），键盘高度由原生 `WindowInsets.ime` 实测注入 CSS 变量 `--kb-native`；网页内返回已禁用（会造成 Tab 与画面错位）。
6. 新增小组件 SP 键：删除小组件时 `Prefs.clear()` 按 `endsWith("_$widgetId")` / `contains("_${widgetId}_")` 通配清理，新键命名遵守 `xxx_$widgetId` 形式即可自动覆盖。
