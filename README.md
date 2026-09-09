# Rental Desk · 租房管理

公开演示：[租房管理看板](https://marstee88.github.io/rental-desk-mvp/)。点击「登录正式管理」后，已授权管理员及员工可新增房间、登记租客入住和首期账单。

## 本机运行

Node.js 24、pnpm 10。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

浏览器打开开发服务器的 `/rental-desk-mvp/` 路径。直接打开源代码 `index.html` 不会运行 React。未配置云端变量时，公开演示可用，正式登录明确显示尚未启用。

## 云端设置（项目管理员）

1. 创建本人拥有的 Supabase 项目。正式数据库不导入任何模拟资料。
2. 在 SQL Editor 执行 `supabase/migrations/202609090001_rental_management.sql`，或使用已连接该项目的 Supabase CLI 迁移。迁移只在新项目执行一次。
3. 关闭 Auth 的公开注册，最低密码长度设为 12。站点 URL 设为 `https://marstee88.github.io/rental-desk-mvp/`，允许邀请/恢复跳转到该 URL 的 `?account=setup` 页面；本机测试可另外允许 `http://127.0.0.1:5173/rental-desk-mvp/?account=setup`。
4. 通过 Supabase Auth 邀请或建立本人账号。核对本人邮箱及 Auth 用户 UUID，再由项目管理员执行下方初始化 SQL。不要将真实邮箱或 UUID 写入仓库。
5. 在 Edge Functions 发布 `supabase/functions/manage-staff/index.ts`，函数名 `manage-staff`。关闭仅兼容旧签名的「Verify JWT with legacy secret」；函数自身通过 `auth.getUser(token)` 校验登录，再查询有效管理员身份，未通过检查的请求无法操作。`APP_URL` 为正式网页根路径，服务端使用平台提供的 `SUPABASE_SERVICE_ROLE_KEY`。本机跨域调试额外设置 `EXTRA_ALLOWED_ORIGINS=http://127.0.0.1:5173`。
6. 配置本人拥有的 SMTP 发信服务，验证邀请与密码恢复邮件。Supabase 默认发信服务有限制，不能将默认邮件测试成功当作任意员工邀请已可用。管理员在正式页面填写员工邮箱并主动点击「发送员工邀请」。
7. GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 设置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`。只使用公开客户端 key，不能使用 secret/service-role key。本机在未纳入版本控制的 `.env.local` 设置同名变量。
8. 管理员和员工分别登录验证权限及保存功能，再审阅合并 PR。Pages 自动构建发布；首次发布前邮件链接可能仍打开旧演示页，可在发布后重新请求密码恢复邮件。

```sql
-- 用已核对的本人 Auth UUID 和邮箱替换占位值；不要在公开仓库提交替换后的 SQL。
insert into public.members(user_id, email, role, active)
values ('REPLACE_WITH_OWNER_AUTH_UUID', 'REPLACE_WITH_OWNER_EMAIL', 'owner', true);
```

## 使用约定

- 房间：同一房源内房号不重复，保存后为空房。
- 租客：登记已发生的入住，必须选空房；入住日期不得晚于今天，合约不能已结束。一间房一期只安排一个租客。
- 首期应收和已付手动填写，金额最多两位小数；不足月不自动折算。账单月份取付款到期日所在月份。
- 总览可切换账单月份；入住统计为当前已登记入住状态，到期范围为马来西亚今天至未来 30 天（含边界）。本期没有退租功能，合约过期不会自动释放房间。
- 已付清租客仍在「租客管理」中。跨设备打开后使用「刷新资料」读取最新记录。
- 管理员可查看合作分成、邀请及启停员工。员工可看全部房间、租客及租金并新增；不能访问合作分成和管理账号。
- 本期不含编辑删除、退租换房、续收款登记、每月自动出账、预订或合作分成录入。

## 权限与验证

业务表启用 RLS；浏览器无直接写表权限，写入只经过检查成员资格的事务函数。`register_tenant` 锁定房间并由唯一约束保证并发安全；租客、租约与账单同时成功或同时回滚。每次表单携带提交 UUID，网络响应丢失后重试不会重复新增。`operation_requests` 不向浏览器开放。

本机数据库测试使用独立内存 PostgreSQL（PGlite）。GitHub 检查使用 PostgreSQL 17，并通过两个独立连接验证争抢同一间房。测试只使用 `example.invalid` 和匿名测试资料，禁止把 `TEST_DATABASE_URL` 指向正式数据库。

浏览器自动化使用明确的接口模拟，覆盖 1280px/390px、失败重试、新增、刷新、明细、退出及员工/管理员页面区别。这不替代真实云端双账号和邮件验收。

## 发布检查清单

- [ ] Supabase 公开注册关闭，所有业务表 RLS 开启。
- [ ] 本人管理员可登录，员工仅通过管理员邀请获得权限。
- [ ] 自有 SMTP 邀请和恢复邮件可达，回跳设置密码成功。
- [ ] Edge Function 已部署，员工调用邀请接口返回拒绝。
- [ ] 本人及员工两种身份实测，匿名和已停用账号无法读取资料。
- [ ] GitHub 自动检查成功，页面两项公开连接变量已设置。
- [ ] 用户审阅后手动合并，检查 Pages 发布结果。

参考：[数据库访问控制](https://supabase.com/docs/guides/database/postgres/row-level-security)、[邀请用户](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)、[邮件配置](https://supabase.com/docs/guides/auth/auth-smtp)。
