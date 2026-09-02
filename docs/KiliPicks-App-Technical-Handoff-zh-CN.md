# KiliPicks App 技术交接说明

## 1. 技术选择

采用 Expo SDK 57、React Native 0.86、React 19.2 和 Expo Router。原因：一套 TypeScript 代码覆盖 Android/iOS；页面与深链按文件组织；可通过 EAS 生成内部 APK 和商店二进制；团队仍可复用现有 React/TypeScript 能力。

官方参考：

- Expo Router：https://docs.expo.dev/router/introduction/
- Router 核心概念：https://docs.expo.dev/router/basics/core-concepts/
- TypeScript：https://docs.expo.dev/guides/typescript/
- EAS Build：https://docs.expo.dev/build/setup/

## 2. 目录结构

```text
kilipicks-mobile/
├─ app/                         # Expo Router 页面
│  ├─ (tabs)/                  # Home / Search / Saved / Account
│  ├─ provider/[id].tsx        # 商家详情
│  └─ booking/[providerId].tsx # 预约意向
├─ src/
│  ├─ analytics/               # 现有埋点接口适配
│  ├─ api/                     # Public Catalog 请求
│  ├─ catalog/                 # 目录状态与刷新
│  ├─ components/              # 商家卡片、加载/失败/空状态
│  ├─ config/                  # 环境与图片 URL
│  ├─ saved/                   # 本地收藏
│  ├─ theme/                   # 品牌 Token
│  ├─ types/                   # API DTO
│  └─ utils/                   # 类目显示逻辑
├─ docs/                       # PRD 与技术交接
├─ app.json                    # 包名、scheme、平台配置
├─ eas.json                    # 内测 APK/生产构建配置
└─ package.json
```

## 3. 与现有 Web 的边界

- Web Demo 和 Merchant Admin 继续由当前根工程维护；
- App 不直接访问 D1/R2，也不复制商家静态数据；
- App 通过 `GET /api/public/catalog` 获取服务端已裁剪的公开数据；
- App 通过 `POST /api/analytics/events` 写入同一个 Analytics；
- DTO 目前在 App 中维护兼容副本；正式研发应将 Public DTO 抽成共享 package 或用 OpenAPI 自动生成，防止字段漂移。

## 4. 环境

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://nairobi-local-picks-demo.hantianyang5.chatgpt.site
```

本机后端连接真机时必须使用电脑局域网 IP，不能使用 `127.0.0.1`。生产、预发布和开发应配置不同 API Base URL，禁止在代码中存放密钥。

## 5. 关键实现说明

### CatalogContext

App 启动拉取一次公开目录，各页面共享数据；支持下拉刷新与失败重试。生产版应增加缓存、过期时间、分页和请求观测。

### 图片

- `http(s)` 直接加载；
- `/api/public/media/...` 使用 API Base URL 补全；
- `provider-placeholder://` 由原生占位卡处理；
- 生产版建议使用 `expo-image` 和 CDN 缩略图参数。

### Saved

MVP 用 AsyncStorage 存 ID。它不是跨设备账户数据。接入登录后应迁移到服务端，并保留本地 optimistic update。

### Analytics

埋点复用 Web 事件名，并添加 `mobile_app`、产品版本和 OS。当前为 fire-and-forget；生产版应加入离线队列、批量、重试上限和采样策略。

### Booking

当前只验证服务选择和 booking intent，不创建订单。禁止仅靠客户端判断时段和付款结果。正式实现必须由服务端锁定库存、生成订单并验证 M-Pesa 回调。

## 6. 运行与构建

```bash
cd kilipicks-mobile
cp .env.example .env
pnpm install
pnpm typecheck
pnpm start
```

Android 内测 APK：

```bash
eas init
eas build --platform android --profile preview
```

`eas init` 后把生成的 Project ID 写入 `app.json`，并由组织账号持有 EAS 项目，而不是使用个人临时账号。

## 7. 上线前必须补齐

- API 分页、缓存、超时和错误码规范；
- Sentry/Crashlytics 或等价崩溃监控；
- 环境分离、CI、签名与密钥托管；
- 自动化单元、接口契约和端到端测试；
- 认证、授权、账号删除和隐私同意；
- 真实预约、库存、支付、退款和通知；
- 地图、权限与定位降级；
- 图片 CDN、多尺寸和弱网策略；
- 后台增加 App 版本/渠道筛选；
- Google Play 与 App Store 合规素材。

## 8. 建议研发顺序

1. 锁定 DTO/OpenAPI 与三套环境；
2. 做目录分页、缓存、错误监控；
3. 完成 OTP 登录和服务端收藏；
4. 完成商家服务/时段与真实预约沙箱；
5. 接 M-Pesa 和订单状态机；
6. 接推送、地图和客服流程；
7. 用少量真实签约商家闭环验证；
8. 再开放评价、Customer Results 与 Discover。
