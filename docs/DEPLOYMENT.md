# 部署与运维指南（DEPLOYMENT）

> 适用范围：HQU-CEAS v2（PLAN_V2 §1 部署决策、§5 性能、§6 安全的落地文档）。
> 一句话架构：**开发=双进程**（vite dev 3000 + 后端 4000）；**生产=单源单进程**（Express 在 4000 同时服务前端构建产物 + `/api` + `/ws`，cloudflared 只暴露这一个源）。

---

## 1. 两种运行模式

| | 开发模式（start.bat） | 生产模式（start-prod.bat） |
|---|---|---|
| 前端 | vite dev server，端口 3000，HMR | `vite build` 产物由 Express 静态服务（同源 4000） |
| 后端 | `tsx watch`，端口 4000 | `tsc` 产物 `node dist/server.js`，`NODE_ENV=production` |
| 静态缓存 | 无 | `assets/*`（带内容哈希）`Cache-Control: public, max-age=31536000, immutable`；`index.html` `no-cache` |
| JWT_SECRET | 缺失仅告警（回退开发默认值） | 缺失**拒绝启动**（fail-fast） |
| 公网 | **禁止**（vite dev 慢、内存高、无缓存头） | cloudflared 隧道指向 `http://localhost:4000` 单源 |

生产模式下 SPA 路由回退：非 `/api`、非 `/ws`、非 `/assets` 的 GET 未命中静态文件时返回 `index.html`（前端路由接管）；`/assets` 未命中直接 404，不会被 HTML 掩盖。前端 `dist` 缺失时后端只告警并跳过静态服务，API 照常工作。

开发环境如需验证单源静态服务：先 `npm run build -w packages/frontend`，再在 `packages/backend/.env` 中设 `SERVE_STATIC=1` 启动后端即可（无需 NODE_ENV=production）。

## 2. 本机开发

```bash
npm install                # 首次
npm run db:generate        # 首次/每次改 schema 后
npm run dev                # 后端 4000 + 前端 3000
# 或双击 start.bat（含 cloudflared，仅限调试用途）
```

访问 `http://localhost:3000`，vite 将 `/api`、`/ws` 代理到 4000。

## 3. 生产单源部署（start-prod.bat + cloudflared）

### 3.1 一次性准备

1. **JWT_SECRET**（必须）：生成强随机密钥并写入 `packages/backend/.env`：

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   `NODE_ENV=production` 且未设置 JWT_SECRET 时后端直接拒绝启动。占位值 `replace-with-a-long-random-secret` 同样会被 `start-prod.bat` 拦下。

2. **CORS_ORIGIN**：填公网域名，如 `https://zongce.youngspace.top`（多个用英文逗号分隔）。单源部署下前端与 API 同源，CORS 主要影响的是跨源调用方。

3. **cloudflared 隧道指向 4000 单源**：检查 `%USERPROFILE%\.cloudflared\config.yml`，ingress 必须是后端端口（不要再指向 3000 的 vite dev）：

   ```yaml
   tunnel: zongce
   credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json
   ingress:
     - hostname: zongce.youngspace.top
       service: http://localhost:4000
     - service: http_status:404
   ```

### 3.2 启动

双击 `start-prod.bat`，它会依次：检查 JWT_SECRET → `npm run build`（后端 tsc + 前端 vite）→ 释放 4000 端口 → `NODE_ENV=production` 单进程启动 → 健康检查 `/api/health` → 启动 cloudflared。按任意键停止全部服务。

手动等价命令（PowerShell）：

```powershell
npm run build
npm run start:prod -w packages/backend   # 脚本内置 NODE_ENV=production
# 或一条命令（构建+启动）：npm run start:prod
cloudflared tunnel run zongce
```

### 3.3 部署后自检

```bash
curl -s http://localhost:4000/api/health          # {"status":"ok",...}
curl -sI http://localhost:4000/assets/<某个js>     # Cache-Control: public, max-age=31536000, immutable
curl -sI http://localhost:4000/                   # text/html + Cache-Control: no-cache
curl -s  http://localhost:4000/evaluation/dashboard | head -1   # SPA fallback 返回 <!doctype html>
```

## 4. 安全清单（公网前提，PLAN_V2 §6）

