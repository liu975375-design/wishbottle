# WishBottle

WishBottle 是一个 mobile-first 的许愿网站。本仓库当前只实现 **Release 0: Core Demo**：

```text
Make a Wish
→ 输入 Wish
→ Save
→ 播放保存动画
→ 自动生成 Wish Code
→ 设置 4 位 PIN
→ Find My Wish
→ Wish Code + PIN 找回 Wish
```

## 当前技术栈

- Next.js App Router
- TypeScript
- Supabase Postgres
- Next.js Route Handlers
- 服务端 Supabase Client
- Node.js `crypto.scrypt` + random salt
- pnpm

现有 `output/` 和 `tmp/` 目录中的需求文档、workflow、SVG、HTML 等文件均保留，不被应用代码覆盖。

## Release 0 功能范围

已实现：

- Create Wish 表单
- Wish 内容非空校验，并在判断前去除首尾空格
- 4 位数字 PIN
- Confirm PIN
- PIN scrypt hash + random salt
- 自动生成 Wish Code
- Wish Code 数据库唯一约束
- Wish Code collision 时追加 `-2`、`-3`、`-4` 并重试
- Find My Wish
- PIN 验证
- 手机优先的简单响应式界面
- 提交期间禁用按钮，避免重复点击

未实现：

- Reminder Email
- Scheduler
- Forgot PIN
- Email Verification
- Change Email
- Stop Reminder
- Delete Wish
- Multiple Reminder Management
- Parent / Carer 完整逻辑
- Timeline
- Completed Wish
- Public Sharing
- Admin
- Analytics
- Seasonal Theme
- 复杂 Animation
- Christmas / Wedding / NGO 特殊 Journey

## Wish Code 规则

现有需求文档和 workflow 没有规定具体 Wish Code 格式。因此 Release 0 采用一个简单、可读、方便手动输入的格式：

```text
单词 + 连字符 + 4 位数字
示例：MAPLE-4827
```

规则：

- 系统自动生成，用户不能编辑。
- 第一次尝试使用基础 Code，例如 `MAPLE-4827`。
- 如果数据库返回 unique constraint collision，则保持基础 Code 不变，依次尝试 `MAPLE-4827-2`、`MAPLE-4827-3`，最多重试 50 次。
- 不使用“先查询再插入”来保证唯一性。数据库 `wishes_wish_code_key` unique constraint 是最终保证。
- Wish Code 不是数据库主键；数据库内部使用 UUID `id` 作为稳定身份。

## 数据库

Migration 文件：

```text
supabase/migrations/20260922000000_create_wishes.sql
```

`wishes` 表包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` | 主键，内部稳定身份 |
| `wish_code` | `text` | 唯一查找 Code，不是主键 |
| `wish_content` | `text` | Wish 内容 |
| `pin_hash` | `text` | scrypt hash，包含随机 salt；不保存明文 PIN |
| `contact_email` | `text` | 暂时可空 |
| `contact_type` | `text` | 暂时可空 |
| `reminder_date` | `date` | 暂时可空 |
| `reminder_status` | `text` | 暂时可空 |
| `source` | `text` | 暂时可空 |
| `event_id` | `text` | 暂时可空 |
| `journey_type` | `text` | 暂时可空 |
| `created_at` | `timestamptz` | 创建时间 |
| `updated_at` | `timestamptz` | 更新时间，由 trigger 维护 |

数据库安全设置：

- 开启 RLS。
- 不创建匿名用户或 authenticated 用户的直接访问 policy。
- `anon` / `authenticated` 对 `wishes` 的直接权限被 revoke。
- Next.js 服务端使用 Service Role Key 访问数据库。
- Service Role Key 不得使用 `NEXT_PUBLIC_` 前缀，也不得发送到浏览器。

## 环境变量

复制示例文件：

```powershell
Copy-Item .env.example .env.local
```

需要配置：

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-your-service-role-key
```

