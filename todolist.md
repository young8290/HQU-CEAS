# 奖学金与荣誉称号申报系统待办清单

## 一、项目现状

当前项目是面向计算机科学与技术学院本科生的综合素质测评填写系统。项目采用前后端分离结构，根目录通过 `npm workspaces` 管理前端与后端两个包。

| 模块 | 文件位置 | 当前职责 |
|---|---|---|
| 根配置 | `package.json` | 管理 `packages/backend` 与 `packages/frontend` 两个工作空间，提供开发、构建、数据库同步等命令。 |
| 后端入口 | `packages/backend/src/index.ts` | 注册认证、用户、年级、学生、分数、导入、导出、学年等接口，并启动 HTTP 服务和 WebSocket 服务。 |
| 数据模型 | `packages/backend/prisma/schema.prisma` | 保存用户、年级、班级、学生、学年、综测分数、导入日志等数据结构。 |
| 综测规则 | `packages/backend/src/config/scoreRules.ts` | 定义德育、学业、创新、体育、美育、劳动、公益服务、附加分、总分等分数项规则。 |
| 分数服务 | `packages/backend/src/services/scoreService.ts` | 读取、修改、校验并重新计算学生综测分数。 |
| 导入服务 | `packages/backend/src/services/importService.ts` | 处理学业成绩、体育基础分、个人综测表导入。 |
| 导出服务 | `packages/backend/src/services/exportService.ts` | 处理附件 2、附件 4、失败记录、账号列表导出。 |
| 用户服务 | `packages/backend/src/services/userService.ts` | 创建、删除、重置账号，批量生成班长账号。 |
| 前端入口 | `packages/frontend/src/App.tsx` | 根据当前地址挂载登录、仪表盘、分数、学生、导入、导出、账号、设置页面。 |
| 根页面 | `packages/frontend/src/routes/RootRoute.tsx` | 当前登录后进入综测仪表盘，尚未区分综测系统和奖学金荣誉称号申报系统入口。 |
| 侧边栏 | `packages/frontend/src/components/layout/Sidebar.tsx` | 当前展示综测系统相关功能入口。 |
| 系统设置页 | `packages/frontend/src/components/settings/SettingsPage.tsx` | 当前支持学年管理和修改密码。 |

## 二、核心业务原则

### 2.1 国奖与国励处理方式

国家奖学金和国家励志奖学金名单由管理员导入系统。系统保存名单并用于互斥检查、荣誉称号条件判断和标签展示。国家奖学金和国家励志奖学金无需在本系统内评选。

| 项目 | 系统处理 |
|---|---|
| 国家奖学金 | 管理员导入名单，系统生成标签，用于排除院级奖学金申报和支持优秀学生条件判断。 |
| 国家励志奖学金 | 管理员导入名单，系统生成标签，用于排除院级奖学金申报和支持优秀学生条件判断。 |
| 校级奖学金 | 管理员导入或在系统内生成候选名单，具体方式由后续实际评审安排决定。 |
| 院级奖学金 | 系统按明确数字条件筛选，班级统一申报，管理员接收并审核申报信息。 |

### 2.2 学生类别统一规则

港澳台侨、留学生、境外学生在本系统中统一归入“计算机类班级学生”。后续评审规则以学生所在班级是否属于计算机类班级作为统一判断依据，系统界面和数据库字段采用一致命名。

| 原材料表述 | 系统内统一表述 | 处理方式 |
|---|---|---|
| 港澳台侨学生 | 计算机类班级学生 | 使用班级类别字段标记，评审时按计算机类班级学生规则判断。 |
| 留学生 | 计算机类班级学生 | 使用班级类别字段标记，评审时按计算机类班级学生规则判断。 |
| 境外学生 | 计算机类班级学生 | 使用班级类别字段标记，评审时按计算机类班级学生规则判断。 |
| 境内学生 | 普通班级学生 | 使用班级类别字段标记，评审时按普通班级学生规则判断。 |

| 数据对象 | 字段 | 含义 |
|---|---|---|
| `Class` | `studentGroupType` | 班级学生类别，取值为 `regular` 和 `computer_category`。 |
| `Class` | `isComputerCategory` | 是否计算机类班级，用于前端展示、筛选和规则判断。 |

### 2.3 系统筛选边界

系统只负责明确数字条件的自动筛选和约束校验。无法用数字计算比较的共同条件改为申报前勾选确认，只有全部确认后班级才能提交申报。

| 条件类型 | 处理方式 | 示例 |
|---|---|---|
| 明确数字条件 | 系统自动筛选和校验 | 德育分不低于 90 分、体测成绩不低于 60 分、社区表现分不低于 98 分、学习成绩排名、综测排名。 |
| 名单约束条件 | 系统根据导入名单自动判断 | 国奖名单、国励名单、校奖名单、先进班级或先进团支部名单。 |
| 杂项共同条件 | 班长勾选确认，管理员查看确认记录 | 当学年无违法违规违纪行为、无不及格课程、无学术不端行为、诚实守信、积极参加活动等。 |
| 材料性条件 | 班长填写说明或上传证明，管理员审核 | 干部任职满一年、考核良好及以上、组织过活动、学生个人申报意愿。 |

### 2.4 申报基本方式

奖学金和荣誉称号均采用申报形式。每个班级作为一个申报组，由班长在系统中提交本班申报信息。管理员在后台接收、查看、审核、退回、确认和导出申报信息。

| 角色 | 职责 |
|---|---|
| 管理员 | 导入基础数据，配置系统开放状态，生成系统筛选结果，接收班级申报，审核申报内容，导出最终材料。 |
| 班长 | 查看本班学生筛选结果，确认杂项共同条件，填写申报信息，签署确认协议，提交本班申报。 |
| 综测审核小组 | 仅参与综测评审，按班级实际审核小组成员名单共同签名确认本班综测分数无误。奖学金和荣誉称号申报页面读取综测评审完成状态，页面内无综测审核小组签名入口。 |

## 三、评审条件整理

### 3.1 奖学金共同条件

| 条件 | 系统处理 | 数据来源 |
|---|---|---|
| 德育测评分不低于 90 分 | 系统自动判断 | 综测德育分，对应 `Score.category = moral`。 |
| 大学生体质健康测试成绩 60 分及以上 | 系统自动判断 | 导入综测时导入体测成绩。 |
| 社区表现分不低于 98 分 | 系统自动判断 | 导入综测时导入社区表现分。 |
| 当学年无违法违规违纪行为 | 班长勾选确认 | 班级申报确认项。 |
| 无不及格课程 | 班长勾选确认 | 班级申报确认项。 |
| 无学术不端行为 | 班长勾选确认 | 班级申报确认项。 |
| 诚实守信、道德品质优良、身心健康 | 班长勾选确认 | 班级申报确认项。 |
| 积极参加社会实践、志愿服务、公益活动和集体活动 | 班长勾选确认 | 班级申报确认项。 |
| 关心集体并维护集体荣誉 | 班长勾选确认 | 班级申报确认项。 |

### 3.2 体育基础分计算规则

