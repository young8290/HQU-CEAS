# API 参考(v2 新旧路径对照)

v2 将 REST API 按双系统命名空间三分(挂载见 `packages/backend/src/app.ts`):

| 前缀 | 含义 | 业务端点数 |
| --- | --- | --- |
| `/api/platform` | 平台共用(认证、组织、账号、设置、签名、PDF、审计、邮件) | 47 |
| `/api/evaluation` | 综测系统(分数、导入、模板、审核小组、综测导出) | 33 |
| `/api/declaration` | 申报系统(奖学金、荣誉、国奖、申报审核、申报导出) | 32 |

**旧路径全部保留为别名(deprecated)**:同一 router 实例在旧前缀再挂一次,行为与新路径完全一致,仅路径不同。换算规则:把新路径中的 `platform/`、`evaluation/`、`declaration/` 段去掉即旧路径,例如 `/api/evaluation/scores/class/11` ⇄ `/api/scores/class/11`。**唯一特例**:综测导出与申报导出的旧别名同为 `/api/export/*`(两个 router 依次级联,路径不重叠);新代码请一律使用新前缀,旧别名仅为过渡保留。

通用约定:

- 认证:`Authorization: Bearer <token>`;管理员/班长令牌来自 `POST /api/platform/auth/login`,审核成员令牌来自 `POST /api/evaluation/score-review-invites/login`(24h 过期)。
- 权限列含义 — `公开`:无需登录;`登录`:任意已登录角色;`admin`:仅管理员;`monitor(本班)`:班长限本班 classId,admin 不受限;`reviewer`:审核成员令牌。部分接口在服务层还有更细校验(如分项维护权限、材料归属)。
- 错误统一 `{ "error": "..." }`;全局限流 600 次/分/IP,登录另限 20 次/15 分/IP;JSON 体积默认 2mb(导入前缀 50mb),文件上传为 multipart。

## 平台共用 `/api/platform`

### auth(旧别名 `/api/auth`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/platform/auth/login` | 公开(限流) | 管理员/班长登录,返回 token 与用户信息 |
| GET | `/api/platform/auth/me` | 登录 | 当前用户信息 |
| PUT | `/api/platform/auth/password` | 登录 | 修改本人密码 |

### users(旧别名 `/api/users`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/platform/users` | admin | 账号列表 |
| POST | `/api/platform/users` | admin | 创建账号 |
| PUT | `/api/platform/users/:id/email` | admin | 设置账号邮箱 |
| POST | `/api/platform/users/monitor-emails/import` | admin | Excel 批量导入班长邮箱(multipart `file`) |
| DELETE | `/api/platform/users/:id` | admin | 删除账号 |
| POST | `/api/platform/users/:id/reset-password` | admin | 重置密码 |
| POST | `/api/platform/users/generate-monitors/:gradeId?` | admin | 批量生成班长账号(可限定年级) |
| POST | `/api/platform/users/export-accounts` | admin | 导出账号表格(Excel,含初始密码) |

### grades(旧别名 `/api/grades`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/platform/grades` | 登录 | 年级列表 |
| POST | `/api/platform/grades` | admin | 创建年级 |
| DELETE | `/api/platform/grades/:id` | admin | 删除年级 |
| GET | `/api/platform/grades/:id/classes` | 登录 | 年级下班级列表 |
| POST | `/api/platform/grades/:id/classes` | admin | 创建班级 |
| DELETE | `/api/platform/grades/:gradeId/classes/:classId` | admin | 删除班级 |