| 项 | 现状与要求 |
|---|---|
| JWT_SECRET | 生产 fail-fast；强随机 ≥48 字节；泄露即全站可伪造 token，妥善保管 `.env`（已 gitignore） |
| 登录限流 | `/api/platform/auth/login`（含旧别名 `/api/auth/login`）20 次/15 分钟/IP |
| 全局限流 | `/api` 600 次/分钟/IP（`trust proxy=1`，cloudflared 一跳内取真实客户端 IP） |
| helmet | 默认基线头已启用。注意其 CSP 含 `upgrade-insecure-requests`：经 https（cloudflared）或 localhost 访问无影响；若以**局域网明文 http**（如 `http://192.168.x.x:4000`）访问生产页面，浏览器可能把子资源请求升级为 https 导致加载失败——生产访问请走 https 隧道或本机 localhost |
| 请求体积 | JSON 默认 2mb；仅导入前缀（`/api/evaluation/import`、旧别名 `/api/import`）50mb；文件上传走 multer 内存存储 |
| CORS | 按环境变量白名单，凭据模式 |
| vite dev 不出公网 | 强制：公网只允许 start-prod.bat 的单源架构 |
| 审计日志 | 保留（数据库 `AuditLog`，管理端可查） |
| 备份 dev.db | 见 §6 |

## 5. 高并发调优与容量边界

### 5.1 已落地的调优项

- SQLite `journal_mode=WAL` + `busy_timeout=5000` + `synchronous=NORMAL`（启动时自动执行，见 `core/db.ts`）：读写可并行，写锁竞争排队而非报错。
- 导入/重算链路事务化批量（消除逐行串行往返）；`Score @@index([academicYearId, category])`。
- gzip 压缩、静态资源 immutable 缓存、前端路由级代码分割（首屏只拉所需 chunk）。
- 限流兜底防滥用（不影响正常并发，见 §4）。

### 5.2 实测容量（本机 loopback，见 §7 数据表）

单进程即可支撑：最重的读端点（班级综测总表，~14KB JSON）60 并发下 **~550–570 req/s、p95 < 140ms**；轻端点 1300–2700 req/s。学院规模（千级用户、百级并发、读多写少）距此有量级余量。

### 5.3 容量边界（如实）

- **写并发**：SQLite 全库单写者。WAL 下读不阻塞写、写不阻塞读，但**写与写互斥**，重写操作（多班同时批量导入）会串行排队（busy_timeout 5s 内自动等待）。班级数量级的并发导入没问题；**持续数百写/秒**不是 SQLite 的场景。
- **CPU 密集操作**：Excel 解析/导出、PDF 打包在主线程执行，进行期间所有请求延迟会短暂抬高。低频管理操作可接受；若成为常态再考虑 worker 线程。
- **单进程/单机**：SQLite 单文件不适合多进程/多机共享写。需要横向扩展或市级/多学院规模时，按 §8 迁移 PostgreSQL——这是明确的升级触发条件。
- **压缩的取舍**（实测）：gzip 把 14.2KB 响应压到 1.5KB（9.4×），公网链路收益远大于其 CPU 成本；代价是 loopback 压测里最重端点吞吐比无压缩基线低 ~25%（见 §7 说明）。公网部署保留压缩是正确取舍。

## 6. 备份与回滚

数据库是单文件：`packages/backend/prisma/dev.db`（WAL 模式下伴随 `dev.db-wal`、`dev.db-shm`）。

- **冷备（推荐，最简单）**：停止服务后复制 `dev.db`（连同存在的 `-wal`/`-shm` 一起复制）。
- **热备**：不停服时不要直接复制文件（WAL 未合并会丢最近写入），用 SQLite 自带在线备份：

  ```bash
  sqlite3 packages/backend/prisma/dev.db ".backup 'backup-20260726.db'"
  ```

- **回滚**：停服 → 用备份文件替换 `dev.db`（删除旧 `-wal`/`-shm`）→ 重启。
- 建议每次批量导入/学年结转前手动备份一次；备份文件不要放进 git。

## 7. bench 压测：用法与本次实测

### 7.1 用法

```bash
node scripts/bench.mjs                          # 默认 http://127.0.0.1:4000，60 并发，每端点 600 次
node scripts/bench.mjs --port 4100              # 指定端口（如生产实例）
node scripts/bench.mjs --base http://127.0.0.1:4100 --concurrency 60 --requests 600
```

- 固定打 4 个端点：`/api/health`、`/api/evaluation/scores/class/11`、`/api/declaration/awards/candidates/11`、`/api/declaration/national-scholarships`；输出 p50/p95/max/mean/req/s/错误分布。
- JWT 用 backend 的 `jsonwebtoken` + `packages/backend/.env` 的 `JWT_SECRET` 现签 admin token（可用环境变量覆盖）。
- 每个并发 worker 携带独立 `X-Forwarded-For` 模拟独立客户端（后端按 IP 限流 600 次/分，单 IP 打满会测成 429）。
- **仅限本地/授权环境使用**：现签管理员 token + 伪造来源 IP + 高并发，任何一条都不允许指向非授权系统。