导入综测时需要同时导入体测成绩和体育课成绩。体育基础分按年级阶段计算。

| 年级阶段 | 体育基础分计算方式 | 说明 |
|---|---|---|
| 大一 | `0.7 * 体测成绩 + 0.3 * 体育课成绩` | 结果用于综测体育基础分折算和奖学金体测条件判断。 |
| 大二 | `0.7 * 体测成绩 + 0.3 * 体育课成绩` | 结果用于综测体育基础分折算和奖学金体测条件判断。 |
| 大三 | `体测成绩` | 无体育课成绩权重。 |

现有 `packages/backend/src/utils/calculation.ts` 中的 `calculateSportsBaseScore` 需要调整为基于体测成绩、体育课成绩和年级阶段计算。

### 3.3 奖学金条件

| 奖项 | 评审方式 | 系统数字筛选条件 | 勾选确认条件 | 注意事项 |
|---|---|---|---|---|
| 国家奖学金 | 只导入名单 | 无系统内评选 | 无 | 名单仅作为标签和互斥依据。 |
| 国家励志奖学金 | 只导入名单 | 无系统内评选 | 无 | 名单仅作为标签和互斥依据。 |
| 校级奖学金 | 管理员导入或系统筛选后申报 | 普通班级学生学习成绩排名班级前 25%，综测成绩排名班级前 30%；计算机类班级学生学习成绩排名班级前 45%，综测成绩排名班级前 50%。 | 奖学金共同条件中的杂项条件。 | 与国家级奖学金、院级奖学金互斥。 |
| 院级奖学金 | 班级统一申报 | 普通班级学生学习成绩达到班级前 60%；计算机类班级学生学习成绩排名班级前 25%，综测成绩排名班级前 30%；德育分、体测成绩、社区表现分满足共同条件。 | 奖学金共同条件中的杂项条件。 | 已获得国奖、国励、校奖、教育部港澳及华侨学生奖学金、教育部台湾学生奖学金的学生排除。 |

### 3.4 院级奖学金分配条件

| 项目 | 条件 |
|---|---|
| 奖项等级 | 一等奖、二等奖、三等奖。 |
| 金额 | 一等奖 1000 元，二等奖 800 元，三等奖 600 元。 |
| 普通班级控制 | 使用管理员导入的班级名额和班级可支配金额控制。 |
| 计算机类班级控制 | 由学院统筹，系统保存申报记录和管理员审核结果。 |
| 人数结构 | 一等奖人数小于等于二等奖人数，二等奖人数小于等于三等奖人数。 |
| 排序依据 | 在符合条件学生中按综测总分排序。 |

### 3.5 荣誉称号条件

| 荣誉称号 | 评审方式 | 系统数字筛选条件 | 勾选确认条件 | 注意事项 |
|---|---|---|---|---|
| 校级优秀学生 | 班级申报，管理员审核 | 获得指定奖学金；普通班级学生综测排名班级前 10%；计算机类班级学生综测排名班级前 30%；德育分不低于 90 分；体测成绩 80 分及以上。 | 荣誉称号共同条件中的杂项条件。 | 省级及以上奖项或荣誉、破格情形由管理员查看材料后审核。 |
| 院级优秀学生 | 班级申报，管理员审核 | 参照校级优秀学生条件，并在院级一等奖学金及以上获得者中评选。 | 荣誉称号共同条件中的杂项条件。 | 只颁发荣誉证书，无奖金，可与奖学金兼得。 |
| 校级优秀学生干部 | 班级申报，管理员审核 | 普通班级学生综测排名班级前 30%，学习成绩排名班级前 30%；计算机类班级学生综测排名班级前 50%；德育分不低于 90 分。 | 学生组织工作人员、任期满一年、考核良好及以上、工作积极负责、至少组织过一次院级及以上活动并有较好影响或受到表彰。 | 干部任职和活动条件需要班长填报说明或上传证明。 |
| 院级优秀学生干部 | 班级申报，管理员审核 | 学习成绩满足院级奖学金评审条件；普通班级每班常规上报 1 人，获得校院两级先进班级或先进团支部的班级可上报 2 人。 | 组织过班级及以上活动，符合学生个人申报意愿。 | 管理员需先导入上学年校院两级先进班级、先进团支部名单。 |

## 四、管理员导入与配置数据清单

| 导入数据 | 用途 | 主要字段 | 对应任务 |
|---|---|---|---|
| 学生基础名单 | 建立学生、班级、学号、姓名基础数据 | 年级、班级、学号、姓名、班级类别 | 学生管理已有能力，需要补充班级类别。 |
| 学业成绩 | 计算学业分和学习成绩排名 | 学号、绩点、学习成绩排名或绩点原始数据 | 复用并扩展现有学业导入。 |
| 综测数据 | 生成综测总分和综测排名 | 德育分、创新分、体测成绩、体育课成绩、体育奖励分、美育、劳动、公益服务、附加分、社区表现分 | 扩展现有个人综测表导入。 |
| 国奖名单 | 奖项标签和互斥判断 | 学年、学号、姓名、奖项名称 | 新增外部奖项名单导入。 |
| 国励名单 | 奖项标签和互斥判断 | 学年、学号、姓名、奖项名称 | 新增外部奖项名单导入。 |
| 校级奖学金名单 | 优秀学生条件判断和院奖互斥判断 | 学年、学号、姓名、奖项等级 | 新增外部奖项名单导入。 |
| 教育部港澳及华侨学生奖学金名单 | 院奖互斥判断和荣誉条件判断 | 学年、学号、姓名、奖项名称 | 新增外部奖项名单导入。 |
| 教育部台湾学生奖学金名单 | 院奖互斥判断和荣誉条件判断 | 学年、学号、姓名、奖项名称 | 新增外部奖项名单导入。 |
| 院级奖学金名额金额表 | 院奖自动分配和超额校验 | 学年、年级、班级、名额、可支配金额 | 新增院奖控制表导入。 |
| 先进班级和先进团支部名单 | 判断院级优秀学生干部上报名额 | 学年、年级、班级、荣誉类型 | 新增班级荣誉名单导入。 |
| 班长邮箱 | 发送账号密码和申报通知 | 年级、班级、班长姓名、邮箱 | 扩展账号管理。 |
| 学术部网易邮箱配置 | 通过学术部网易邮箱发送班长账号、密码重置和申报通知 | SMTP 服务器、端口、账号、授权码、发件人显示名、启用状态 | 新增邮件配置和测试发送。 |
| 邮件模板 | 由管理员维护账号通知、密码重置、申报开放、退回修改等邮件内容 | 模板类型、邮件标题、邮件正文、模板变量、版本、更新时间 | 新增邮件模板管理。 |

## 五、班长确认内容

### 5.1 申报前勾选确认项

班长提交奖学金或荣誉称号申报前，需要对本班申报学生逐项确认。系统要求全部确认项通过后才能提交。