### students(旧别名 `/api/students`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/platform/students` | 登录 | 学生列表(支持 `classId` 等筛选) |
| GET | `/api/platform/students/:id` | 登录 | 学生详情 |
| POST | `/api/platform/students` | admin | 创建学生 |
| POST | `/api/platform/students/batch/:classId?` | admin | Excel 批量导入学生(multipart `file`;缺失年级/班级自动补建) |
| PUT | `/api/platform/students/:id` | admin | 更新学生 |
| DELETE | `/api/platform/students/:id` | admin | 删除学生 |
| DELETE | `/api/platform/students/batch/grade/:gradeId` | admin | 按年级批量删除 |
| DELETE | `/api/platform/students/batch/class/:classId` | admin | 按班级批量删除 |
| GET | `/api/platform/students/template/download` | admin | 学生导入模板下载 |

### academic-years(旧别名 `/api/academic-years`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/platform/academic-years` | 登录 | 学年列表 |
| POST | `/api/platform/academic-years` | admin | 创建学年 |
| PUT | `/api/platform/academic-years/:id/activate` | admin | 设为当前学年 |

### system(旧别名 `/api/system`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/platform/system/entry-status` | 登录 | 双系统开放状态 + 管理员改分开关 |
| GET | `/api/platform/system/settings` | 登录 | 系统设置读取 |
| PUT | `/api/platform/system/settings` | admin | 系统设置写入(开放开关、改分开关等) |

### signatures(旧别名 `/api/signatures`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/platform/signatures` | 登录 | 保存签名(手写/上传;reviewer 仅限综测审核确认用途) |
| GET | `/api/platform/signatures/:id` | 登录 | 获取签名 |

### pdf-materials(旧别名 `/api/pdf-materials`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/platform/pdf-materials/generate` | 登录 | 生成 PDF 材料(协议/确认书) |
| GET | `/api/platform/pdf-materials/:id` | 登录 | 材料信息(服务层校验归属,monitor 限本班) |
| GET | `/api/platform/pdf-materials/:id/download` | 登录 | 下载 PDF(同上校验) |

### audit-logs(旧别名 `/api/audit-logs`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/platform/audit-logs` | admin | 审计日志检索(模块/动作/学年/班级) |
| GET | `/api/platform/audit-logs/:id` | admin | 日志详情(前后值快照) |

### mail(旧别名 `/api/mail`,含 settings/templates/logs 子前缀)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/platform/mail/send-monitor-accounts` | admin | 批量发送班长账号邮件 |
| GET | `/api/platform/mail/settings` | admin | 读取 SMTP 配置 |
| PUT | `/api/platform/mail/settings` | admin | 保存 SMTP 配置(授权码加密存储) |
| POST | `/api/platform/mail/settings/test` | admin | 发送测试邮件 |
| GET | `/api/platform/mail/templates` | admin | 邮件模板列表 |
| PUT | `/api/platform/mail/templates/:id` | admin | 编辑邮件模板 |
| GET | `/api/platform/mail/logs` | admin | 邮件发送日志 |
| POST | `/api/platform/mail/logs/:id/retry` | admin | 失败邮件重发 |

## 综测系统 `/api/evaluation`

### scores(旧别名 `/api/scores`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/evaluation/scores/class/:classId` | monitor(本班) | 班级分数总表 |
| GET | `/api/evaluation/scores/student/:studentId` | 登录 | 单个学生各项分数 |
| GET | `/api/evaluation/scores/student/:studentId/:category/details` | 登录 | 某分项加分明细 |
| PUT | `/api/evaluation/scores` | 登录 | 更新单项分数(服务层按分项维护权限与管理员改分开关校验;写入与总分重算同事务) |
| PUT | `/api/evaluation/scores/student/:studentId/:category/details` | 登录 | 整项替换加分明细并重算 |
| POST | `/api/evaluation/scores/calculate-total/:classId` | monitor(本班) | 重算全班体育总分/综测总分 |
| GET | `/api/evaluation/scores/validate/:classId` | 登录 | 校验班级分数完整性 |

