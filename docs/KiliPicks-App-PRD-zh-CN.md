# KiliPicks 原生 App PRD（Android First）

版本：0.1  
状态：研发评审稿  
目标平台：Android 首发，iOS 同构兼容  
对应代码：`kilipicks-mobile/`

## 1. 产品背景

KiliPicks 已有网页版消费者 Demo、商家管理后台、Cloudflare D1 商家目录、R2 图片存储与行为分析后台。下一阶段不是把网页简单装进 WebView，而是构建一套面向肯尼亚消费者的原生移动体验，同时继续复用已有商家数据库、公开目录接口和分析体系。

母公司传音在非洲拥有终端与渠道基础，因此首发策略以 Android 为主；工程仍使用同一套 React Native 代码支持 iOS，避免形成两个独立研发分支。

## 2. 产品目标

### 2.1 MVP 目标

1. 用户能快速发现 Nairobi 的 Beauty 商家；
2. 用户能按服务、商家名、区域和细分类目搜索；
3. 用户能区分“已签约可交易商家”和“未签约基础目录商家”；
4. 用户能查看商家详情并保存候选商家；
5. 仅在商家具备公开服务与预约资格时展示预约入口；
6. App 行为数据继续进入现有 KiliPicks Analytics 后台；
7. 提供可安装的内部 Android APK，用于团队、销售和种子用户测试。

### 2.2 成功指标

MVP 试用阶段建议观察：

- 首次打开后进入商家详情的比例；
- 每次会话浏览的独立商家数；
- 搜索使用率、无结果率和搜索后商家详情进入率；
- 收藏率与多商家比较率；
- 已签约商家的预约意向触发率；
- 崩溃率、目录接口失败率、图片加载失败率；
- Android 低速网络下的首屏可用时间。

指标基线应通过真实测试建立，PRD 不预设虚假目标值。

## 3. 用户与核心场景

### 3.1 消费者

- 想在 Nairobi 附近寻找 braids、salon、nails、spa、barber 等服务；
- 不确定商家是否真实、价格是否可参考、是否能预约；
- 会在多个商家之间比较图片、位置、服务与可信信息；
- 经常使用 Android 手机和移动数据网络，可能遇到网络波动。

### 3.2 KiliPicks 运营与销售

- 将真实但未签约商家作为基础公开目录供消费者发现；
- 给正式合作商家补充服务、价格、图片、预约方式；
- 通过消费者浏览、搜索、收藏和预约意向判断获客价值；
- 在商家签约后把基础目录升级为完整交易页。

## 4. 核心产品规则

### 4.1 未签约商家（Unsigned / Unclaimed）

允许展示：

- 商家名称；
- Beauty 细分类目；
- 大致区域；
- 公开封面图；
- “Basic listing / Not yet claimed”状态；
- 保存商家。

禁止展示：

- 电话、WhatsApp 和其他联系信息；
- 精确地址；
- 服务、价格、评价与 Customer Results；
- 预约按钮和支付入口；
- Verified Business 等可能产生误导的标识。

详情页必须自然排版，并说明资料将在商家合作后开放。

### 4.2 已签约商家（Signed）

后台发布且字段完整时可展示：

- 完整商家资料、场地照片与营业时间；
- 服务、时长、价格和 Price Verified 状态；
- 公开联系方式；
- 真实评价和真实 Customer Results；
- 预约方式、可用时段和支付规则；
- Verified Business、KiliPicks Tested 等经过事实验证的标识。

### 4.3 内容真实性

- 研发版本不得重新引入假商家、假评价、假结果或假社区帖子；
- 空内容使用明确的空状态；
- 预约未真正落库前，按钮必须标记为测试意向，不得伪造成功订单；
- App 与 Web 必须使用相同的公开发布规则，避免前后端信息不一致。

## 5. MVP 信息架构

底部导航固定为四项：

1. **Home**：品牌首屏、类目入口、推荐商家、目录规则说明；
2. **Search**：关键词、类目筛选、搜索结果；
3. **Saved**：设备本地收藏的商家；
4. **Account**：版本信息与后续账户能力占位。

二级页面：