| 确认项 | 适用范围 |
|---|---|
| 当学年无违法违规违纪行为 | 奖学金、荣誉称号 |
| 无不及格课程 | 奖学金、优秀学生干部 |
| 无学术不端行为 | 奖学金、荣誉称号 |
| 诚实守信，道德品质优良，身心健康 | 奖学金、荣誉称号 |
| 积极参加社会实践、志愿服务和公益活动 | 奖学金、荣誉称号 |
| 关心集体，积极参加集体活动，维护集体荣誉 | 奖学金、荣誉称号 |
| 学生本人具有申报意愿 | 荣誉称号 |
| 干部任职信息真实有效 | 优秀学生干部 |
| 组织活动或受表彰情况真实有效 | 优秀学生干部 |

### 5.2 班级申报确认协议

班长提交每个班级申报批次时，需要在系统中签署以下协议。

```text
班级奖学金与荣誉称号申报确认协议

本人作为本班申报负责人，已根据学院通知和系统筛选结果，对本班奖学金与荣誉称号申报信息进行核对。

本人确认：
1. 本次申报学生均符合系统展示的数字条件，包括综测德育分、体测成绩、社区表现分、学习成绩排名、综测排名及相关名额金额约束。
2. 本次申报学生在当学年无违法违规违纪行为、无学术不端行为，并符合相应奖学金或荣誉称号的共同条件。
3. 本次申报学生的课程通过情况、学生个人申报意愿、干部任职情况、活动组织情况和证明材料均已由班级核实。
4. 本班申报结果已经按照学院要求完成班内核对和公示，申报信息真实、完整、准确。
5. 因班级核对疏漏、材料虚假或申报信息错误造成的问题，由班级申报负责人配合学院进行更正和说明。

班级：
申报负责人：
签署时间：
```

### 5.3 综测审核小组签名要求

综测分数作为奖学金和荣誉称号申报的重要依据。综测审核小组只属于综测评审环节，签名入口集中在综测评审页面。奖学金和荣誉称号申报页面仅展示综测评审完成状态，并使用已经确认的综测分数作为筛选依据。综测审核小组人数按班级实际成员名单配置，系统按成员名单生成签名项。

```text
班级综合素质测评审核小组确认书

本班综合素质测评审核小组已共同核对本班学生综测分数。审核小组确认本班学生德育分、学业分、创新分、体育相关分数、美育分、劳动教育分、公益服务分、附加分、社区表现分及综测总分真实无误，可作为奖学金与荣誉称号申报依据。

班级：
审核小组成员签名：
确认时间：
```

系统需要保存审核小组成员姓名、成员角色、签名图片、签名状态、确认时间、确认书 PDF 文件和对应综测评审记录。只有当前班级配置的审核小组成员全部完成签名后，系统才能生成综测审核小组确认书 PDF。

### 5.4 学术部网易邮箱发送方案

邮件发送采用学术部网易邮箱作为统一发件邮箱。系统后台通过 SMTP 协议发送邮件，管理员无需在每次发送邮件时进入网易邮箱网页登录页面。

建设方式如下：

| 项目 | 建设内容 |
|---|---|
| 首次准备 | 管理员在部署或首次配置时登录学术部网易邮箱网页版，开启 SMTP 服务并获取授权码。系统使用授权码发送邮件。 |
| 系统配置 | 后端保存 SMTP 服务器、端口、账号、授权码密文、发件人显示名和启用状态。授权码不得以明文展示在前端页面。 |
| 发送方式 | 班长账号生成、密码重置、申报开放通知、审核退回通知等邮件均由后端 `mailService` 使用学术部网易邮箱发送。 |
| 发送记录 | 系统保存收件人、邮件类型、标题、内容摘要、发送状态、失败原因、发送时间和操作人。 |
| 测试发送 | 管理员配置邮箱后可以发送测试邮件，测试成功后再启用正式发送。 |

邮件模板由管理员在系统内自行编辑和保存。模板需要支持变量替换，避免每次发送前手动修改相同内容。

| 模板类型 | 建议变量 |
|---|---|
| 班长账号通知 | `{{班级}}`、`{{班长姓名}}`、`{{登录账号}}`、`{{初始密码}}`、`{{系统链接}}` |
| 密码重置通知 | `{{班级}}`、`{{登录账号}}`、`{{新密码}}`、`{{系统链接}}` |
| 申报开放通知 | `{{学年}}`、`{{申报类型}}`、`{{截止时间}}`、`{{系统链接}}` |
| 审核退回通知 | `{{班级}}`、`{{申报类型}}`、`{{退回原因}}`、`{{修改截止时间}}`、`{{系统链接}}` |

### 5.5 签名确认与 PDF 归档方案

班长确认协议和综测审核小组确认书均需要形成带签名的 PDF 文件。班长确认协议在奖学金和荣誉称号申报页面签署，并与申报批次关联。综测审核小组确认书在综测评审页面由审核小组成员签署，并与综测评审记录关联。系统把签名放入对应文件模板位置，生成 PDF 后保存到系统数据库文件记录中。

签名来源支持两种形式：

| 签名形式 | 页面能力 | 后端保存 |
|---|---|---|
| 页面手写签字 | 使用签名画布采集手写签名，支持清除、重签、确认。 | 保存签名 PNG、签名人、签名时间、签名用途和申报批次。 |
| 插入电子签名图片 | 上传 PNG 或 JPG 电子签名图片，页面预览后确认使用。 | 保存原始签名图片、裁剪后的签名图片、签名人、签名时间和申报批次。 |

PDF 生成流程如下：

```text
进入对应业务页面
  |
选择手写签字或上传电子签名图片
  |
确认签名用途和签名人身份
  |
后端读取对应 PDF 模板
  |
后端将班级、学年、申报类型、签署时间和签名图片写入模板指定位置
  |
生成带签名 PDF
  |
保存 PDF 文件记录并关联对应业务记录
  |
对应业务页面展示 PDF 预览、下载和签名状态
```

需要生成的 PDF 文件包括：

| 文件 | 签名人 | 生成时机 | 保存关系 |
|---|---|---|---|
| 班级奖学金与荣誉称号申报确认协议 PDF | 班长 | 班长签署确认协议后生成 | 关联申报批次和班长账号。 |
| 班级综合素质测评审核小组确认书 PDF | 综测审核小组全体成员 | 当前班级配置的审核小组成员全部签名后生成 | 关联班级、学年、综测评审记录和审核小组成员。 |

数据库需要保存签名原图、签名裁剪图、生成后的 PDF 文件记录、文件哈希、模板版本、生成时间、签名坐标配置和对应业务记录。文件本体可以使用数据库 BLOB 或服务端受控文件目录保存，数据库必须保存完整文件记录和访问控制信息。

## 六、流程整理

### 6.1 管理员流程

```text
进入系统
  |
选择学年
  |
导入基础数据
  |
导入国奖、国励、校奖等外部名单
  |
导入院奖名额金额、先进班级和先进团支部名单
  |
配置学术部网易邮箱和邮件模板
  |
开放班级申报
  |
接收班级提交的申报信息
  |
审核数字条件、勾选确认项、班长协议 PDF、综测评审完成状态和证明材料
  |
退回修改或确认通过
  |
导出申报汇总表和最终名单
```

### 6.2 班长流程