### import(旧别名 `/api/import`;本前缀 JSON 上限 50mb)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/evaluation/import/academic/:classId?` | admin | 导入学业成绩表(multipart `file`) |
| POST | `/api/evaluation/import/sports/:classId?` | admin | 导入体测/体育课成绩表(multipart `file`) |
| POST | `/api/evaluation/import/personal/:classId?` | 登录(monitor 传本班) | 批量导入个人综测填写表(multipart `files`,一次最多 100 份) |
| GET | `/api/evaluation/import/logs` | 登录 | 导入日志(含失败明细) |
| POST | `/api/evaluation/import/export-failures` | 登录 | 将失败明细 JSON 导出为 Excel |

### templates(旧别名 `/api/templates`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/evaluation/templates` | 登录 | 可下载模板列表 |
| GET | `/api/evaluation/templates/:type/download` | 登录 | 下载模板(如个人综测填写表) |

### score-review-groups(旧别名 `/api/score-review-groups`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/evaluation/score-review-groups/:classId` | monitor(本班) | 本班审核小组信息 |
| PUT | `/api/evaluation/score-review-groups/:classId/members` | monitor(本班) | 保存小组成员名单 |
| POST | `/api/evaluation/score-review-groups/:classId/signatures` | monitor(本班) | 采集成员签名(全员签完生成确认书 PDF) |
| GET | `/api/evaluation/score-review-groups/:classId/status` | monitor(本班) | 审核完成状态(缓存 30s) |

### score-review-invites(旧别名 `/api/score-review-invites`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/evaluation/score-review-invites/login` | 公开 | 审核成员凭邀请令牌登录(绑定首次访问设备) |
| GET | `/api/evaluation/score-review-invites/session` | reviewer | 当前审核会话信息 |
| GET | `/api/evaluation/score-review-invites/logs` | reviewer | 本班审核操作日志 |
| PUT | `/api/evaluation/score-review-invites/checks/:studentId` | reviewer | 标记学生「已核对/有异议」(异议需说明) |
| POST | `/api/evaluation/score-review-invites/signature` | reviewer | 提交本人签名 |
| GET | `/api/evaluation/score-review-invites/:classId` | monitor(本班) | 各成员邀请与进度总览 |
| GET | `/api/evaluation/score-review-invites/:classId/logs` | monitor(本班) | 审核日志(班长侧) |
| GET | `/api/evaluation/score-review-invites/:classId/checks` | monitor(本班) | 逐生核对矩阵 |
| POST | `/api/evaluation/score-review-invites/:classId/members/:memberId` | monitor(本班) | 为成员生成邀请链接 |
| DELETE | `/api/evaluation/score-review-invites/:classId/members/:memberId` | monitor(本班) | 撤销成员邀请 |

### export(旧别名 `/api/export`,与申报导出级联共用)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/evaluation/export/attachment2/:classId` | monitor(本班) | 导出附件 2(班级成绩汇总表) |
| GET | `/api/evaluation/export/attachment4/:classId` | admin | 导出附件 4(简表) |
| GET | `/api/evaluation/export/all/:gradeId` | admin | 按年级打包全部班级附件 ZIP |
| GET | `/api/evaluation/export/failed-records` | admin | 导出导入失败记录 |
| GET | `/api/evaluation/export/accounts` | admin | 导出班长账号清单 |

## 申报系统 `/api/declaration`

### external-awards(旧别名 `/api/external-awards`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/declaration/external-awards/import` | admin | 导入外部奖项名单(multipart `file`;`awardType`:国奖/国励/校奖) |

### award-quotas(旧别名 `/api/award-quotas`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/declaration/award-quotas/import` | admin | 导入院奖名额金额表(multipart `file`) |
| GET | `/api/declaration/award-quotas` | 登录 | 查询名额与金额 |

### class-honors(旧别名 `/api/class-honors`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/declaration/class-honors/import` | admin | 导入先进班级名单(multipart `file`;影响优干推荐名额) |

