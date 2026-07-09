# 架构说明

本文档描述 HQU-CEAS(Comprehensive Evaluation & Awards System)的整体架构、模块划分与关键设计。业务流程与评审规则见 [BUSINESS.md](BUSINESS.md)。

## 1. 总览

项目为 npm workspaces 单仓库(monorepo),包含两个工作区:

| 工作区 | 包名 | 职责 |
| --- | --- | --- |
| `packages/backend` | `hqu-ceas-backend` | Express REST API + WebSocket + Prisma/SQLite |
| `packages/frontend` | `hqu-ceas-frontend` | React 19 单页应用,Vite 构建 |

开发模式下前端(3000 端口)通过 Vite 代理把 `/api` 与 `/ws` 转发到后端(4000 端口),见 `packages/frontend/vite.config.ts`。生产/演示环境由 `start.bat` 以开发模式启动两端,并可选启动 Cloudflare Tunnel 暴露公网域名。

```text
浏览器 ──HTTP──▶ Vite (3000) ──proxy /api、/ws──▶ Express (4000)
                                                    ├── Prisma ──▶ prisma/dev.db (SQLite)
                                                    ├── storage/ (签名、PDF 归档)
                                                    ├── templates/ (Excel 导出模板)
                                                    └── SMTP (邮件通知)
```

## 2. 后端架构(packages/backend)

### 2.1 分层结构

```text
src/
├── index.ts          # 应用入口:中间件、路由挂载、WebSocket、监听
├── config/           # 环境配置与业务规则常量
├── middleware/       # 横切关注点
├── routes/           # REST 路由层(参数解析、权限校验入口)
├── services/         # 业务逻辑层(全部业务规则与数据访问)
├── utils/            # 纯函数工具
└── ws/               # WebSocket 服务
```

调用方向固定为 `routes → services → prisma`,路由层不直接访问数据库;服务层单元测试(`*.test.ts`)与被测文件同目录存放,使用 Node.js 内置 `node:test` 运行。

### 2.2 config/ — 配置与业务规则

| 文件 | 内容 |
| --- | --- |
| `index.ts` | 环境变量读取:端口、CORS、JWT 密钥、上传目录 |
| `database.ts` | PrismaClient 单例 |
| `scoreRules.ts` | 综测分数组成定义:各项满分、维护权限(管理员/班长)、计算规则 |
| `awardRules.ts` | 院级奖学金候选条件、等级金额(1000/800/600)、互斥奖项 |
| `honorRules.ts` / `honorRulesInternal.ts` | 优秀学生、优秀学生干部候选条件与推荐名额规则 |
| `declarationRules.ts` | 申报确认项文案与校验规则 |

### 2.3 middleware/

| 文件 | 职责 |
| --- | --- |
| `auth.ts` | JWT 解析与角色校验(admin / monitor / reviewer),路由级权限控制 |
| `errorHandler.ts` | 统一错误响应格式 |

### 2.4 routes/ — 29 组 REST 路由

按业务域挂载在 `/api` 前缀下(完整前缀-模块对照表见 README):

- **基础数据**:`auth`、`users`、`grades`、`students`、`academicYears`、`systemSettings`
- **综测**:`scores`、`import`、`export`、`templates`
- **申报数据**:`externalAwards`、`awardQuotas`、`classHonors`、`declarationSupplements`
- **申报流程**:`awards`、`awardDeclarations`、`honors`、`honorDeclarations`、`declarationReviews`
- **综测审核**:`scoreReviewGroups`、`scoreReviewInvites`
- **文件**:`signatures`、`pdfMaterials`
- **支撑**:`tags`、`auditLogs`、`mail`、`mailSettings`、`mailTemplates`、`mailLogs`

学生批量导入路由(`POST /api/students/batch*`)在入口处包了一层 multer(内存存储)处理文件上传。

### 2.5 services/ — 30 个业务服务

| 业务域 | 服务 |
| --- | --- |
| 组织与账号 | `userService`、`studentService`、`academicYearService`、`authService`、`systemSettingService` |
| 综测分数 | `scoreService`(分数与加分明细)、`calculation`(见 utils)、`templateService`(生成个人综测填写表等下载模板) |
| 导入 | `importService`(学业/体育成绩)、`classHonorImportService`、`externalAwardImportService` |
| 导出 | `exportService`(附件 2 / 附件 4 / 申报汇总,基于 `templates/` 官方模板 + ExcelJS + Archiver 打包) |
| 奖学金申报 | `awardService`、`awardAllocationService`(院奖分配预览)、`awardQuotaService`、`awardDeclarationService` |
| 荣誉称号申报 | `honorService`、`honorDeclarationService`、`declarationSupplementService`、`declarationReviewService` |
| 综测审核 | `scoreReviewGroupService`、`scoreReviewInviteService`(邀请令牌哈希 + 设备绑定) |
| 文件与签名 | `fileStorageService`(SHA256 去重校验)、`signatureService`、`pdfService`(生成协议/确认书 PDF) |
| 邮件 | `mailConfigService`(SMTP 配置,密码加密存储)、`mailService`、`mailTemplateService` |
| 支撑 | `auditService`(前后值快照)、`tagService`、`cacheService`(高频读取缓存) |

### 2.6 数据模型(prisma/schema.prisma,29 个模型)

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

数据库文件与 schema 同目录:

- `prisma/dev.db` — 当前使用的 SQLite 数据库(私有仓库,随 git 保存);
- `prisma/archive/comprehensive-eval-legacy.db` — 2026-02 旧版数据库归档(早期结构,仅备查,确认无用后可删除);
- `prisma/seed.ts` — 空库种子数据,创建默认管理员 `admin / admin123`。