```text
进入本班申报页面
  |
查看系统筛选出的候选学生
  |
核对学生个人申报意愿
  |
补充干部任职、活动组织、证明材料等说明
  |
逐项勾选共同条件确认项
  |
确认本班综测评审已经完成
  |
在页面内手写签字或上传电子签名图片
  |
生成班级申报确认协议 PDF
  |
提交本班申报
  |
根据管理员退回意见修改或等待审核通过
```

### 6.3 综测审核小组流程

```text
查看本班综测分数
  |
核对德育分、学业分、体育相关分数、社区表现分和综测总分
  |
确认分数无误
  |
通过页面手写签字或上传电子签名图片完成小组成员签名
  |
系统生成班级综合素质测评审核小组确认书 PDF
  |
签名图片和 PDF 文件记录进入本班综测评审材料
```

## 七、评审提醒

| 评审项目 | 需要提醒的内容 |
|---|---|
| 国家奖学金 | 只导入名单，系统内无需生成评选结果。 |
| 国家励志奖学金 | 只导入名单，系统内无需生成评选结果。 |
| 校级奖学金 | 与国家级奖学金、院级奖学金互斥；申报前需要确认共同条件。 |
| 院级奖学金 | 需要排除已获国奖、国励、校奖、教育部港澳及华侨学生奖学金、教育部台湾学生奖学金的学生。 |
| 院级奖学金 | 普通班级需要同时满足名额和金额限制，且一二三等奖人数满足金字塔结构。 |
| 校级优秀学生 | 需要已有指定奖学金记录；体测成绩要求为 80 分及以上。 |
| 院级优秀学生 | 后续从院级一等奖学金及以上获得者中评选。 |
| 校级优秀学生干部 | 干部任职满一年、考核良好及以上、组织活动或表彰情况属于材料审核重点。 |
| 院级优秀学生干部 | 先进班级或先进团支部会影响班级上报名额，管理员需要先导入对应名单。 |
| 所有申报 | 班长确认协议签名、确认项或必要证明材料缺失时，班级申报不得提交。 |
| 综测评审 | 综测审核小组只在综测评审页面签名，确认书 PDF 作为综测分数已确认的材料来源。 |
| 邮件发送 | 学术部网易邮箱需要先完成 SMTP 授权码配置，邮件模板由管理员在系统内编辑和启用。 |

## 八、需要新增的数据

| 数据类别 | 字段示例 | 主要用途 |
|---|---|---|
| 班级类别 | `studentGroupType`、`isComputerCategory` | 统一处理港澳台侨、留学生、境外学生为计算机类班级学生。 |
| 体测与体育课成绩 | `physicalTestScore`、`peCourseScore`、`sportsBaseFormulaStage` | 支持大一、大二、大三体育基础分计算和体测条件判断。 |
| 社区表现分 | `communityScore` | 判断奖学金和荣誉称号数字条件。 |
| 成绩排名 | `academicRank`、`academicRankPercent`、`comprehensiveRank`、`comprehensiveRankPercent` | 判断校奖、院奖、优秀学生、优秀学生干部条件。 |
| 外部奖项名单 | 奖项名称、奖项级别、学年、学号、来源文件、导入批次 | 保存国奖、国励、校奖等名单，用于标签和互斥关系。 |
| 院奖控制 | 班级、学年、名额、金额、一二三等奖人数 | 处理院级奖学金自动分配。 |
| 班级荣誉名单 | 学年、班级、荣誉类型 | 判断院级优秀学生干部上报名额。 |
| 申报批次 | 学年、班级、申报类型、状态、提交人、提交时间 | 保存班级统一申报记录。 |
| 申报学生明细 | 学生、申报项目、系统筛选结果、确认项、材料说明、审核状态 | 保存每名学生的申报信息。 |
| 班长确认项 | 确认项编码、确认状态、确认人、确认时间 | 支持杂项共同条件勾选确认。 |
| 申报确认协议 | 协议内容、签署人、签署时间、申报批次、签名文件、PDF 文件 | 保存班长签署记录和带签名 PDF。 |
| 综测审核小组签名 | 成员姓名、成员角色、成员序号、签名状态、确认时间、综测评审记录、签名文件、PDF 文件 | 保存综测分数确认记录和带签名 PDF，成员数量按班级配置。 |
| 签名文件 | 签名人、签名方式、原始图片、裁剪图片、用途、业务记录、确认时间 | 保存页面手写签名或上传的电子签名图片。 |
| PDF 文件记录 | 文件名称、文件类型、模板版本、文件哈希、存储位置、生成时间、业务记录 | 保存协议和确认书 PDF 的系统记录。 |
| 标签 | 标签名称、标签类型、学生、学年、来源 | 支持候选人筛选和视图展示。 |
| 操作日志 | 操作人、操作对象、操作类型、修改前值、修改后值、时间 | 支持两系统修改记录查询。 |
| 邮件配置 | SMTP 服务器、端口、学术部网易邮箱账号、授权码密文、发件人显示名、启用状态 | 支持通过学术部网易邮箱发送邮件。 |
| 邮件模板 | 模板类型、标题、正文、变量定义、版本、启用状态、更新时间 | 支持管理员编辑和维护邮件正文。 |
| 邮件记录 | 收件人、主题、内容摘要、发送状态、失败原因、发送时间 | 支持班长账号邮件发送追踪。 |

## 九、详细任务清单

