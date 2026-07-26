# 架构说明(v2)

本文档描述 HQU-CEAS v2 的整体架构:双系统边界、模块划分、路由总表、数据模型与工程约定。业务规则见 [BUSINESS.md](BUSINESS.md),端点级 API 对照见 [API.md](API.md),开发规范见 [DEVELOPMENT.md](DEVELOPMENT.md),v1→v2 变更见 [CHANGELOG-V2.md](CHANGELOG-V2.md)。

## 1. 总览

npm workspaces 单仓库,两个工作区:

| 工作区 | 包名 | 职责 |
| --- | --- | --- |
| `packages/backend` | `hqu-ceas-backend` | Express 4 REST API + WebSocket + Prisma 6 / SQLite(WAL) |
| `packages/frontend` | `hqu-ceas-frontend` | React 19 单页应用,Vite 7 构建,全路由懒加载 |

**核心设计:一套平台、两个业务系统。** 双系统边界同时落在三处,新人看前缀即知身在何处:

- 前端路由前缀:`/evaluation/*`(综测)、`/declaration/*`(申报),其余为平台共用;
- API 前缀:`/api/platform`、`/api/evaluation`、`/api/declaration`;
- 后端目录:`modules/platform`、`modules/evaluation`、`modules/declaration`。

### 运行拓扑

**开发模式**(`npm run dev`):双进程,Vite 代理。

```text
浏览器 ──▶ Vite dev (3000) ── proxy /api、/ws ──▶ Express (4000)
                                                   ├── Prisma ──▶ prisma/dev.db (SQLite, WAL)
                                                   ├── storage/   (签名、PDF,SHA256 登记)
                                                   ├── templates/ (官方附件 Excel 模板)
                                                   └── SMTP       (邮件通知)
```

**生产模式**(单源部署,`npm run start:prod` / `start-prod.bat`):`NODE_ENV=production` 下 Express 同源服务 API + WebSocket + 前端构建产物,公网仅经 cloudflared 暴露这一个源,不再暴露 Vite dev server。静态服务在 `app.ts` 落地:`/assets/*` 一年 immutable 强缓存,`index.html` no-cache,非 `/api`、`/ws`、`/assets` 的 GET 走 SPA fallback;开发环境可用 `SERVE_STATIC=1` 验证。启动步骤与调优见 [DEPLOYMENT.md](DEPLOYMENT.md)。

```text
公网 ──▶ cloudflared ──▶ Express (4000)
                          ├── /api/*、/ws        (业务)
                          └── frontend/dist 静态 + SPA fallback
```

## 2. 双系统路由总表

### 2.1 前端路由(27 条 + NotFound 兜底)