不要把 `.env.local` 提交到 Git。数据库 migration 需要在 Supabase 项目中执行后才能完成 Create / Find 联调。

## 本地运行

安装依赖：

```powershell
pnpm install
```

启动开发服务器：

```powershell
pnpm dev
```

默认访问：

```text
http://localhost:3000
```

生产构建检查：

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 数据库 migration 执行

当前环境没有安装 Supabase CLI，因此可以使用 Supabase Dashboard：

1. 打开 Supabase 项目。
2. 进入 SQL Editor。
3. 执行 `supabase/migrations/20260922000000_create_wishes.sql`。
4. 确认 `public.wishes` 表已创建。
5. 确认表已开启 RLS。
6. 确认 `wish_code` 存在 unique constraint。

如果之后安装并配置 Supabase CLI，也可以按项目流程执行 migration。

## 测试完整流程

1. 配置 `.env.local`。
2. 启动 `pnpm dev`。
3. 打开 `http://localhost:3000/create`。
4. 输入 Wish。
5. 点击 Save Wish 并等待保存动画完成。
6. 记录页面显示的 Wish Code。
7. 输入并确认相同的 4 位 PIN。
9. 打开 `http://localhost:3000/find`。
10. 输入 Wish Code 和正确 PIN。
11. 应显示刚保存的 Wish 内容。
12. 使用错误 PIN 再次尝试，应显示统一错误，且不显示数据库信息。

## 手机测试

在同一 Wi-Fi 下，从项目目录运行：

```powershell
pnpm exec next dev --hostname 0.0.0.0
```

在电脑上查看局域网 IP：

```powershell
ipconfig
```

然后在 iPhone Safari 或 Android 浏览器打开：

```text
http://<电脑局域网 IP>:3000
```

如果 Windows 弹出防火墙提示，允许 Node.js 访问专用网络。手机测试重点：

- 输入框可以使用数字键盘输入 PIN。
- 按钮容易点击。
- 页面没有横向滚动。
- Save / Find 请求期间按钮显示 loading 且不可重复提交。
- 错误和成功状态清晰可见。

## API

### 创建 Wish

```text
POST /api/wishes
Content-Type: application/json

{
  "wishContent": "A peaceful year",
  "name": "Mary",
  "contactType": "own_email",
  "contactEmail": "mary@example.com",
  "reminders": [6]
}
```

成功响应返回 Wish Code、Wish 内容、创建时间和一次性 `pinSetupToken`。服务端使用高熵临时凭据写入占位 `pin_hash`，该凭据不能作为正式 PIN 使用。

### 设置 Wish PIN

```text
POST /api/wishes/pin
Content-Type: application/json

{
  "wishCode": "MARY22092026",
  "setupToken": "one-time-token",
  "pin": "4827",
  "confirmPin": "4827"
}
```

该接口验证一次性 setup token 后，以 scrypt hash 替换临时 PIN。正式 PIN 固定为 4 位数字。Wish 找不到、token 失效或已被使用时返回统一错误。

### 找回 Wish

```text
POST /api/wishes/find
Content-Type: application/json

{
  "wishCode": "MAPLE-4827",
  "pin": "4827"
}
```

Wish Code 会被 trim 并转成大写。Wish 不存在或 PIN 不正确时返回统一错误：

```text
Wish Code or PIN is incorrect.
```

## 安全说明

- PIN 使用 Node.js `crypto.scrypt`，参数为 `N=32768`、`r=8`、`p=1`。
- 每次 PIN hash 使用 16 字节随机 salt。
- hash 编码格式为：

```text
scrypt$N$r$p$salt$derivedKey
```

- PIN 验证使用 `timingSafeEqual`。
- Find API 不返回 `pin_hash`。
- 数据库错误只在服务端日志中记录，不直接返回给客户端。
- Release 0 还没有持久化登录失败限流；在正式生产环境前需要评估 PIN 暴力尝试防护。
