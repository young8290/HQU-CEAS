# HQU CS 综测与申报系统

> 华侨大学计算机科学与技术学院学生素质综合测评填写、奖学金申报和荣誉称号申报系统。
> 基于 B/S 架构的全栈 Web 应用，支持实时分数编辑、Excel 批量导入导出、班级申报、签名归档、PDF 材料、操作日志和邮件发送记录。

---

## 目录

- [快速开始](#快速开始)
- [系统架构](#系统架构)
- [角色与权限](#角色与权限)
- [功能说明](#功能说明)
- [评分规则](#评分规则)
- [API 接口](#api-接口)
- [项目结构](#项目结构)
- [常见问题](#常见问题)

---

## 快速开始

### 环境要求

- **Node.js** ≥ 18
- **npm** ≥ 9

### 安装与启动

```bash
# 1. 安装全部依赖
npm install

# 2. 初始化数据库 & 创建默认管理员
npm run db:push
npm run db:seed

# 3. 一键启动前后端
npm run dev
```

启动后访问：

| 服务 | 地址 |
|------|------|
| **前端** | http://localhost:3000 |
| **后端 API** | http://localhost:4000 |

### 默认管理员账号

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123` |

> 首次登录后请在「系统设置」中修改默认密码

### 常用命令

```bash
npm run dev              # 同时启动前后端
npm run dev:backend      # 仅启动后端
npm run dev:frontend     # 仅启动前端
npm run build            # 构建后端和前端生产版本
npm test                 # 运行后端测试
npm run db:push          # 同步 schema 到数据库
npm run db:seed          # 写入种子数据
npm run db:generate      # 生成 Prisma Client
npm run db:studio        # 打开 Prisma Studio
```

---

## 系统架构

```
浏览器 (Vite + React + Tailwind CSS)
    │
    ├── HTTP REST API ──► Express 后端 (Port 4000)
    │                         │
    └── WebSocket ──────► ws 实时通信
                              │
                         Prisma ORM
                              │
                         SQLite 数据库
```

| 层 | 技术 |
|----|------|
| 前端框架 | Vite 7 + React 19 |
| UI 样式 | Tailwind CSS 4 |
| 前端缓存 | 内存 + `sessionStorage` TTL 缓存（年级、班级、学生、导入日志、系统入口、候选名单等查询） |
| 后端框架 | Express + TypeScript |
| 数据库 | SQLite (Prisma ORM) |
| 认证 | JWT + bcrypt |
| 实时通信 | WebSocket (ws) |
| 文件处理 | ExcelJS + 本地受控文件目录 |

---

## 角色与权限

| 功能 | 管理员 | 班长 |
|------|:------:|:----:|
| 编辑学生分数 | 允许全部班级 | 允许本班 |
| 编辑学业成绩/体育基础分 | 允许 | 禁止 |
| 管理年级/班级/学生 | 允许 | 禁止 |
| 导入学业成绩/体育基础分 | 允许，按学号匹配 | 禁止 |
| 导入个人综测表 | 允许 | 允许本班 |
| 导出附件2 | 允许 | 允许本班 |
| 导出附件4/ZIP/账号 | 允许 | 禁止 |
| 管理班长账号 | 允许 | 禁止 |
| 管理学年 | 允许 | 禁止 |
| 修改自己密码 | 允许 | 允许 |
| 管理系统开放状态 | 允许 | 禁止 |
| 导入国奖、国励、校奖等外部名单 | 允许 | 禁止 |
| 导入院奖名额金额、先进班级名单、班长邮箱 | 允许 | 禁止 |
| 奖学金与荣誉称号班级申报 | 查看和审核 | 提交本班申报 |
| 综测审核小组签名 | 配置成员 | 采集本班签名 |
| 审核申报、退回、通过 | 允许 | 禁止 |
| 管理邮件配置、邮件模板和发送记录 | 允许 | 禁止 |
| 查看操作日志和标签 | 允许 | 禁止 |

---

## 功能说明

### 系统入口

登录后进入系统入口页，分别展示综合素质测评填写系统和奖学金与荣誉称号申报系统。管理员可在系统设置中控制开放状态；班长进入关闭系统时会看到关闭说明。

### 分数编辑（核心功能）

选择年级 → 班级，进入编辑表格。修改通过 **WebSocket 实时保存**（300ms 防抖），多人同时编辑自动同步。

- 白色输入框 = 可编辑字段
- 灰色字段 = 自动计算（体育总分、总分）
- 管理员可导入或维护学业成绩、体测成绩、体育课成绩、体育基础分和社区表现分

### 数据导入

| 类型 | 权限 | Excel 列 | 计算公式 |
|------|------|---------|---------|
| 学业成绩 | 管理员 | A=学号, F=绩点 | 学业分 = (GPA + 2.5) × 8 |
| 体测与体育课成绩 | 管理员 | A=学号, B=姓名, C=体测, D=体育课, E=年级阶段, F=社区表现分 | 大一大二体育基础分 = 0.7 × 体测 + 0.3 × 体育课；大三按体测成绩 |
| 个人综测表 | 管理员/班长 | 按学校模板，每 sheet 一个学生 | — |
| 外部奖项名单 | 管理员 | 学号、姓名、奖项名称、奖项等级 | 国奖、国励、校奖等仅保存名单和标签 |
| 院奖名额金额 | 管理员 | 年级、班级、名额、可支配金额、备注 | 用于院级奖学金分配校验 |
| 先进班级名单 | 管理员 | 年级、班级、荣誉类型 | 用于荣誉称号条件判断 |
| 班长邮箱 | 管理员 | 年级、班级、班长姓名、邮箱 | 关联班长账号邮件地址 |

- 学业、体测、体育课和社区表现分按学号匹配学生。
- 个人综测表需选择目标班级。
- 导入页提供外部奖项、院奖名额金额、先进班级名单、班长邮箱和综测扩展数据模板下载。

### 数据导出

| 导出项 | 文件命名 | 权限 |
|--------|---------|------|
| 附件2（综测成绩汇总表） | `{年级}{班级}附件2.xlsx` | 管理员/班长 |
| 附件4（学年总评表） | `{年级}{班级}附件4.xlsx` | 管理员 |
| 批量导出 ZIP | `{年级}全部附件.zip` | 管理员 |
| 导入失败记录 | `导入失败记录.xlsx` | 管理员 |
| 账号列表 | `账号列表.xlsx` | 管理员 |
| 申报汇总 | `申报汇总.xlsx` | 管理员 |
| 院奖分配 | `院奖分配.xlsx` | 管理员 |
| 荣誉称号申报表 | `荣誉称号申报表.xlsx` | 管理员 |
| 邮件发送记录 | `邮件发送记录.xlsx` | 管理员 |

### 奖学金申报

班长在奖学金申报页查看候选名单和院奖分配预览。系统按综测、学业排名、德育分、体测成绩、社区表现分、互斥标签、名额和金额规则进行自动校验。

班长完成确认项、保存签名并提交后，系统生成班长确认协议 PDF 并关联申报批次。管理员在申报审核页查看学生明细、确认项、协议 PDF 和状态，并执行退回修改或确认通过。

### 荣誉称号申报

班长在荣誉称号申报页选择称号类型，查看校级优秀学生、院级优秀学生、校级优秀学生干部和院级优秀学生干部候选结果。干部类称号支持填写材料说明。

荣誉称号申报同样需要班长确认项、签名和确认协议 PDF。管理员审核通过后，系统写入申报标签。

### 综测审核小组签名

综测审核小组签名只在本班综测页面处理。管理员配置审核小组成员后，班长可采集手写签名或上传电子签名图片。全部成员完成签名后，系统生成综测评审确认书 PDF。

### 邮件与日志

管理员可配置学术部网易邮箱 SMTP、授权码、发件人显示名和启用状态。邮件模板支持班长账号通知、密码重置通知、申报开放通知和审核退回通知。

系统记录学生资料、分数、导入导出、账号、申报、审核、签名、PDF、邮件和系统设置等关键操作。管理员可在操作日志页按模块和动作查询。

### 学生管理（管理员）

- 创建/删除年级和班级
- 添加/删除学生
- 批量导入学生：Excel 格式 A=年级, B=班级, C=学号, D=姓名

### 账号管理（管理员）

- 按年级批量生成班长账号（用户名 `monitor_{年级}_{班级}`, 随机密码）
- 重置密码、删除账号、导出账号列表
- 导入或手动维护班长邮箱
- 批量生成班长账号后可发送账号通知邮件

---

## 评分规则

| 维度 | 上限 | 编辑权限 | 说明 |
|------|:----:|---------|------|
| 德育测评 | 100 | 管理员/班长 | 手动填写 |
| 学业学术素质 | 60 | 仅管理员 | 通过导入写入 |
| 创新与实践能力 | 13 | 管理员/班长 | 手动填写 |
| 体育基础分 | — | 仅管理员 | 通过导入写入 |
| 体测成绩 | 100 | 仅管理员 | 通过导入写入 |
| 体育课成绩 | 100 | 仅管理员 | 通过导入写入 |
| 体育奖励分 | 3 | 管理员/班长 | 手动填写 |
| 体育总分 | 7 | 自动计算 | = 基础分 + 奖励分 |
| 美育 | 6 | 管理员/班长 | 手动填写 |
| 劳动教育 | 4 | 管理员/班长 | 手动填写 |
| 公益服务 | 10 | 管理员/班长 | 手动填写 |
| 社区表现分 | 100 | 仅管理员 | 通过导入写入，参与申报条件筛选 |
| 附加分 | 5 | 管理员/班长 | 手动填写 |
| 总分 | — | 自动计算 | 所有维度之和（不含德育单独参考） |

```
总分 = 学业 + 创新 + 体育总分 + 美育 + 劳动 + 公益服务 + 附加分
```

---

## API 接口

所有 API 以 `/api` 为前缀，需携带 `Authorization: Bearer <token>`。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户信息 |
| PUT | `/api/auth/password` | 修改密码 |

### 系统入口与设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/system/entry-status` | 获取综测系统和申报系统开放状态 |
| GET | `/api/system/settings` | 获取系统设置 |
| PUT | `/api/system/settings` | 保存系统开放状态 |

### 年级 & 班级 & 学生

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/grades` | 年级列表 |
| POST | `/api/grades` | 创建年级 |
| GET | `/api/grades/:id/classes` | 班级列表 |
| POST | `/api/grades/:id/classes` | 创建班级 |
| GET | `/api/students?classId=` | 学生列表 |
| POST | `/api/students/batch/:classId` | 批量导入学生 |
| GET | `/api/users` | 账号列表 |
| POST | `/api/users/generate-monitors/:gradeId?` | 批量生成班长账号 |
| PUT | `/api/users/:id/email` | 保存班长邮箱 |
| POST | `/api/users/monitor-emails/import` | 导入班长邮箱 |
| POST | `/api/users/:id/reset-password` | 重置密码 |

### 分数

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/scores/class/:classId` | 班级成绩 |
| PUT | `/api/scores` | 更新分数 |

### 导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/academic` | 导入学业成绩（全局匹配） |
| POST | `/api/import/sports` | 导入体育基础分（全局匹配） |
| POST | `/api/import/personal/:classId` | 导入个人综测表 |
| GET | `/api/templates` | 获取模板列表 |
| GET | `/api/templates/:type/download` | 下载模板 |
| POST | `/api/external-awards/import` | 导入外部奖项名单 |
| POST | `/api/award-quotas/import` | 导入院奖名额金额 |
| POST | `/api/class-honors/import` | 导入先进班级和团支部名单 |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/attachment2/:classId` | 导出附件2 |
| GET | `/api/export/attachment4/:classId` | 导出附件4 |
| GET | `/api/export/all/:gradeId` | 批量导出 ZIP |
| GET | `/api/export/failed-records` | 导出失败记录 |
| GET | `/api/export/accounts` | 导出账号列表 |
| GET | `/api/export/declarations` | 导出申报汇总 |
| GET | `/api/export/award-allocation` | 导出院奖分配 |
| GET | `/api/export/honor-declarations` | 导出荣誉称号申报表 |
| GET | `/api/export/mail-logs` | 导出邮件发送记录 |

### 奖学金、荣誉称号与申报审核

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/awards/candidates/:classId` | 获取奖学金候选名单 |
| GET | `/api/awards/allocation/:classId` | 获取院奖分配预览 |
| POST | `/api/awards/allocation/preview` | 预览院奖分配方案 |
| GET | `/api/award-declarations/class/:classId` | 获取本班奖学金申报 |
| POST | `/api/award-declarations` | 提交奖学金申报 |
| GET | `/api/honors/candidates/:classId` | 获取荣誉称号候选名单 |
| GET | `/api/honor-declarations/class/:classId` | 获取本班荣誉称号申报 |
| POST | `/api/honor-declarations` | 提交荣誉称号申报 |
| GET | `/api/declaration-reviews` | 获取申报审核列表 |
| GET | `/api/declaration-reviews/:id` | 获取申报审核详情 |
| POST | `/api/declaration-reviews/:id/return` | 退回申报 |
| POST | `/api/declaration-reviews/:id/approve` | 通过申报 |

### 签名、PDF、标签、日志和邮件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/score-review-groups/:classId` | 获取综测审核小组记录 |
| PUT | `/api/score-review-groups/:classId/members` | 配置综测审核小组成员 |
| POST | `/api/score-review-groups/:classId/signatures` | 保存审核小组成员签名 |
| GET | `/api/score-review-groups/:classId/status` | 获取综测评审状态 |
| POST | `/api/signatures` | 保存手写签名或电子签名 |
| GET | `/api/signatures/:id` | 查询签名记录 |
| POST | `/api/pdf-materials/generate` | 生成 PDF 材料 |
| GET | `/api/pdf-materials/:id` | 查询 PDF 记录 |
| GET | `/api/pdf-materials/:id/download` | 下载 PDF 文件 |
| GET | `/api/tags` | 查询标签 |
| GET | `/api/audit-logs` | 查询操作日志 |
| GET | `/api/mail/settings` | 获取邮件配置 |
| PUT | `/api/mail/settings` | 保存邮件配置 |
| POST | `/api/mail/settings/test` | 发送测试邮件记录 |
| GET | `/api/mail/templates` | 获取邮件模板 |
| PUT | `/api/mail/templates/:id` | 保存邮件模板 |
| POST | `/api/mail/send-monitor-accounts` | 发送班长账号邮件 |
| GET | `/api/mail/logs` | 查询邮件发送记录 |
| POST | `/api/mail/logs/:id/retry` | 重发失败邮件 |

### WebSocket

连接：`ws://localhost:4000/ws?token=<JWT>`

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `join:class` | 客户端到服务端 | 加入班级房间 |
| `score:update` | 客户端到服务端 | 提交分数修改 |
| `score:confirmed` | 服务端到客户端 | 保存确认 |
| `score:updated` | 服务端广播 | 分数更新通知 |

---

## 项目结构

```
.
├── package.json                    # 根配置 (npm workspaces)
├── README.md
├── templates/                      # 导出 Excel 模板 (附件2/附件4)
│
└── packages/
    ├── backend/                    # Express + TypeScript 后端
    │   ├── prisma/
    │   │   ├── schema.prisma       # 数据库模型
    │   │   ├── seed.ts             # 种子数据
    │   │   └── dev.db              # 默认 SQLite 数据库文件
    │   └── src/
    │       ├── index.ts            # 入口
    │       ├── config/             # 评分规则、奖学金规则、荣誉称号规则、申报确认项
    │       ├── middleware/         # 认证、权限中间件
    │       ├── routes/             # API 路由
    │       ├── services/           # 业务逻辑 (导入/导出/分数/申报/签名/PDF/邮件/日志)
    │       ├── utils/              # 计算公式
    │       └── ws/                 # WebSocket 服务
    │
    ├── frontend/                   # Vite + React 前端
    │   ├── accounts/               # 静态路由入口
    │   ├── dashboard/              # 静态路由入口
    │   ├── export/                 # 静态路由入口
    │   ├── import/                 # 静态路由入口
    │   ├── login/                  # 静态路由入口
    │   ├── scores/                 # 静态路由入口
    │   ├── settings/               # 静态路由入口
    │   ├── students/               # 静态路由入口
    │   ├── 404.html                # 404 入口
    │   ├── public/                 # 静态资源 (字体、logo)
    │   ├── index.html              # 根入口
    │   ├── vite.config.ts          # 前端构建与代理配置
    │   └── src/
    │       ├── components/         # React 组件
    │       │   ├── auth/           # 登录
    │       │   ├── common/         # 加载态、通用 UI
    │       │   ├── layout/         # 侧边栏
    │       │   ├── dashboard/      # 仪表盘
    │       │   ├── scores/         # 分数编辑
    │       │   ├── students/       # 学生管理
    │       │   ├── import/         # 数据导入
    │       │   ├── export/         # 数据导出
    │       │   ├── accounts/       # 账号管理
    │       │   ├── awards/         # 奖学金申报
    │       │   ├── honors/         # 荣誉称号申报
    │       │   ├── declarations/   # 申报审核和提交记录
    │       │   ├── signature/      # 手写签名和电子签名上传
    │       │   ├── mail/           # 邮箱配置和邮件模板
    │       │   ├── audit/          # 操作日志
    │       │   ├── tags/           # 标签查询
    │       │   └── settings/       # 系统设置
    │       ├── hooks/              # useAuth, useScores
    │       ├── lib/                # API、认证、WebSocket、路由工具
    │       ├── routes/             # 页面路由组件
    │       ├── App.tsx             # 应用入口
    │       ├── main.tsx            # 挂载入口
    │       └── styles/             # 全局样式
```

---

## 常见问题

### 重置数据库

```bash
npm run db:push -- --force-reset
npm run db:seed
```

默认数据库文件为 `packages/backend/prisma/dev.db`。如需切换数据库路径，请修改 `packages/backend/.env` 中的 `DATABASE_URL`。

### 忘记管理员密码

删除或备份 `packages/backend/prisma/dev.db` 后，重新执行 `npm run db:push && npm run db:seed`。

### 备份数据

复制 `packages/backend/prisma/dev.db` 文件即可（SQLite 单文件存储）。

### 端口被占用

- 后端：修改 `packages/backend/.env` 中的 `PORT`
- 前端：修改 `packages/frontend/package.json` 中 dev 脚本的 `--port`
- 同步更新 `packages/frontend/vite.config.ts` 中的代理地址

---

*计算机科学与技术学院 学术部制作*