项目未使用 Prisma migrations,schema 变更通过 `npm run db:push` 同步。

### 2.7 运行期文件

```text
storage/
├── pdf/YYYY/MM/…           # 生成的协议、确认书 PDF
└── signatures/YYYY/MM/…    # 签名图片(原图/裁剪图)

templates/
├── 附件2_template.xlsx               # 综测成绩汇总表模板
├── 附件2_院奖荣誉汇总_template.xlsx   # 申报汇总表模板
└── 附件4_template.xlsx               # 综测简表模板
```

`exportService` 通过 `TEMPLATE_DIR = <backend 包根>/templates` 定位模板;storage 中的文件在数据库 `StoredFile` 表中登记 SHA256 与路径。

## 3. 前端架构(packages/frontend)

### 3.1 结构

```text
src/
├── main.tsx            # ReactDOM 挂载入口
├── App.tsx             # 路由表:path → 页面组件映射
├── routes/             # 26 个页面级组件(每个路由一个文件)
├── components/         # 业务组件,按模块分 17 个目录
│   ├── layout/         # AppShell、Sidebar(导航与角色区分)
│   ├── common/         # DataPanel、ScreenState、StatusChip、OperationGuide、RouteErrorBoundary
│   ├── auth/ scores/ students/ import/ export/ accounts/
│   ├── awards/ honors/ declarations/ signature/
│   └── dashboard/ mail/ settings/ tags/ audit/
├── hooks/              # useAuth(登录态)、usePageMeta(标题)、useScores
├── lib/                # 基础设施
│   ├── api.ts          # REST 客户端(fetch 封装、下载)
│   ├── auth.ts         # 令牌存取
│   ├── router.tsx      # 自研 history 路由:navigateTo / useCurrentPath / AppLink
│   ├── validation.ts   # 表单校验
│   └── ws.ts           # WebSocket 客户端(实时同步)
└── styles/global.css   # Tailwind 4 全局样式
```

### 3.2 路由方案

前端为**单入口 SPA**:唯一 HTML 入口是根目录 `index.html`,`App.tsx` 内的路由表把路径映射到 `routes/` 下的页面组件,未匹配路径渲染 `NotFoundRoute`。

路由实现(`lib/router.tsx`)基于 History API:`navigateTo()` 执行 `pushState/replaceState` 并广播自定义事件,`useCurrentPath()` 监听 `popstate` 与该事件驱动重渲染,`AppLink` 组件拦截左键单击做客户端导航。开发与预览环境由 Vite 的 SPA fallback 支持深链接直达。

> 历史说明:早期版本在 `packages/frontend/` 下为每个路径放置了一份入口 HTML(`login/`、`dashboard/` 等目录)供静态托管使用,现路由已完全由根入口接管,这些目录已删除。

### 3.3 静态资源(public/)

| 资源 | 说明 |
| --- | --- |
| `college-logo.png` / `academic-dept-logo.png` | 学院与学术部 logo(登录页、侧边栏引用) |
| `fonts/clashdisplay/` | ClashDisplay 可变字体 |
| `guides/*.pdf` | 四份操作指南(综测/申报 × 管理员/班长),由 `scripts/generate_guides.py` 生成 |
| `favicon.svg` | 站点图标 |

## 4. 实时通信

后端 `src/ws/index.ts` 在同一 HTTP 服务上挂载 `/ws` WebSocket 端点;审核成员核对状态、签名进度等变更事件推送到班长端页面即时刷新。前端 `lib/ws.ts` 负责连接与订阅。

## 5. 脚本与工程化

| 位置 | 说明 |
| --- | --- |
| `scripts/generate_guides.py` | 以 XeLaTeX 渲染四份操作指南 PDF 输出到前端 `public/guides/`;构建缓存目录 `scripts/.guide-build/` 已被 git 忽略 |
| `start.bat` | Windows 一键启动:清端口 → 起后端 → 起前端 → 起 cloudflared 隧道(日志写入 `.logs/cloudflared.log`) |
| 根 `package.json` | workspaces 聚合脚本:`dev` / `build` / `test` / `db:*` |

## 6. 测试与构建

- **测试**:仅后端有自动化测试,`npm test -w packages/backend` 使用 `node --import tsx --test` 运行 `src/**/*.test.ts`(45 个用例,覆盖服务层与规则配置)。
- **后端构建**:`tsc` 按 `tsconfig.json` 编译到 `dist/`,`npm run start -w packages/backend` 运行编译产物。
- **前端构建**:`vite build` 产出 `dist/`(单入口),`vite preview` 本地预览。

## 7. 安全设计要点

- JWT 认证,角色三分(admin / monitor / reviewer),路由级权限校验;
- 审核成员通过一次性邀请令牌登录,令牌哈希存储并绑定首次访问设备;
- SMTP 授权码加密存储(`MailConfig`);
- 关键操作写入 `AuditLog`,记录操作前后值快照;
- 上传与生成文件统一经 `StoredFile` 登记 SHA256,防篡改可校验。

## 8. 已知约定与注意事项

- 仓库为**私有仓库**:`prisma/dev.db`、`storage/` 运行期文件、`docs/reference|samples` 官方资料随 git 保存;`.env` 仍被忽略,勿提交真实密钥。
- 后端导出功能依赖 `packages/backend/templates/` 三个官方模板文件,缺失时接口报错并提示放置路径。
- `DATABASE_URL` 中的 `file:` 相对路径相对于 `schema.prisma` 所在目录解析。
- 操作指南 PDF 为生成产物,修改内容请改 `scripts/generate_guides.py` 后重新生成,不要手工编辑 PDF。