| 序号 | 状态 | 任务 | 任务内容 | 主要文件 |
|---:|---|---|---|---|
| 1 | 待处理 | 评审规则建模 | 将奖学金、荣誉称号、互斥关系、计算机类班级学生规则、班级申报规则、班长确认项整理为系统规则。 | `packages/backend/src/config/awardRules.ts`、`packages/backend/src/config/honorRules.ts`、`packages/backend/src/config/declarationRules.ts` |
| 2 | 待处理 | 数据库模型扩展 | 增加班级类别、体测成绩、体育课成绩、社区表现分、外部奖项名单、院奖控制、班级荣誉名单、申报批次、申报明细、确认项、协议签署、综测评审记录、综测审核小组签名、签名文件、PDF 文件记录、标签、操作日志、邮件配置、邮件模板、邮件记录、系统设置等模型。 | `packages/backend/prisma/schema.prisma` |
| 3 | 待处理 | 数据库种子数据扩展 | 写入校奖、院奖、优秀学生、优秀学生干部、默认确认项、默认协议文本、默认 PDF 模板配置、默认邮件模板、默认系统开关、默认标签等初始数据。 | `packages/backend/prisma/seed.ts` |
| 4 | 待处理 | 后端类型定义 | 为奖学金、荣誉称号、班级申报、确认项、协议签署、签名文件、PDF 文件、标签、日志、邮件配置、邮件模板、邮件记录等新增统一类型。 | `packages/backend/src/types/award.ts`、`packages/backend/src/types/honor.ts`、`packages/backend/src/types/declaration.ts`、`packages/backend/src/types/audit.ts`、`packages/backend/src/types/file.ts`、`packages/backend/src/types/mail.ts` |
| 5 | 待处理 | 综测导入扩展 | 导入综测时增加体测成绩、体育课成绩、社区表现分，并按年级阶段计算体育基础分。 | `packages/backend/src/services/importService.ts`、`packages/backend/src/utils/calculation.ts`、`packages/backend/src/config/scoreRules.ts` |
| 6 | 待处理 | 外部奖项名单导入 | 支持导入国奖、国励、校奖、教育部港澳及华侨学生奖学金、教育部台湾学生奖学金名单；国奖和国励只保存名单与标签。 | `packages/backend/src/services/externalAwardImportService.ts`、`packages/backend/src/routes/externalAwards.ts` |
| 7 | 待处理 | 院奖控制表导入 | 支持导入各班级院级奖学金名额和班级可支配金额。 | `packages/backend/src/services/awardQuotaService.ts`、`packages/backend/src/routes/awardQuotas.ts` |
| 8 | 待处理 | 先进班级和先进团支部名单导入 | 支持导入上学年校院两级先进班级、先进团支部名单，用于院级优秀学生干部上报名额判断。 | `packages/backend/src/services/classHonorImportService.ts`、`packages/backend/src/routes/classHonors.ts` |
| 9 | 待处理 | 班长邮箱导入 | 支持按班级导入班长邮箱，并与班长账号关联。 | `packages/backend/src/services/userService.ts`、`packages/backend/src/routes/users.ts` |
| 10 | 待处理 | 模板下载接口 | 为综测扩展数据、外部奖项名单、院奖控制表、先进班级和先进团支部名单、班长邮箱提供模板下载。 | `packages/backend/src/services/templateService.ts`、`packages/backend/src/routes/templates.ts`、`templates/` |
| 11 | 待处理 | 奖学金候选筛选 | 按明确数字条件筛选校奖和院奖候选人；杂项共同条件通过班长确认项处理。 | `packages/backend/src/services/awardService.ts`、`packages/backend/src/routes/awards.ts` |
| 12 | 待处理 | 院奖自动分配 | 根据班级名额、班级金额、一二三等奖金额、人数结构规则，生成院奖分配方案。 | `packages/backend/src/services/awardAllocationService.ts` |
| 13 | 待处理 | 奖学金申报 | 班长以班级为单位提交奖学金申报，系统保存候选学生、确认项、协议签署和管理员审核状态。 | `packages/backend/src/services/awardDeclarationService.ts`、`packages/backend/src/routes/awardDeclarations.ts` |
| 14 | 待处理 | 荣誉称号候选筛选 | 按校级优秀学生、院级优秀学生、校级优秀学生干部、院级优秀学生干部生成数字条件筛选结果。 | `packages/backend/src/services/honorService.ts`、`packages/backend/src/routes/honors.ts` |
| 15 | 待处理 | 荣誉称号申报 | 班长按学生个人意愿提交荣誉称号申报，并补充干部任职、活动组织、证明材料等说明。 | `packages/backend/src/services/honorDeclarationService.ts`、`packages/backend/src/routes/honorDeclarations.ts` |
| 16 | 待处理 | 管理员申报审核 | 管理员接收班级申报，审核数字条件、确认项、协议签署、综测评审完成状态和材料说明，支持退回或确认通过。 | `packages/backend/src/services/declarationReviewService.ts`、`packages/backend/src/routes/declarationReviews.ts` |
| 17 | 待处理 | 班长确认协议 | 保存协议模板、签署记录、签署时间、签名图片、PDF 文件和申报批次；缺少带签名 PDF 时阻止提交。 | `packages/backend/src/services/agreementService.ts`、`packages/backend/src/services/signatureService.ts`、`packages/backend/src/services/pdfService.ts`、`packages/backend/src/routes/agreements.ts` |
| 18 | 待处理 | 综测审核小组签名 | 支持按班级配置任意数量审核小组成员，在综测评审页面采集手写签名或上传电子签名图片，全部成员签名后生成综测审核小组确认书 PDF；奖学金和荣誉称号申报页面仅显示综测评审完成状态。 | `packages/backend/src/services/scoreReviewGroupService.ts`、`packages/backend/src/services/signatureService.ts`、`packages/backend/src/services/pdfService.ts`、`packages/backend/src/routes/scoreReviewGroups.ts` |
| 19 | 待处理 | 标签能力 | 为国奖、国励、校奖、院奖候选、荣誉候选、已申报、待审核、已退回、已通过等状态建立标签，并支持按标签筛选。 | `packages/backend/src/services/tagService.ts`、`packages/backend/src/routes/tags.ts` |
| 20 | 待处理 | 两系统入口 | 将根页面改为系统入口页，展示综测填写系统和奖学金荣誉称号申报系统。 | `packages/frontend/src/routes/RootRoute.tsx`、`packages/frontend/src/components/home/SystemEntryPage.tsx` |
| 21 | 待处理 | 系统开放状态 | 管理员可控制综测系统和奖学金荣誉称号申报系统开放状态，班长进入关闭系统时显示状态提示。 | `packages/backend/src/services/systemSettingService.ts`、`packages/backend/src/routes/systemSettings.ts`、`packages/frontend/src/components/settings/SettingsPage.tsx` |
| 22 | 待处理 | 前端导航扩展 | 在侧边栏中增加奖学金申报、荣誉称号申报、申报审核、标签视图、操作日志、邮件管理、模板下载等入口，并按角色控制显示。 | `packages/frontend/src/components/layout/Sidebar.tsx` |
| 23 | 待处理 | 奖学金申报页面 | 提供候选人查看、院奖分配预览、确认项勾选、协议签署、综测评审完成状态提示、提交申报等能力。 | `packages/frontend/src/routes/AwardsRoute.tsx`、`packages/frontend/src/components/awards/AwardsPage.tsx` |
| 24 | 待处理 | 荣誉称号申报页面 | 提供候选人查看、学生意愿确认、干部材料说明、活动材料说明、确认项勾选、协议签署和提交申报等能力。 | `packages/frontend/src/routes/HonorsRoute.tsx`、`packages/frontend/src/components/honors/HonorsPage.tsx` |
| 25 | 待处理 | 管理员申报审核页面 | 管理员查看所有班级申报，按学年、班级、申报类型、审核状态、标签筛选，并执行退回或通过。 | `packages/frontend/src/routes/DeclarationReviewsRoute.tsx`、`packages/frontend/src/components/declarations/DeclarationReviewsPage.tsx` |
| 26 | 待处理 | 标签视图页面 | 按学生、班级、奖项、荣誉称号、申报状态、材料状态查看各类标签。 | `packages/frontend/src/routes/TagsRoute.tsx`、`packages/frontend/src/components/tags/TagsPage.tsx` |
| 27 | 待处理 | 操作日志系统 | 将学生资料、综测分数、导入、导出、账号、密码重置、申报提交、审核退回、审核通过、系统设置等修改写入日志。 | `packages/backend/src/services/auditService.ts`、`packages/backend/src/routes/auditLogs.ts` |
| 28 | 待处理 | 操作日志页面 | 管理员按系统、模块、操作人、时间、对象查询修改记录。 | `packages/frontend/src/routes/AuditLogsRoute.tsx`、`packages/frontend/src/components/audit/AuditLogsPage.tsx` |
| 29 | 待处理 | 学术部网易邮箱配置 | 增加网易邮箱 SMTP 配置、授权码密文保存、发件人显示名、测试发送、启用状态和发送记录等能力。管理员只在首次准备授权码时登录网易邮箱，系统发送邮件时使用 SMTP 授权码。 | `packages/backend/src/config/index.ts`、`packages/backend/src/services/mailConfigService.ts`、`packages/backend/src/services/mailService.ts`、`packages/backend/src/routes/mailSettings.ts` |
| 30 | 待处理 | 邮件模板管理 | 管理员在系统内编辑班长账号通知、密码重置通知、申报开放通知、审核退回通知等模板，模板支持变量预览和版本保存。 | `packages/backend/src/services/mailTemplateService.ts`、`packages/backend/src/routes/mailTemplates.ts`、`packages/frontend/src/components/mail/MailTemplatePage.tsx` |
| 31 | 待处理 | 班长账号邮件发送 | 管理员批量生成班长账号密码后可通过学术部网易邮箱发送邮件；重置密码后按模板自动发送邮件，并保存发送状态。 | `packages/backend/src/services/userService.ts`、`packages/backend/src/routes/users.ts`、`packages/backend/src/services/mailService.ts` |
| 32 | 待处理 | 邮件管理页面 | 管理员导入邮箱、配置学术部网易邮箱、编辑邮件模板、发送测试邮件、查看发送状态、重新发送失败邮件。 | `packages/frontend/src/components/accounts/AccountsPage.tsx`、`packages/frontend/src/components/mail/MailPage.tsx`、`packages/frontend/src/components/mail/MailTemplatePage.tsx` |
| 33 | 待处理 | 签名采集组件 | 前端提供手写签字画布和电子签名图片上传能力，支持预览、清除、重签、确认和签名用途提示。 | `packages/frontend/src/components/signature/SignaturePad.tsx`、`packages/frontend/src/components/signature/SignatureUpload.tsx` |
| 34 | 待处理 | PDF 套版生成 | 后端读取班长确认协议和综测评审确认书模板，把班级、学年、业务类型、确认时间和签名图片写入指定位置，生成 PDF 并保存文件记录。 | `packages/backend/src/services/pdfService.ts`、`packages/backend/src/services/fileStorageService.ts`、`templates/pdf/` |
| 35 | 待处理 | 导出能力扩展 | 支持导出奖学金候选名单、院奖分配名单、班级申报表、荣誉称号申报表、带签名班长确认协议 PDF、综测评审确认书 PDF、操作日志、邮件发送记录。 | `packages/backend/src/services/exportService.ts`、`packages/backend/src/routes/export.ts` |
| 36 | 待处理 | API 客户端扩展 | 增加奖学金、荣誉称号、班级申报、审核、标签、日志、邮件、模板、签名、PDF 文件接口调用封装和缓存规则。 | `packages/frontend/src/lib/api.ts` |
| 37 | 待处理 | 权限边界扩展 | 管理员可操作全部申报和审核数据；班长只能操作本班申报数据、签名文件和申报 PDF。 | `packages/backend/src/middleware/auth.ts` |
| 38 | 待处理 | 后端测试 | 覆盖体测体育课计算、计算机类班级规则、国奖国励名单导入、奖学金互斥、院奖金额限制、人数结构、申报提交限制、协议签署、综测评审小组签名、PDF 生成、邮件模板、网易邮箱发送记录、日志写入。 | `packages/backend/src/**/*.test.ts` |
| 39 | 待处理 | 前端测试 | 覆盖双系统入口、系统关闭提示、奖学金申报、荣誉称号申报、确认项勾选、协议签署、签名采集、PDF 生成状态、管理员审核、模板下载、日志查询、邮件模板和邮件状态。 | `packages/frontend/src/**/*.test.tsx` |
| 40 | 待处理 | 文档同步 | 更新 README 中的系统入口、数据导入、奖学金荣誉称号申报、确认协议、综测评审小组签名、PDF 归档、操作日志、学术部网易邮箱发送、邮件模板、模板下载等内容。 | `README.md` |
| 41 | 待处理 | 前端设计书同步 | 建立前端设计书，覆盖 Claude 简约风格、角色页面差异、路由、组件、交互、动效、后端接口、响应式和验收标准；前端源码实现前以设计书为依据。 | `前端设计书.md`、`output/frontend-mockups/`、`packages/frontend/src/**/*` |
| 42 | 待确认 | 后端设计书同步 | 建立后端设计书，覆盖现有后端结构、数据模型、服务拆分、接口、缓存、权限、事务、签名、PDF、邮件、日志、测试和验收标准；后端源码实现前以设计书为依据。 | `后端设计书.md`、`packages/backend/src/**/*`、`packages/backend/prisma/schema.prisma` |
| 43 | 待处理 | 后端缓存与页面加载支撑 | 新增进程内 TTL 缓存和 HTTP 缓存头，缓存当前学年、系统入口状态、班级综测、奖学金候选、荣誉称号候选、申报审核列表、总览统计、邮件模板和标签统计；导入、申报、审核、签名、PDF、邮件模板、系统设置等写入操作完成后清理相关缓存。 | `packages/backend/src/services/cacheService.ts`、`packages/backend/src/middleware/cacheHeaders.ts`、`packages/backend/src/services/*Service.ts` |