- Provider Detail；
- Booking Intent（仅签约且可预约商家可进入）。

P1 再加入 Bookings、地图、通知；Discover/Community 应在真实内容供应和内容审核能力具备后上线。

## 6. 页面需求

### 6.1 Home

必须包含：

- KiliPicks 品牌与 Nairobi 定位；
- 明确的消费型主标题；
- 搜索主入口；
- 从真实目录动态生成的 Beauty 类目；
- 推荐商家横向列表；
- 未签约目录信息边界说明；
- 下拉刷新、加载、失败和空状态。

不得依赖写死的假商家或假内容填满首页。

### 6.2 Search

- 支持商家名、区域、主营服务、细分类目关键词；
- 支持 All 与具体类目 chips；
- 显示结果数量；
- 空结果给出修改关键词建议；
- 提交搜索时记录 query、category、resultCount；
- 点击结果进入同一个 Provider Detail 数据模型。

### 6.3 Provider Detail

共同字段：封面、商家名、类目、大致区域、收藏。

未签约模板：

- Basic Listing 标识；
- 结构化的未认领说明；
- 不渲染被限制字段；
- 不出现预约 CTA。

已签约模板：

- 完整简介、评分/事实指标；
- 服务列表、时长与价格；
- 图片 Gallery；
- 根据 `bookingEnabled` 显示预约 CTA；
- 后续可加入地图、评价、结果、团队和营业时间模块。

### 6.4 Saved

- 未登录 MVP 使用 AsyncStorage 本地保存；
- App 重启后仍保留；
- 目录中被隐藏/删除的商家不再显示；
- 收藏/取消收藏进入现有 Analytics；
- P1 登录后迁移为服务端同步收藏。

### 6.5 Booking Intent

当前交付仅完成预约入口规则和服务选择雏形：

- 仅 `signed + published + bookingEnabled` 商家可进入；
- 选择公开且可预约的服务；
- Continue 只记录 booking intent；
- 页面明确说明尚未创建付费预约。

生产预约必须补齐：服务端锁定时段、消费者信息、订单状态机、M-Pesa、退款/改期、通知和后台订单处理。

## 7. Web 到 App 功能映射

| Web 能力 | App MVP | 数据来源 | 后续动作 |
|---|---|---|---|
| Home | 原生实现 | Public Catalog API | 加入定位排序和缓存 |
| Search | 原生实现 | 本地过滤公开目录 | P1 建服务端搜索/排序 |
| Provider Detail | 原生双模板 | Public Catalog API | 增加评价、地图、营业时间 |
| Saved | 设备本地实现 | AsyncStorage | 登录后云同步 |
| Booking | 意向验证 | 服务与 booking flags | 建真实订单和支付 |
| Discover | 不进入 MVP | 当前无真实内容 | 有内容供应后上线 |
| Real Customer Results | 不进入 MVP | 当前为空 | 真实交易事实后上线 |
| Merchant Admin | 保留 Web 后台 | D1/R2 | 不在消费者 App 内实现 |
| Analytics | 复用 | `/api/analytics/events` | Dashboard 增加 mobile filter |

## 8. 数据与 API

### 8.1 已复用接口

- `GET /api/public/catalog`：公开商家、服务、可用时段；
- `POST /api/analytics/events`：App 行为事件。

环境变量：

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://nairobi-local-picks-demo.hantianyang5.chatgpt.site
```

相对 R2 代理地址必须按 API Base URL 补全；`provider-placeholder://` 不能作为网络图片请求，应显示 App 本地占位视觉。

### 8.2 P1 所需新接口

- 账户注册、OTP、刷新令牌与注销；
- 服务端搜索、分页、地理位置排序；
- 收藏同步；
- 预约创建、占位、确认、取消、改期；
- M-Pesa 支付与回调；
- 推送 token 与通知偏好；
- 评价、图片上传和内容举报；
- App 版本、功能开关和强制升级策略。

所有写操作必须有鉴权、幂等键、审计日志和速率限制。

## 9. 埋点方案

MVP 复用现有事件命名：