### awards(旧别名 `/api/awards`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/declaration/awards/candidates/:classId` | monitor(本班) | 院奖候选名单(含不满足条件/互斥原因;缓存 30s) |
| GET | `/api/declaration/awards/allocation/:classId` | monitor(本班) | 院奖分配预览(1000/800/600;缓存 30s) |
| POST | `/api/declaration/awards/allocation/preview` | 登录 | 按所选名单实时预览分配与校验 |

### award-declarations(旧别名 `/api/award-declarations`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/declaration/award-declarations/class/:classId` | monitor(本班) | 本班奖学金申报批次 |
| POST | `/api/declaration/award-declarations` | monitor(本班) | 提交奖学金申报批次(校验条件/确认项/签名/名额金额,归档协议 PDF) |

### honors(旧别名 `/api/honors`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/declaration/honors/candidates/:classId` | monitor(本班) | 荣誉称号候选名单(优秀学生/优干;缓存 30s) |

### honor-declarations(旧别名 `/api/honor-declarations`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/declaration/honor-declarations/class/:classId` | monitor(本班) | 本班荣誉称号申报批次 |
| POST | `/api/declaration/honor-declarations` | monitor(本班) | 提交荣誉称号申报批次 |

### declaration-supplements(旧别名 `/api/declaration-supplements`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/declaration/declaration-supplements/import/:classId?` | monitor(本班) | 导入申报补充信息(multipart `file`) |

### declaration-reviews(旧别名 `/api/declaration-reviews`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/declaration/declaration-reviews` | admin | 申报批次列表(缓存 15s) |
| GET | `/api/declaration/declaration-reviews/:id` | admin | 批次详情(学生、确认项、协议 PDF) |
| POST | `/api/declaration/declaration-reviews/:id/return` | admin | 退回修改(附审核意见) |
| POST | `/api/declaration/declaration-reviews/:id/approve` | admin | 确认通过(荣誉可定最终级别;写入通过标签) |

### national-scholarships(旧别名 `/api/national-scholarships`,全部 admin)

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/declaration/national-scholarships` | 评比单元列表 |
| GET | `/api/declaration/national-scholarships/suggest-classes` | 按班名后缀自动建议平行班 |
| POST | `/api/declaration/national-scholarships` | 创建评比单元(班级集合 + Q/p/w/d) |
| GET | `/api/declaration/national-scholarships/:id` | 单元详情(含 B_解析/B_经验/B_最终) |
| POST | `/api/declaration/national-scholarships/:id/compute` | 计算/重算候选池与稳健分层 |
| PUT | `/api/declaration/national-scholarships/:id/candidates/:candidateId/flags` | 修改候选旗标(班级推荐/重大成果) |
| PUT | `/api/declaration/national-scholarships/:id/candidates/:candidateId/review` | 录入临界层评议(理由/次序/是否入选) |
| GET | `/api/declaration/national-scholarships/:id/export` | 导出表 A-1 候选人比较表 Excel |

### tags(旧别名 `/api/tags`)

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/declaration/tags` | admin | 学生标签检索(外部奖项/申报通过等;缓存 30s;v2 起收紧为管理员) |

### export(旧别名 `/api/export`,与综测导出级联共用;全部 admin)

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/declaration/export/declarations` | 申报汇总导出 |
| GET | `/api/declaration/export/award-allocation` | 院奖分配表导出 |
| GET | `/api/declaration/export/honor-declarations` | 荣誉称号明细导出 |
| GET | `/api/declaration/export/declaration-attachment2` | 附件 2 申报汇总表(官方模板填充) |
| GET | `/api/declaration/export/signature-name-list` | 签字名单导出(上交学术部存档) |
| GET | `/api/declaration/export/mail-logs` | 邮件发送记录导出 |

## 其他端点

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/` | 公开 | 服务标识(`name/status/health`) |
| GET | `/api/health` | 公开 | 健康检查:`status/timestamp/version/uptime` |
| WS | `/ws?token=<jwt>` | 登录令牌 | WebSocket 实时推送(按班房间 + 管理员审计频道,30s 心跳) |