## 十、任务与文件关系总表

| 文件位置 | 需要调整的任务 | 调整内容 |
|---|---|---|
| `packages/backend/prisma/schema.prisma` | 2 | 增加申报系统所需数据库模型和字段。 |
| `packages/backend/prisma/seed.ts` | 3 | 写入默认奖项、称号、确认项、协议文本、PDF 模板配置、邮件模板、标签、系统开关。 |
| `packages/backend/src/index.ts` | 6、7、8、10、11、13、14、15、16、17、18、19、21、27、29、30、34 | 注册新增后端路由。 |
| `packages/backend/src/config/scoreRules.ts` | 1、5、11、14 | 增加体测成绩、体育课成绩、社区表现分相关规则。 |
| `packages/backend/src/config/awardRules.ts` | 1、11、12、13 | 新增奖学金数字筛选、互斥和院奖分配规则。 |
| `packages/backend/src/config/honorRules.ts` | 1、14、15 | 新增荣誉称号数字筛选和材料确认规则。 |
| `packages/backend/src/config/declarationRules.ts` | 1、13、15、17、18 | 新增班级申报、确认项、协议签署和综测评审完成状态规则。 |
| `packages/backend/src/config/index.ts` | 21、29 | 增加系统开放状态默认配置、网易邮箱 SMTP 配置和授权码读取。 |
| `packages/backend/src/middleware/auth.ts` | 13、15、16、21、27、34、37 | 管理员和班长权限判断。 |
| `packages/backend/src/middleware/cacheHeaders.ts` | 21、30、34、43 | 为系统入口状态、邮件模板、PDF 预览下载等 GET 接口返回 `ETag`、`Last-Modified` 或短时间私有缓存头。 |
| `packages/backend/src/utils/calculation.ts` | 5 | 调整体育基础分计算方式。 |
| `packages/backend/src/services/cacheService.ts` | 11、12、14、16、18、19、21、29、30、43 | 新增命名空间 TTL 缓存、按前缀清理、写入后缓存失效和读取结果复用能力，保证页面切换和数据密集页面加载流畅。 |
| `packages/backend/src/services/scoreService.ts` | 5、11、14、18 | 提供综测分数、德育分、体测成绩、社区表现分、班级排名基础数据。 |
| `packages/backend/src/services/importService.ts` | 5、9 | 扩展综测导入和班长邮箱导入。 |
| `packages/backend/src/services/externalAwardImportService.ts` | 6 | 新增外部奖项名单导入。 |
| `packages/backend/src/services/awardQuotaService.ts` | 7 | 新增院奖名额金额导入。 |
| `packages/backend/src/services/classHonorImportService.ts` | 8 | 新增先进班级和先进团支部名单导入。 |
| `packages/backend/src/services/templateService.ts` | 10 | 新增模板下载服务。 |
| `packages/backend/src/services/awardService.ts` | 11 | 新增奖学金数字条件候选筛选服务。 |
| `packages/backend/src/services/awardAllocationService.ts` | 12 | 新增院级奖学金自动分配服务。 |
| `packages/backend/src/services/awardDeclarationService.ts` | 13 | 新增奖学金班级申报服务。 |
| `packages/backend/src/services/honorService.ts` | 14 | 新增荣誉称号数字条件候选筛选服务。 |
| `packages/backend/src/services/honorDeclarationService.ts` | 15 | 新增荣誉称号班级申报服务。 |
| `packages/backend/src/services/declarationReviewService.ts` | 16 | 新增管理员申报审核服务。 |
| `packages/backend/src/services/agreementService.ts` | 17 | 新增协议模板、签署记录和协议 PDF 关联服务。 |
| `packages/backend/src/services/scoreReviewGroupService.ts` | 18 | 新增按班级配置综测审核小组成员、签名状态和综测评审确认书 PDF 关联服务。 |
| `packages/backend/src/services/signatureService.ts` | 17、18、33 | 新增手写签名和电子签名图片保存、裁剪、确认、查询服务。 |
| `packages/backend/src/services/pdfService.ts` | 17、18、34、35 | 新增班长确认协议和综测评审确认书 PDF 套版生成服务。 |
| `packages/backend/src/services/fileStorageService.ts` | 17、18、34、35 | 新增签名图片和 PDF 文件存储、访问控制、哈希记录服务。 |
| `packages/backend/src/services/tagService.ts` | 19 | 新增标签生成、绑定、查询服务。 |
| `packages/backend/src/services/auditService.ts` | 27 | 新增统一操作日志服务。 |
| `packages/backend/src/services/mailConfigService.ts` | 29 | 新增学术部网易邮箱 SMTP 配置、授权码密文保存和测试发送服务。 |
| `packages/backend/src/services/mailTemplateService.ts` | 30 | 新增邮件模板保存、变量校验、预览和版本管理服务。 |
| `packages/backend/src/services/mailService.ts` | 29、30、31 | 新增邮件发送、模板渲染、发送记录服务。 |
| `packages/backend/src/services/exportService.ts` | 35 | 增加申报表、带签名 PDF、日志、邮件等导出文件。 |
| `packages/backend/src/services/userService.ts` | 9、31 | 增加邮箱字段处理、账号邮件发送、重置密码邮件触发。 |
| `packages/backend/src/routes/externalAwards.ts` | 6 | 新增外部奖项名单导入接口。 |
| `packages/backend/src/routes/awardQuotas.ts` | 7 | 新增院奖名额金额接口。 |
| `packages/backend/src/routes/classHonors.ts` | 8 | 新增先进班级和先进团支部名单接口。 |
| `packages/backend/src/routes/templates.ts` | 10 | 新增模板下载接口。 |
| `packages/backend/src/routes/awards.ts` | 11、12 | 新增奖学金筛选和院奖分配接口。 |
| `packages/backend/src/routes/awardDeclarations.ts` | 13 | 新增奖学金申报接口。 |
| `packages/backend/src/routes/honors.ts` | 14 | 新增荣誉称号筛选接口。 |
| `packages/backend/src/routes/honorDeclarations.ts` | 15 | 新增荣誉称号申报接口。 |
| `packages/backend/src/routes/declarationReviews.ts` | 16 | 新增管理员审核接口。 |
| `packages/backend/src/routes/agreements.ts` | 17 | 新增协议签署接口。 |
| `packages/backend/src/routes/scoreReviewGroups.ts` | 18 | 新增综测评审小组签名接口。 |
| `packages/backend/src/routes/tags.ts` | 19 | 新增标签查询和筛选接口。 |
| `packages/backend/src/routes/systemSettings.ts` | 21 | 新增系统开放状态接口。 |
| `packages/backend/src/routes/auditLogs.ts` | 27 | 新增操作日志查询接口。 |
| `packages/backend/src/routes/mailSettings.ts` | 29 | 新增学术部网易邮箱配置、测试发送和启用状态接口。 |
| `packages/backend/src/routes/mailTemplates.ts` | 30 | 新增邮件模板编辑、预览、保存和启用接口。 |
| `packages/backend/src/routes/export.ts` | 35 | 增加申报相关导出接口。 |
| `packages/backend/src/routes/users.ts` | 9、31 | 增加邮箱维护和账号邮件发送接口。 |
| `packages/frontend/src/App.tsx` | 20、23、24、25、26、28、30、32 | 注册新增前端页面。 |
| `packages/frontend/src/routes/RootRoute.tsx` | 20 | 改为双系统入口。 |
| `packages/frontend/src/components/layout/Sidebar.tsx` | 22 | 增加申报系统导航项。 |
| `packages/frontend/src/components/settings/SettingsPage.tsx` | 21、29 | 增加系统开放状态和学术部网易邮箱配置入口。 |
| `packages/frontend/src/components/accounts/AccountsPage.tsx` | 9、31、32 | 增加邮箱导入、账号邮件发送、发送状态展示。 |
| `packages/frontend/src/components/import/ImportPage.tsx` | 5、6、7、8、9、10 | 增加新导入类型和模板下载入口。 |
| `packages/frontend/src/components/export/ExportPage.tsx` | 35 | 增加申报相关导出入口。 |
| `packages/frontend/src/components/awards/AwardsPage.tsx` | 23、33、34 | 新增奖学金申报页面、签名采集入口和 PDF 生成状态展示。 |
| `packages/frontend/src/components/honors/HonorsPage.tsx` | 24、33、34 | 新增荣誉称号申报页面、签名采集入口和 PDF 生成状态展示。 |
| `packages/frontend/src/components/declarations/DeclarationReviewsPage.tsx` | 25、34、35 | 新增管理员申报审核页面、PDF 预览、下载和审核入口。 |
| `packages/frontend/src/components/tags/TagsPage.tsx` | 26 | 新增标签视图页面。 |
| `packages/frontend/src/components/audit/AuditLogsPage.tsx` | 28 | 新增操作日志页面。 |
| `packages/frontend/src/components/mail/MailPage.tsx` | 29、31、32 | 新增邮箱配置、测试发送、发送记录和失败重发页面。 |
| `packages/frontend/src/components/mail/MailTemplatePage.tsx` | 30、32 | 新增邮件模板编辑、变量预览和版本保存页面。 |
| `packages/frontend/src/components/signature/SignaturePad.tsx` | 33 | 新增页面手写签名组件。 |
| `packages/frontend/src/components/signature/SignatureUpload.tsx` | 33 | 新增电子签名图片上传和预览组件。 |
| `packages/frontend/src/lib/api.ts` | 36 | 增加新增接口封装和缓存规则。 |
| `templates/` | 5、6、7、8、9、10 | 增加新导入模板文件。 |
| `templates/pdf/` | 3、34 | 增加班长确认协议和综测评审确认书 PDF 模板。 |
| `README.md` | 40 | 同步新增系统能力和使用方式。 |
| `前端设计书.md` | 20、22、23、24、25、29、30、31、32、33、34、36、39、41 | 作为前端页面、视觉风格、角色权限、路由、组件、动效、后端接口和验收标准的设计依据。 |
| `后端设计书.md` | 1、2、4、5、6、7、8、9、10、11、12、13、14、15、16、17、18、19、21、27、29、30、31、34、35、37、38、42、43 | 作为后端数据模型、业务服务、接口、缓存、权限、事务、签名、PDF、邮件、日志、测试和验收标准的设计依据。 |
| `output/frontend-mockups/` | 20、22、23、24、25、29、30、32、41 | 保存前端页面视觉稿、HTML 预览和图片生成提示词，设计书需要与该目录内容保持一致。 |