- `session_started`；
- `page_viewed`；
- `search_submitted`；
- `search_results_viewed` / `search_no_results`；
- `merchant_profile_viewed`；
- `merchant_saved` / `merchant_unsaved`；
- `booking_cta_clicked`；
- `booking_started`。

所有 App 事件携带：

- `productVersion=kilipicks-mobile@版本`；
- `sourceSurface=mobile_app`；
- `metadata.channel=mobile_app`；
- OS、屏幕尺寸、匿名用户 ID、会话 ID。

Analytics 失败不得阻塞核心功能；P1 应增加离线队列和批量重试。

## 10. 非功能要求

### 10.1 性能与弱网

- 首屏先显示骨架/加载态，不出现白屏；
- 图片使用合适尺寸和压缩格式；
- 列表分页或虚拟化，避免一次渲染全部商家；
- 网络失败可重试，刷新不清空已有数据；
- P1 对最近目录与图片建立缓存；
- 埋点异步发送，不影响操作响应。

### 10.2 兼容性

- Android 为主验收平台；
- 常见 360、375、390、414 宽度不溢出；
- iOS 保持代码可运行并完成关键链路回归；
- 字体缩放、触控区和读屏标签达到基础可访问要求。

### 10.3 安全与隐私

- App 中不得放置 D1、R2、后台管理或支付密钥；
- 只通过公开 API 访问数据；
- 联系方式与精确地址遵循 partnership/publication 规则；
- 上线账户前完成隐私政策、数据保留和账号删除流程；
- 图片上传需做类型、大小、恶意内容和版权来源校验；
- 支付回调只在服务端验证。

## 11. 发布策略

### Phase 0：内部技术样机

- 当前代码交付；
- Expo Go/开发构建运行；
- 连接真实公开目录；
- 完成类型检查和主要屏幕人工测试。

### Phase 1：内部 APK

- 配置 EAS Project；
- 建 `preview` APK；
- 研发、销售与肯尼亚现场团队测试；
- 收集崩溃、图片、网络和搜索问题。

### Phase 2：封闭测试

- Google Play Internal/Closed Testing；
- 接入认证、服务端收藏、真实预约沙箱、推送；
- 20–50 名种子用户与少量签约商家验证闭环。

### Phase 3：公开发布

- 完成商店素材、隐私与支持页面；
- 真实预约/M-Pesa/退款和客服流程验收；
- 灰度发布并监测稳定性；
- iOS 根据资源与用户反馈同步准备。

## 12. MVP 验收标准

1. Android 模拟器或真机可正常启动；
2. 能读取当前生产公开目录；
3. 首页不包含代码写死的假商家；
4. 搜索和类目过滤结果正确；
5. 点击任意公开商家可进入详情；
6. 未签约详情不泄露电话、精确地址、服务、价格与预约；
7. 已签约且可预约商家才出现预约入口；
8. 收藏可保存并在重启后恢复；
9. 图片相对 URL 正确拼接，缺图显示占位而非破图；
10. 网络错误可重试；
11. 关键埋点带 `mobile_app` 渠道标识进入既有后台；
12. TypeScript 严格检查通过；
13. 360–414 宽度关键页面无严重错位；
14. 无阻断级 Console/Runtime Error；
15. 预约意向不会伪装成真实成功订单。

## 13. 明确不在本期范围

- 重写 Web Demo 或 Merchant Admin；
- WebView 套壳；
- 假 Community、假评价和假 Customer Results；
- 真实付款和订单确认；
- 消费者账号正式上线；
- 商家端 App；
- 多城市和多国家正式运营能力。

## 14. 待产品确认事项

1. 首发登录方式：手机号 OTP、Google、Facebook，还是首版免登录；
2. 未签约商家是否开放“报告错误/认领商家”；
3. 真实预约的首选方式：KiliPicks 内闭环、WhatsApp，还是两者并行；
4. M-Pesa 是全额、订金还是仅预约后线下支付；
5. 地理权限采用手动区域优先还是首次启动请求定位；
6. 评价只允许已完成订单，还是允许 Verified Visit；
7. 首批签约商家和真实服务数据何时具备；
8. Discover 的真实内容生产、审核和举报责任人。
