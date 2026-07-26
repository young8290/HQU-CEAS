# 开发指南(DEVELOPMENT)

面向要改代码的人:目录约定、如何新增一个模块、测试怎么跑怎么写、脚本与代码风格。架构总览见 [ARCHITECTURE.md](ARCHITECTURE.md),端点对照见 [API.md](API.md)。

## 环境与常用脚本

Node.js 18+、npm 9+。跑通:`npm install && npm run db:generate && npm run dev`(详见 [QUICKSTART.md](QUICKSTART.md#维护者10-分钟跑起来))。

| 命令(根目录) | 说明 |
| --- | --- |
| `npm run dev` | concurrently 同启后端(4000,tsx watch)与前端(3000,vite) |
| `npm run dev:backend` / `npm run dev:frontend` | 单独启动一端 |
| `npm run build` | 后端 `tsc` → `dist/`;前端 `vite build` → `dist/` |
| `npm run start:prod` | 构建两包并以 `NODE_ENV=production` 单源启动(部署细节见 [DEPLOYMENT.md](DEPLOYMENT.md)) |
| `npm test` | 后端全部测试(node:test,76 用例) |
| `npm run bench` | 并发基准压测(`scripts/bench.mjs`,用法见 DEPLOYMENT.md) |
| `npm run db:generate` | 生成 Prisma Client(改 schema 或首次克隆后执行) |
| `npm run db:push` | schema 同步到 SQLite(本项目不用 migrations;动真库前先备份 `dev.db`) |
| `npm run db:seed` | 空库种子(默认管理员 `admin/admin123`) |
| `npm run db:studio` | Prisma Studio 可视化 |

| 命令(包内) | 说明 |
| --- | --- |
| `npm run start -w packages/backend` | 运行后端编译产物 `dist/server.js` |
| `npm run preview -w packages/frontend` | 预览前端构建产物(3000) |
| `npx tsc --noEmit`(在两包目录各跑一次) | 类型检查,提交闸门之一 |

**提交前自查(闸门)**:`npm test -w packages/backend` 全绿 + 两包 `tsc --noEmit` 0 错 + `vite build` 成功。76 个测试锁定业务规则(评定条件、分数公式、权限语义、国奖四算法),红了先修代码或修对测试认知,不许绕过。

## 目录约定

### 后端 `packages/backend/src/`

| 位置 | 放什么 | 不放什么 |
| --- | --- | --- |
| `core/` | 与具体业务无关的基础设施:config、db、cache、ws、middleware、纯工具 | 任何业务规则 |
| `modules/<system>/routes/` | 参数解析 + 权限门禁 + 调服务;每个文件导出一个 `Router` | 业务逻辑、直接 prisma 访问 |
| `modules/<system>/services/` | 全部业务逻辑与数据访问(prisma 只在这一层出现) | Express 类型(保持可单测) |
| `modules/<system>/rules/` | 规则常量与纯函数(候选条件、金额、算法),可独立单测 | IO、prisma |
| `*.test.ts` | 与被测文件同目录 | 单独的 tests/ 目录 |

`<system>` 三选一:`platform`(平台共用)、`evaluation`(综测)、`declaration`(申报)。判断标准:该功能属于哪个系统的业务闭环;两个系统都用的横切能力(账号、签名、PDF、邮件、审计)进 `platform`。

调用方向固定:`routes → services → prisma`;服务间可以横向调用(如 declaration 服务调 platform 的 `academicYearService`),但**路由不得跨层**。

### 前端 `packages/frontend/src/`

| 位置 | 放什么 |
| --- | --- |
| `app/` | 路由表(App.tsx)、外壳(AppShell)、侧边栏(Sidebar)、`routes/` 页面包装(AppShell + feature 页面,每路由一个文件) |
| `features/<domain>/` | 页面组件与领域逻辑,按 `platform / evaluation / declaration / review` 切片 |
| `components/ui/` | 跨域纯 UI 组件(DataPanel、Modal、ScreenState、StatusChip 等) |
| `lib/` | api 客户端、auth、router、ws、validation、usePageMeta |

## 如何新增一个后端模块(四件套)

以在申报系统加 `foo` 资源为例:

1. **规则**(可选):`modules/declaration/rules/fooRules.ts` — 纯函数与常量,零依赖。
2. **服务**:`modules/declaration/services/fooService.ts` — `import prisma from '../../../core/db.js'`,实现业务;需要时调 `recordAuditLog` / `cacheService` / WS 广播(见下文调用点)。
3. **路由**:`modules/declaration/routes/foo.ts` — 模板:

   ```ts
   import { Router, Request, Response } from 'express';
   import { authMiddleware, adminOnly } from '../../../core/middleware/auth.js';
   import * as fooService from '../services/fooService.js';

   const router = Router();
   router.use(authMiddleware);            // 门禁:adminOnly / monitorClassCheck / reviewerOnly 按需
   router.get('/', adminOnly, async (req: Request, res: Response) => {
     try {
       res.json(await fooService.listFoo());
     } catch (err: any) {
       res.status(400).json({ error: err.message });   // 业务错误统一 400 + { error }
     }
   });
   export default router;
   ```

4. **测试**:`modules/declaration/services/fooService.test.ts`(写法见下节)。
5. **挂载**:在 `src/app.ts` 对应系统分区 `app.use('/api/declaration/foo', fooRoutes)`。**新资源不再增加旧别名**(别名只为 v1 存量路径保留)。
6. 前端接入:`features/declaration/FooPage.tsx` → `app/routes/FooRoute.tsx`(AppShell 包裹,`scope="declaration"`)→ `App.tsx` 加 lazy 路由 → `Sidebar.tsx` 对应分组加菜单(带 `adminOnly`/`monitorOnly` 标记)→ 调用走 `api.get('/declaration/foo')`(`lib/api.ts` 自动拼 `/api` 基址)。

数据模型变更:改 `prisma/schema.prisma` → `npm run db:generate` → `npm run db:push`(生产/含业务数据的库 push 前务必先备份;倾向只加不删)。

## 测试:怎么跑、怎么写

- 运行:`npm test -w packages/backend`(= `node --import tsx --test "src/**/*.test.ts"`);单文件:`node --import tsx --test src/modules/evaluation/services/scoreService.test.ts`(在 backend 包目录执行)。
- 框架:Node 内置 `node:test` + `node:assert/strict`,无第三方测试依赖。
- **不触真实数据库**:用 `core/utils/testUtils.ts` 的 `replaceMethod` 打桩 prisma 模型方法,结束时恢复;`core/db.ts` 在测试子进程(`NODE_TEST_CONTEXT`)下自动跳过 PRAGMA。真实风格示例(节选自 `scoreService.test.ts`):

  ```ts
  import test from 'node:test';
  import assert from 'node:assert/strict';
  import prisma from '../../../core/db.js';
  import { getScoresByClass } from './scoreService.js';
  import { replaceMethod } from '../../../core/utils/testUtils.js';

  test('getScoresByClass returns bonus details with score cells', async () => {
    const restore = replaceMethod(prisma.student, 'findMany', async () => [/* 桩数据 */]);
    try {
      const result = await getScoresByClass(12, 2025);
      assert.equal(result[0].details?.sports_reward?.[0].itemScore, 1.5);
    } finally {
      restore();   // 必须恢复,避免污染同进程其它用例
    }
  });
  ```

- 事务打桩惯例:`replaceMethod(prisma, '$transaction', async (handler: any) => handler(prisma))`(回调式)或 `async (ops) => Promise.all(ops)`(数组式)。
- 规则纯函数(`rules/`)直接断言输入输出,无需打桩。
- 写什么:优先覆盖业务规则与边界(条件判定、金额上限、权限语义、解析容错),不为覆盖率写测试。

## 代码风格要点

- **ESM + `.js` 后缀**:后端为 `"type": "module"`,所有相对导入必须带 `.js` 后缀(TS 源里也是,如 `from './scoreService.js'`),否则构建产物在 Node 下解析失败。
- **错误处理约定**:服务层直接 `throw new Error('中文用户可读信息')`;路由层 try/catch 返回 `400 { error: err.message }`;未捕获的交给 `core/middleware/errorHandler.ts` 统一 `500 { error: '服务器内部错误' }`(message 仅开发环境透出)。不要在服务层拼 HTTP 状态码。
- **审计调用点**:改写关键业务数据后调 `recordAuditLog`(`modules/platform/services/auditService.ts`),记录模块、动作与前后值快照。
- **缓存调用点**:热点读取用 `cacheService.memo(namespace, key, ttlMs, loader)`(`core/cache.ts`);对应写路径**必须** `invalidate`/`invalidatePrefix` 同 namespace,否则读到旧数据。现有 namespace 如 `awardCandidates`、`awardAllocation`、`honorCandidates`、`scoreReviewStatus`、`systemStatus`、`mailTemplate`。
- **WS 调用点**:需要实时同步的变更,在服务层调 `core/ws.js` 的 `broadcastToClass(classId, message)` / `broadcastToAdmins(message)` / `broadcastScoreReviewAudit(classId, audit)`;消息带 `type` 字段(如 `score-review:log:sync`)。
- **权限门禁**:统一用 `core/middleware/auth.js` 的四件(`authMiddleware`/`adminOnly`/`monitorClassCheck`/`reviewerOnly`);`monitorClassCheck` 从 `params.classId` 或 `body.classId` 取班级,admin 自动放行。更细粒度(分项编辑权、材料归属)放服务层。
- **前端**:新页面必须走 `React.lazy` 路由表;导航用 `AppLink`/`navigateTo`(禁止裸 `<a>` 内链);请求一律经 `lib/api.ts`(自动带 token、401 跳登录、GET 缓存);新增可缓存 GET 时在 `CACHE_RULES` 补规则(用 v2 前缀)。
- **路径与命名**:新 API 一律挂 v2 前缀;旧别名与旧路由重定向是兼容层,不接受新增。
- 文案:面向用户的错误与提示用中文;代码注释解释"为什么",关键决策标注 PLAN/文档出处。

## 杂项

- 导出功能依赖 `packages/backend/templates/` 三份官方模板,本地缺失时相关接口会报错并提示放置路径。
- 操作指南 PDF:改 `scripts/generate_guides.py`(需 XeLaTeX)后重新生成,勿手工编辑 `public/guides/*.pdf`。
- 部署、公网、性能压测与容量边界:见 [DEPLOYMENT.md](DEPLOYMENT.md)。