### 7.2 本次实测（2026-07-26，60 并发、每端点 600 次、warmup 20）

环境：同一台 Windows 11 本机 loopback，Node v24.12.0，真实 dev.db 数据；测试期间 vite dev(3000)、dev 后端(4000)、生产实例(4100) 同机运行，数字含相互干扰噪声。基线为 2026-07-27 Wave 1 重构前的 v1 dev 模式（无 helmet/压缩/限流/WAL，仅公布 p50/p95）。

| 端点 · 指标 | 基线 v1 dev | v2 dev (4000) | v2 prod (4100) |
|---|---|---|---|
| health p50 | 29ms | 18.6ms | 18.5ms |
| health p95 | — | 40.1ms | 40.3ms |
| scores/class/11 p50 | 81ms | 105.6ms | 103.2ms |
| scores/class/11 p95 | 118ms | 138.1ms | 128.7ms |
| award-candidates/11 p50 | 34ms | 44.8ms | 46.0ms |
| national-scholarships p50 | 27ms | 30.4ms | 26.3ms |
| 错误数（4×600 请求） | — | 0 | 0 |

吞吐（req/s，60 并发饱和态）：health 2722/2680，scores/class 544/565，award-candidates 1305/1312，national-scholarships 1959/2170（v2 dev / v2 prod）。

**解读（不吹不黑）**：

- prod 与 dev 的 API 延迟基本相同——生产模式的收益在**前端交付**（构建产物 + immutable 缓存 + 单源省去代理/CORS），不在 API 路径本身。
- `scores/class/11` p50 比基线高 ~25%。定位：该端点单请求仅 ~8ms（含 gzip 与否均如此），60 并发下的 p50≈并发/吞吐（60/565≈106ms），是饱和排队时间；吞吐下降来自 v2 新增的每请求中间件成本（gzip 14.2KB→1.5KB、helmet、限流记账）。loopback 上带宽免费，只显成本；公网上 9.4× 的体积缩减远超这 ~1ms/请求的 CPU 成本，属于为公网部署买的正确保险。
- health/national-scholarships 持平或略优于基线；60 并发 2400 请求全程 0 错误、0 触发限流（多客户端模拟下）。

## 8. PostgreSQL 迁移路径（规模升级时）

**触发条件**：多学院/市级规模、持续高写并发、或需要多进程/多机部署（见 §5.3）。学院规模请继续用 WAL 化 SQLite，零运维。

**步骤**：

1. 安装 PostgreSQL，创建库与账号：`CREATE DATABASE hqu_ceas; CREATE USER ceas WITH PASSWORD '...'; GRANT ALL PRIVILEGES ON DATABASE hqu_ceas TO ceas;`
2. 改 `packages/backend/prisma/schema.prisma` 的 datasource：

   ```prisma
   datasource db {
     provider = "postgresql"   // 原 "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

3. 改 `packages/backend/.env`：`DATABASE_URL="postgresql://ceas:密码@localhost:5432/hqu_ceas"`
4. 重建 schema：`npm run db:generate && npm run db:push`（本项目用 `db push` 管理 schema，无迁移历史包袱；若曾有 `prisma/migrations` 目录需先删除/归档，SQLite 的迁移历史在 PG 下不可复用）。
5. **数据搬迁**：Prisma 无官方一键工具。可写一次性脚本（两个 PrismaClient 分别连 SQLite 与 PG，按外键依赖顺序逐表 `findMany` → `createMany`），或经 CSV/SQL 中转。注意 SQLite 与 PG 的布尔/日期存储差异。
6. 迁移后验证：`npm test -w packages/backend` + `node scripts/bench.mjs` + 关键链路手工冒烟。

**注意点**：

- `core/db.ts` 的 SQLite PRAGMA 在 PG 下执行失败仅告警、不阻断（代码已容错，无需修改）。
- 大小写敏感：SQLite 的 `contains`（LIKE）对 ASCII 不区分大小写，PG 区分。涉及模糊搜索的查询迁移后需要复核，必要处加 `mode: 'insensitive'`。
- 连接池：PG 下建议在 DATABASE_URL 追加 `?connection_limit=10` 量级（约 CPU 核数×2），避免默认值在高并发下打满 PG 连接。
- 备份方式随之改为 `pg_dump`，§6 的文件复制方案不再适用。