## 十一、实施顺序

| 阶段 | 任务范围 | 完成标志 |
|---|---|---|
| 第一阶段 | 数据模型、规则配置、体育基础分计算、社区表现分导入、外部名单导入模板。 | 系统能保存体测成绩、体育课成绩、社区表现分、国奖名单、国励名单、校奖名单和班级类别。 |
| 第二阶段 | 奖学金候选筛选、院奖自动分配、荣誉称号候选筛选、标签能力。 | 系统能根据明确数字条件生成候选名单，并标记国奖、国励、校奖、院奖候选和荣誉候选。 |
| 第三阶段 | 综测评审小组签名、综测评审确认书 PDF、班级申报、班长确认项、班长确认协议 PDF。 | 综测评审页面完成审核小组签名和确认书 PDF；奖学金与荣誉称号申报页面完成班长确认项、班长签名和确认协议 PDF。 |
| 第四阶段 | 管理员审核、退回、确认、PDF 预览、导出。 | 管理员能接收申报信息，查看提醒，预览带签名 PDF，退回修改，确认通过，并导出材料。 |
| 第五阶段 | 前端设计书确认、双系统入口、开放状态、操作日志、学术部网易邮箱配置、邮件模板、邮件发送、README 同步。 | 前端源码实现前完成设计书确认；两个系统入口清晰，修改记录可查询，班长账号和申报通知可通过学术部网易邮箱发送，文档与系统能力一致。 |
| 第六阶段 | 后端设计书确认、缓存接入、分页查询、错误码整理、后端测试补充、接口文档同步。 | 后端源码实现前完成设计书确认；当前学年、系统入口、候选名单、审核列表、总览统计、邮件模板等高频读取具备缓存；关键业务接口有权限、事务和测试保障。 |

