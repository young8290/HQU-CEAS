# v1 → v2 变更与迁移说明(CHANGELOG-V2)

v2 是一次**行为保持**的全面重构:业务规则(评定条件、分数公式、权限语义、国奖四算法)未变,由 76 个后端测试全程锁定全绿。回滚基线为 `v2-rebuild` 分支快照 `b6eb7a2`(v1 完成态)。

## 变更总表

| 领域 | v1 | v2 | 兼容性 |
| --- | --- | --- | --- |
| API 路由 | 全部平铺在 `/api/*` | 三分命名空间 `/api/platform`、`/api/evaluation`、`/api/declaration` | 旧前缀全量保留为别名(deprecated),响应不变 |
| 前端路由 | 平铺(`/dashboard`、`/monitor/*` 等) | 前缀即系统:`/evaluation/*`、`/declaration/*` + 平台页 | 16 条旧路径客户端自动重定向 |
| 后端结构 | `src/{config,middleware,routes,services,utils,ws}` 平铺 | `src/core/` + `src/modules/{platform,evaluation,declaration}`(routes/services/rules) | 纯文件移动,分层规则不变 |
| 前端结构 | `components/` 17 个目录 + `hooks/` + `routes/` | `app/`(路由表+外壳)+ `features/` 域切片 + `components/ui/` | 纯文件移动 |
| 加载方式 | 全量急加载单 bundle | 全路由 `React.lazy` + vendor 拆包 | 无感知 |
| 数据库 | SQLite 默认配置 | WAL + busy_timeout + synchronous=NORMAL;`Score` 新增复合索引 | 只加索引,不动表结构与数据 |
| 安全 | JWT 密钥有硬编码 fallback;无限流/安全头 | 生产 fail-fast、helmet、限流、体积收紧 | 开发体验不变(dev 缺密钥仅告警) |
| 新手引导 | 无 | `/guide` 角色化指引页 + 首次登录横幅 + 侧边栏三组分组 | 新增 |
| 文档 | README + 2 篇 docs | README + 8 篇 docs(见 [README 文档导航](../README.md#文档导航)) | 全部重写 |

## API 前缀迁移对照(精简)

端点级明细见 [API.md](API.md)。旧路径 = 新路径去掉系统段。

| 旧前缀(deprecated,仍可用) | 新前缀 |
| --- | --- |
| `/api/auth` `/api/users` `/api/grades` `/api/students` `/api/academic-years` `/api/system` `/api/signatures` `/api/pdf-materials` `/api/audit-logs` `/api/mail`(+`/settings` `/templates` `/logs`) | `/api/platform/同名` |
| `/api/scores` `/api/import` `/api/templates` `/api/score-review-groups` `/api/score-review-invites` | `/api/evaluation/同名` |
| `/api/export/attachment2` `/attachment4` `/all` `/failed-records` `/accounts` | `/api/evaluation/export/*` |
| `/api/external-awards` `/api/award-quotas` `/api/class-honors` `/api/awards` `/api/award-declarations` `/api/national-scholarships` `/api/honors` `/api/honor-declarations` `/api/declaration-supplements` `/api/declaration-reviews` `/api/tags` | `/api/declaration/同名` |
| `/api/export/declarations` `/award-allocation` `/honor-declarations` `/declaration-attachment2` `/signature-name-list` `/mail-logs` | `/api/declaration/export/*` |
| `/api/health`(新增 `version`/`uptime` 字段,原字段保留)、`/ws` | 不变 |

实现方式:同一 router 实例在新旧前缀各挂一次(`app.ts`),新旧行为逐字节一致;`/api/export` 旧前缀由综测、申报两个导出 router 依次级联(路径不重叠)。

## 前端旧路径重定向表

旧书签打开会显示"页面地址已更新,正在跳转"并自动 `replace` 到新路径:

| 旧路径 | 新路径 | | 旧路径 | 新路径 |
| --- | --- | --- | --- | --- |
| `/dashboard` | `/evaluation/dashboard` | | `/declaration-reviews` | `/declaration/reviews` |
| `/scores` | `/evaluation/scores` | | `/declaration-import` | `/declaration/import` |
| `/students` | `/evaluation/students` | | `/declaration-export` | `/declaration/export` |
| `/import` | `/evaluation/import` | | `/national-scholarship` | `/declaration/national-scholarship` |
| `/export` | `/evaluation/export` | | `/tags` | `/declaration/tags` |
| `/monitor/dashboard` | `/evaluation/class/dashboard` | | `/monitor/awards` | `/declaration/class/awards` |
| `/monitor/scores` | `/evaluation/class/scores` | | `/monitor/honors` | `/declaration/class/honors` |
| `/monitor/score-review` | `/evaluation/class/review` | | `/monitor/submissions` | `/declaration/class/submissions` |

不变:`/login`、`/entry`、`/settings`、`/accounts`、`/accounts-mail`、`/mail-templates`、`/audit-logs`、`/review-login`、`/review/scores`;新增:`/guide`。

## 性能项(均已落地并可在代码中核对)

| 项 | 内容 | 位置 |
| --- | --- | --- |
| SQLite 硬化 | 连接初始化执行 `journal_mode=WAL`、`busy_timeout=5000`、`synchronous=NORMAL`,并发读写吞吐主开关 | `core/db.ts` |
| 高频索引 | `Score @@index([academicYearId, category])`(排名/汇总谓词),已 db push 落库 | `prisma/schema.prisma` |
| 导入链路 | 整表读出后一次 `studentNo in (...)` 预取学生,替代逐行 `findUnique`;每生分数写入 + 体育总分/总分重算合并为单事务 | `evaluation/services/importService.ts`、`scoreService.ts` |
| 分数写路径 | `updateScore`/`saveScoreBonusDetails` 单事务内复用已载数据,消除写后全量再查询 | `evaluation/services/scoreService.ts` |
| 申报导出 | 附件 2 申报汇总:一次 `classId in (...)` 查询后按班分组排名,替代批次循环逐班 `findMany` | `declaration/services/exportService.ts` |
| HTTP 层 | gzip 压缩(JSON/Excel 收益明显) | `core/middleware/security.ts` |
| 前端加载 | 全路由 `React.lazy` + Suspense;vite `manualChunks` 拆 vendor;首屏只载所需 chunk | `app/App.tsx`、`vite.config.ts` |
| 前端请求 | api 层 GET 缓存规则适配新前缀 + 并发请求去重;分数编辑网格行级 memo | `lib/api.ts`、`features/evaluation/ScoreEditor.tsx` |
| 生产静态服务 | `NODE_ENV=production` 下 Express 单源服务 `frontend/dist`:`/assets` 一年 immutable 缓存、`index.html` no-cache、SPA fallback;新增 `npm run start:prod` 与 `start-prod.bat` | `app.ts`、根 `package.json` |

重构前基线(dev 模式 60 并发):health p50=29ms;`scores/class/11` p50=81ms/p95=118ms;award-candidates p50=34ms;national-scholarships p50=27ms。重构后实测数据与压测脚本用法(`npm run bench` / `scripts/bench.mjs`)见 [DEPLOYMENT.md](DEPLOYMENT.md) 的 bench 章节,不在此处摘抄以免两处失同步。

## 安全项

| 项 | v1 问题 | v2 处理 |
| --- | --- | --- |
| JWT 密钥 | 硬编码 fallback `hqu-ceas-secret-key-2026`,公网可伪造管理员 token(P0) | 生产缺 `JWT_SECRET` **拒绝启动**;开发缺失仅告警并沿用原值(不破坏本地/测试) |
| 登录爆破 | 无限流 | `/api/platform/auth/login` 与旧别名均挂 20 次/15 分钟/IP 严格限流 |
| 滥用防护 | 无 | 全局 `/api` 600 次/分钟/IP;`trust proxy 1` 保证 cloudflared 后读真实 IP |
| 安全头 | 无 | helmet 基线 |
| 请求体积 | JSON 全局 50mb | 默认收紧 2mb,仅导入前缀(`/api/evaluation/import` 及旧别名)保留 50mb |
| 错误泄露 | — | errorHandler 统一 `{ error }`,内部 message 仅开发环境返回 |
| 部署架构 | 公网跑 vite dev server | 生产单源:Express 服务 API+WS+前端产物,cloudflared 只暴露一个源(部署步骤见 DEPLOYMENT.md) |

## 文件树迁移对照

### 后端

| v1 | v2 |
| --- | --- |
| `src/index.ts` | `src/server.ts`(进程入口)+ `src/app.ts`(应用组装) |
| `src/config/index.ts` / `database.ts` | `src/core/config.ts` / `src/core/db.ts` |
| `src/services/cacheService.ts` | `src/core/cache.ts` |
| `src/ws/index.ts` | `src/core/ws.ts` |
| `src/middleware/*` | `src/core/middleware/*`(新增 `security.ts`) |
| `src/utils/*` | `src/core/utils/*`(新增 `excel.ts` 共享导出工具) |
| `src/config/scoreRules.ts` | `src/modules/evaluation/rules/scoreRules.ts` |
| `src/config/{award,honor,declaration,nationalScholarship}Rules*.ts` | `src/modules/declaration/rules/*` |
| `src/routes/*`(29 组) | `src/modules/{platform(13)|evaluation(6)|declaration(12)}/routes/*` |
| `src/services/*` | `src/modules/*/services/*` |
| `src/routes/export.ts` + `src/services/exportService.ts` | 按系统拆分:`evaluation/{routes,services}/export*` + `declaration/{routes,services}/export*` |
| `*.test.ts`(与被测文件同目录) | 随被测文件迁移,共 23 个文件 76 用例(内容不变原则,仅补 `testUtils.replaceMethod` 收敛) |

### 前端

| v1 | v2 |
| --- | --- |
| `src/App.tsx`(急加载路由表) | `src/app/App.tsx`(懒加载 + 重定向表) |
| `src/routes/*`(26 个页面组件) | `src/app/routes/*`(28 个:新增 GuideRoute 等) |
| `src/components/layout/{AppShell,Sidebar}` | `src/app/{AppShell,Sidebar}`(Sidebar 改三组分组) |
| `src/components/<17 个模块目录>` | `src/features/{platform,evaluation,declaration,review}/` 按域切片 |
| `src/components/common/*` | `src/components/ui/*`(Modal 多处实现去重合一) |
| `src/hooks/{useAuth,useScores,usePageMeta}` | `features/platform/useAuth`、`features/evaluation/useScores`、`lib/usePageMeta` |
| — | 新增 `features/platform/GuidePage.tsx`(`/guide`)、AppShell 首次使用引导横幅 |

## 从旧书签 / 旧脚本迁移

**能不改就先不用改**——v2 的兼容层保证旧入口全部可用;但旧路径已标记 deprecated,新收藏、新脚本请一律用新路径。

- **浏览器书签**:旧页面路径自动重定向(见上表),打开后地址栏已是新路径,重新收藏即可。
- **curl / 外部脚本 / 第三方集成**:旧 `/api/*` 前缀行为与响应与 v1 逐字节一致;迁移方法是按 [API.md](API.md) 的换算规则在路径中插入系统段(`platform/`、`evaluation/`、`declaration/`)。注意综测/申报导出都在旧 `/api/export/*` 下,新路径需分别归位到 `/api/evaluation/export/*` 与 `/api/declaration/export/*`。
- **健康检查**:`/api/health` 路径不变,响应新增 `version`、`uptime` 字段,原 `status`/`timestamp` 保留,存量监控无需修改。
- **WebSocket**:`/ws` 路径与协议不变。
- **移除计划**:旧别名与旧路由重定向暂无移除时间表;若未来移除,将提前在本文件公告。

## 已知待办

- 四份操作指南 PDF(`public/guides/`)沿用 v1 生成版本,未按 v2 重新渲染(XeLaTeX 环境依赖);指南中的页面入口描述如与新路径不符,以站内「新手指引」与 [USER_GUIDE.md](USER_GUIDE.md) 为准。
- 更大规模(市级/多学院)的 PostgreSQL 迁移路径在 [DEPLOYMENT.md](DEPLOYMENT.md) 文档化,当前学院规模维持 SQLite(WAL)。