路由表定义于 `packages/frontend/src/app/App.tsx`,全部 `React.lazy` 懒加载;16 条旧路径保留客户端重定向(见 [CHANGELOG-V2.md](CHANGELOG-V2.md#前端旧路径重定向表))。

| 系统 | 路径 | 页面 | 角色 |
| --- | --- | --- | --- |
| 平台 | `/` | 已登录 → `/entry`,未登录 → `/login` | - |
| 平台 | `/login` | 管理员/班长登录 | admin, monitor |
| 平台 | `/entry` | 系统入口(双系统开放状态) | admin, monitor |
| 平台 | `/guide` | 新手指引(角色化分步) | admin, monitor |
| 平台 | `/accounts` | 账号管理 | admin |
| 平台 | `/accounts-mail` | 邮箱配置与发送 | admin |
| 平台 | `/mail-templates` | 邮件模板 | admin |
| 平台 | `/audit-logs` | 操作日志 | admin |
| 平台 | `/settings` | 系统设置 | admin, monitor |
| 综测 | `/evaluation/dashboard` | 综测总览 | admin |
| 综测 | `/evaluation/scores` | 分数管理 | admin |
| 综测 | `/evaluation/students` | 学生管理 | admin |
| 综测 | `/evaluation/import` | 数据导入 | admin, monitor |
| 综测 | `/evaluation/export` | 附件导出 | admin, monitor |
| 综测 | `/evaluation/class/dashboard` | 本班综测总览 | monitor |
| 综测 | `/evaluation/class/scores` | 本班综测 | monitor |
| 综测 | `/evaluation/class/review` | 审核小组确认 | monitor |
| 申报 | `/declaration/reviews` | 申报审核 | admin |
| 申报 | `/declaration/national-scholarship` | 国家奖学金评定 | admin |
| 申报 | `/declaration/import` | 申报数据导入 | admin, monitor |
| 申报 | `/declaration/export` | 申报材料导出 | admin |
| 申报 | `/declaration/tags` | 标签视图 | admin |
| 申报 | `/declaration/class/awards` | 奖学金申报 | monitor |
| 申报 | `/declaration/class/honors` | 荣誉称号申报 | monitor |
| 申报 | `/declaration/class/submissions` | 提交记录 | monitor |
| 审核 | `/review-login` | 审核成员邀请登录 | reviewer |
| 审核 | `/review/scores` | 审核成员分数核对 | reviewer |

### 2.2 API 前缀(挂载于 `app.ts`)

新前缀 31 处挂载;全部旧前缀(30 个)以别名再挂一次(同 router 实例,标注 deprecated),过渡零断裂。端点级明细(方法/权限/说明)见 [API.md](API.md)。

| 新前缀 | 资源 |
| --- | --- |
| `/api/platform/*` | auth、users、grades、students、academic-years、system、signatures、pdf-materials、audit-logs、mail(+settings/templates/logs) |
| `/api/evaluation/*` | scores、import、templates、score-review-groups、score-review-invites、export |
| `/api/declaration/*` | external-awards、award-quotas、class-honors、awards、award-declarations、national-scholarships、honors、honor-declarations、declaration-supplements、declaration-reviews、tags、export |
| `/api/health` | 健康检查(status/timestamp/version/uptime) |
| `/ws` | WebSocket(路径不变) |

## 3. 后端架构(packages/backend)

### 3.1 目录树

```text
src/
├── server.ts        # 进程入口:HTTP 监听 + WS 挂载 + 优雅退出(SIGINT/SIGTERM,10s 强退兜底)
├── app.ts           # 应用组装:安全中间件 → 新前缀挂载 → 旧别名 → 健康检查 → 静态服务(生产) → 404 → errorHandler
├── core/            # 与具体业务无关的基础设施
│   ├── config.ts    # 显式加载 .env;JWT_SECRET 生产 fail-fast;端口/CORS/上传目录
│   ├── db.ts        # Prisma 单例 + SQLite PRAGMA(WAL、busy_timeout=5000、synchronous=NORMAL)
│   ├── cache.ts     # 进程内 TTL 缓存(namespace + get/set/memo/invalidate/invalidatePrefix)
│   ├── ws.ts        # WebSocket:按班级房间 + 管理员审计频道,30s 心跳,token 鉴权
│   ├── middleware/  # auth.ts(JWT+角色门禁) errorHandler.ts security.ts(helmet/限流/压缩/体积)
│   └── utils/       # calculation ranking major password token excel(TEMPLATE_DIR) testUtils
├── modules/
│   ├── platform/    # routes/(13) services/(12)  — 账号、组织、学年、设置、签名、PDF、审计、邮件
│   ├── evaluation/  # routes/(6) services/(6) rules/(scoreRules) — 分数、导入、模板、审核小组、综测导出
│   └── declaration/ # routes/(12) services/(13) rules/(5) — 奖学金、荣誉、国奖、申报审核、申报导出
└── types/           # 第三方类型补充(compression.d.ts)
```

分层调用方向固定为 `routes → services → prisma`:路由层只做参数解析与权限门禁,业务规则与数据访问全部在服务层;规则常量与纯函数放各模块 `rules/`;单元测试(23 个 `*.test.ts`,76 用例)与被测文件同目录。

### 3.2 core/ 职责表

| 文件 | 职责 |
| --- | --- |
| `config.ts` | 自实现 `.env` 解析(真实环境变量优先);生产缺 `JWT_SECRET` 抛错拒启,开发缺失仅告警用 fallback;导出 `config` 与 `BACKEND_PACKAGE_ROOT` |
| `db.ts` | PrismaClient 单例;启动时执行 SQLite PRAGMA(测试子进程 `NODE_TEST_CONTEXT` 下跳过);失败仅告警不阻断 |
| `cache.ts` | `cacheService`:热点读取 30s~5min 记忆化(院奖候选/分配、审核状态、系统状态、邮件模板等) |
| `ws.ts` | `setupWebSocket(server)`;`broadcastToClass` / `broadcastToAdmins` / `broadcastScoreReviewAudit` 供服务层调用 |
| `middleware/auth.ts` | `authMiddleware`(Bearer JWT)、`adminOnly`、`monitorClassCheck`(admin 放行;monitor 仅限本班 classId)、`reviewerOnly` |
| `middleware/security.ts` | helmet、compression、全局限流 600 次/分/IP、登录限流 20 次/15 分/IP、JSON 2mb(导入前缀 50mb)、urlencoded 2mb |
| `middleware/errorHandler.ts` | 兜底 500,统一 `{ error }`;`message` 仅开发环境返回 |
| `utils/` | `calculation`(学业/体育折算)、`ranking`、`major`(班名→专业)、`password`(bcrypt 12)、`token`(JWT 24h)、`excel`(`TEMPLATE_DIR`、workbook→Buffer)、`testUtils`(replaceMethod 打桩,仅测试可用) |

### 3.3 modules/ 服务清单

| 模块 | 服务 |
| --- | --- |
| platform | `authService`、`userService`、`studentService`、`academicYearService`、`systemSettingService`、`signatureService`、`pdfService`(协议/确认书 PDF)、`fileStorageService`(SHA256)、`auditService`(前后值快照)、`mailConfigService`(SMTP,授权码加密)、`mailService`、`mailTemplateService` |
| evaluation | `scoreService`(分数+加分明细+重算,单事务)、`importService`(学业/体育/个人综测填写表)、`templateService`(下载模板生成)、`scoreReviewGroupService`、`scoreReviewInviteService`(令牌哈希+设备绑定)、`exportService`(附件 2/4、年级 ZIP、失败记录、账号清单) |
| declaration | `awardService`、`awardAllocationService`(院奖分配预览)、`awardQuotaService`、`awardDeclarationService`、`honorService`、`honorDeclarationService`、`declarationSupplementService`、`declarationReviewService`、`externalAwardImportService`、`classHonorImportService`、`nationalScholarshipService`(合组/候选池/上界 B/稳健分层/评议留痕)、`tagService`、`exportService`(申报汇总/院奖分配/荣誉明细/申报附件 2/签字名单/邮件记录) |
| declaration/rules | `awardRules`(候选条件、1000/800/600、互斥)、`honorRules`+`honorRulesInternal`(优秀学生/优干条件与名额)、`declarationRules`(确认项)、`nationalScholarshipRules`(国奖四算法,纯函数) |

## 4. 数据模型(prisma/schema.prisma,31 个模型)

| 业务域 | 模型 |
| --- | --- |
| 组织与人员 | `User`、`Grade`、`Class`、`Student`、`AcademicYear` |
| 成绩与导入 | `Score`、`ScoreBonusDetail`、`ImportLog`、`ExternalAwardRecord` |
| 配额与荣誉 | `AwardQuota`、`ClassHonorRecord` |
| 申报域 | `DeclarationBatch`(状态机)、`DeclarationStudent`(条件快照)、`DeclarationSupplement`、`DeclarationChecklistItem`、`AgreementSignature` |
| 综测审核域 | `ScoreReviewRecord`、`ScoreReviewGroupMember`、`ScoreReviewMemberInvite`、`ScoreReviewStudentCheck` |
| 文件与签名 | `StoredFile`(SHA256)、`SignatureFile`、`PdfFile` |
| 标签与审计 | `Tag`、`AuditLog` |
| 邮件与设置 | `MailConfig`、`MailTemplate`、`MailLog`、`SystemSetting` |
| 国家奖学金评定 | `NationalScholarshipEvaluation`、`NationalScholarshipCandidate` |

数据库硬化(v2):

- 连接初始化执行 `journal_mode=WAL`、`busy_timeout=5000`、`synchronous=NORMAL`(`core/db.ts`);
- `Score` 增加 `@@index([academicYearId, category])`(排名/汇总高频谓词),原 `@@unique([studentId, academicYearId, category])` 保留;
- 项目不使用 Prisma migrations,schema 变更经 `npm run db:push` 同步;
- `prisma/dev.db` 随仓库分发**干净种子库**(仅默认管理员,业务数据不入库);`prisma/seed.ts` 供空库创建默认管理员。

## 5. 前端架构(packages/frontend)

```text
src/
├── main.tsx             # ReactDOM 挂载入口
├── app/
│   ├── App.tsx          # 27 条 React.lazy 路由 + 16 条旧路径重定向 + NotFound 兜底(Suspense/ErrorBoundary)
│   ├── AppShell.tsx     # 登录与角色门禁、页头、系统徽标(scope=evaluation|declaration|shared)、新手引导横幅(localStorage 记忆)、操作指南入口
│   ├── Sidebar.tsx      # 侧边栏:【综测系统/申报系统/平台】三组分组,按 admin/monitor 过滤
│   └── routes/          # 28 个页面级包装组件(每路由一个文件:AppShell 包裹 features 页面)
├── features/            # 按域切片的页面与逻辑
│   ├── platform/        # LoginForm SystemEntryPage GuidePage AccountsPage MailPage MailTemplatePage AuditLogsPage SettingsPage + useAuth
│   ├── evaluation/      # DashboardContent ScoresPage ScoreEditor useScores StudentsPage ImportPage ExportPage MonitorScoreReviewPage
│   ├── declaration/     # DeclarationReviewsPage NationalScholarshipPage AwardsPage HonorsPage SubmissionsPage TagsPage Checklist
│   └── review/          # ReviewInviteLoginPage ScoreReviewMemberPage
├── components/ui/       # DataPanel Modal ScreenState StatusChip OperationGuide RouteErrorBoundary SignaturePad SignatureUpload
├── lib/
│   ├── api.ts           # fetch 封装:`/api` 基址 + v2 前缀缓存规则(sessionStorage+内存,写操作全清)、401 统一跳登录、Blob 下载
│   ├── auth.ts          # 主/审核双令牌存取(localStorage / sessionStorage)
│   ├── router.tsx       # 自研 History 路由:navigateTo / useCurrentPath / AppLink
│   ├── ws.ts            # WebSocket 客户端(重连与订阅)
│   ├── validation.ts    # 表单校验
│   └── usePageMeta.ts   # 文档标题
└── styles/global.css    # Tailwind 4
```

要点:

- **路由方案**:单入口 SPA(根 `index.html`),`lib/router.tsx` 基于 History API;开发/预览由 Vite SPA fallback 支持深链接,生产由后端 SPA fallback 支持(见 DEPLOYMENT.md)。
- **代码分割**:全部路由 `React.lazy` + Suspense(`ScreenState` 兜底);`vite.config.ts` `manualChunks` 将 node_modules 拆为 `vendor` chunk,业务更新不失效 vendor 缓存。
- **API 缓存**:`lib/api.ts` 内置按路径正则的 GET 缓存(15s~5min,按用户隔离),任何写请求全量失效;规则均匹配 v2 新前缀。
- **重表格性能**:分数编辑网格(`ScoreEditor`)行级 memo。

## 6. 实时通信

后端 `core/ws.ts` 在同一 HTTP 服务上挂 `/ws`:连接以 `?token=` JWT 鉴权,按班级组房间,管理员另有审计频道;30 秒心跳清理死连接。服务层通过 `broadcastToClass` / `broadcastToAdmins` / `broadcastScoreReviewAudit` 推送(如审核成员核对状态 `score-review:log:sync`、审计流 `audit-log:sync`),班长端与管理员端即时刷新;前端 `lib/ws.ts` 负责连接与订阅。

## 7. 安全设计

- JWT 认证(24h),角色三分 admin / monitor / reviewer;路由级门禁(`adminOnly`、`monitorClassCheck`、`reviewerOnly`),monitor 一切操作限本班;
- **生产环境缺 `JWT_SECRET` 拒绝启动**(废除 v1 硬编码 fallback 在生产生效的可能);
- helmet 基线安全头 + 全局限流 600 次/分/IP + 登录限流 20 次/15 分/IP + `trust proxy 1`(适配 cloudflared 单跳);
- 请求体积:JSON 默认 2mb,仅导入前缀 50mb;文件上传走 multer 内存存储;
- 审核成员凭一次性邀请令牌登录,令牌哈希存储并绑定首次访问设备;签名接口对 reviewer 限制用途;
- SMTP 授权码加密存储;关键操作写 `AuditLog`(前后值快照);上传/生成文件经 `StoredFile` 登记 SHA256;
- 错误响应统一 `{ error }`,生产不回传内部 message。

## 8. 性能设计(v2 落地项)

| 层 | 措施 | 位置 |
| --- | --- | --- |
| DB | WAL + busy_timeout + synchronous=NORMAL | `core/db.ts` |
| DB | `Score @@index([academicYearId, category])` | `prisma/schema.prisma` |
| 写路径 | 分数写入+体育总分/总分重算合并单事务;导入先整表读出、一次 `studentNo in (...)` 预取学生 | `scoreService` / `importService` |
| 读路径 | 申报附件 2 汇总:一次 `classId in (...)` 取回学生分数再按班分组排名,替代逐班查询 | `declaration/services/exportService.ts` |
| 读路径 | 热点读取进程内 TTL 缓存(候选/分配/审核状态/系统状态/邮件模板) | `core/cache.ts` + 各服务 |
| HTTP | gzip 压缩、限流、体积限制 | `core/middleware/security.ts` |
| 前端 | 全路由懒加载、vendor 拆包、API 层缓存与请求去重、重表格行 memo | `app/App.tsx`、`vite.config.ts`、`lib/api.ts` |

## 9. 测试与构建

- **测试**:仅后端,`npm test -w packages/backend` = `node --import tsx --test "src/**/*.test.ts"`;23 个测试文件、**76 个用例**,锁定业务规则(评定条件、分数公式、权限语义、国奖四算法)——任何重构必须保持全绿。测试通过 `core/utils/testUtils.ts` 的 `replaceMethod` 打桩 prisma,不触真实库。
- **后端构建**:`tsc` 编译到 `dist/`(ES2022/ESM),`npm run start -w packages/backend` 运行产物;
- **前端构建**:`vite build` 产出 `dist/`(懒加载 chunk + vendor),`vite preview` 本地预览;
- **提交闸门**:后端测试全绿 + 两包 `tsc --noEmit` 0 错 + `vite build` 成功。

## 10. 脚本与工程化

| 位置 | 说明 |
| --- | --- |
| 根 `package.json` | workspaces 聚合:`dev`(concurrently 双端)、`build`、`start:prod`(构建 + 生产单源启动)、`test`、`bench`、`db:generate/push/seed/migrate/studio` |
| `scripts/generate_guides.py` | XeLaTeX 渲染 4 份操作指南 PDF 到 `packages/frontend/public/guides/` |
| `scripts/bench.mjs` | 并发基准压测脚本(用法与实测见 [DEPLOYMENT.md](DEPLOYMENT.md)) |
| `start.bat` / `start-prod.bat` | Windows 一键启动:开发双进程 / 生产单源(检查密钥 → 构建 → 单进程 → cloudflared),见 [DEPLOYMENT.md](DEPLOYMENT.md) |

## 11. 已知约定与注意事项

- **数据边界**:`prisma/dev.db` 仅为干净种子库,业务数据与 `storage/` 运行期文件(签名/PDF)不入库;`docs/reference|samples` 官方文件与样例随 git 保存;`.env` 被忽略,勿提交真实密钥;
- WAL 模式运行期间 `prisma/` 下会出现 `dev.db-wal`、`dev.db-shm` 伴生文件,属正常现象;
- 导出依赖 `packages/backend/templates/` 三份官方模板(`附件2_template.xlsx`、`附件2_院奖荣誉汇总_template.xlsx`、`附件4_template.xlsx`),缺失时接口报错并提示放置路径;
- `DATABASE_URL` 的 `file:` 相对路径相对 `schema.prisma` 所在目录解析;
- 后端为 ESM(`"type": "module"`),相对导入一律带 `.js` 后缀(含 TS 源内);
- 操作指南 PDF 为生成产物,改内容请改 `scripts/generate_guides.py` 后重生成,勿手工编辑;
- 旧 API 前缀与旧前端路径仍可用但已 deprecated,新代码一律使用 v2 前缀(对照见 [API.md](API.md) 与 [CHANGELOG-V2.md](CHANGELOG-V2.md))。