## 十二、验收检查表

| 检查项 | 标准 |
|---|---|
| 国奖和国励处理 | 国奖、国励只通过名单导入保存标签和约束依据，系统内无国奖和国励评选功能。 |
| 计算机类班级学生统一处理 | 港澳台侨、留学生、境外学生均通过班级类别进入同一套计算机类班级学生规则。 |
| 体育基础分计算 | 大一大二按 `0.7 * 体测成绩 + 0.3 * 体育课成绩` 计算，大三按体测成绩计算。 |
| 社区表现分 | 社区表现分通过综测导入进入数据库，并参与数字条件筛选。 |
| 杂项共同条件 | 当学年无违法违规违纪行为、无不及格课程、无学术不端行为等条件均由班长勾选确认。 |
| 班级统一申报 | 奖学金和荣誉称号均以班级为申报组提交，管理员可以接收申报信息。 |
| 班长确认协议 | 缺少带签名确认协议 PDF 时，班级申报无法提交。 |
| 综测审核小组签名 | 综测审核小组仅在综测评审页面签名，奖学金和荣誉称号申报页面只显示综测评审完成状态。 |
| 签名采集 | 支持页面手写签字和上传电子签名图片，确认后保存签名图片、签名人、签名时间和签名用途。 |
| PDF 生成 | 签名图片能写入班长确认协议或综测评审确认书模板指定位置，生成 PDF 后保存文件记录并关联对应业务记录。 |
| 奖学金互斥 | 国家级、校级、院级奖学金互斥规则在候选筛选和申报提交时均生效。 |
| 院奖金额控制 | 普通班级推荐结果金额总和未超过班级可支配金额。 |
| 院奖人数结构 | 一等奖人数小于等于二等奖人数，二等奖人数小于等于三等奖人数。 |
| 荣誉称号候选 | 系统只自动判断明确数字条件，材料性条件由班长填写并由管理员审核。 |
| 班长权限 | 班长只能查看和提交本班申报。 |
| 管理员权限 | 管理员可查看全院申报数据、审核申报、退回修改、确认通过、导出结果。 |
| 系统开放状态 | 管理员可分别控制综测填写系统和奖学金荣誉称号申报系统。 |
| 操作日志 | 关键新增、修改、删除、导入、导出、申报、审核、邮件动作均可查到操作人和时间。 |
| 邮件配置 | 学术部网易邮箱通过 SMTP 授权码配置，系统发送邮件时无需反复登录网易邮箱网页。 |
| 邮件模板 | 管理员能在系统内编辑账号通知、密码重置、申报开放、审核退回等邮件模板，模板支持变量替换。 |
| 邮件发送 | 班长账号生成和密码重置后可通过学术部网易邮箱发送邮件，并保留发送状态。 |
| 模板下载 | 所有需要统一导入的数据均有模板文件可下载。 |
| 前端设计书 | 设计书覆盖页面、角色、路由、组件、交互、动效、接口、权限、响应式和验收标准，且与视觉稿和待办清单保持一致。 |
| 后端设计书 | 设计书覆盖现有结构、数据模型、服务拆分、接口、缓存、权限、事务、签名、PDF、邮件、日志、测试和验收标准，且与前端设计书和待办清单保持一致。 |
| 后端缓存 | 当前学年、系统入口状态、班级综测、奖学金候选、荣誉称号候选、申报审核列表、总览统计、邮件模板和标签统计具备 TTL 缓存；导入、申报、审核、签名、PDF、邮件模板和系统设置修改后清理相关缓存。 |
