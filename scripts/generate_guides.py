from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "packages" / "frontend" / "public" / "guides"
BUILD_DIR = ROOT / "scripts" / ".guide-build"
LOGO_PATH = ROOT / "packages" / "frontend" / "public" / "学术部logo.png"


def escape_tex(value: object) -> str:
    text = str(value)
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(char, char) for char in text)


def begin_document(title: str) -> str:
    template = r"""\documentclass[12pt,a4paper]{article}
\usepackage[a4paper,left=32mm,right=32mm,top=25mm,bottom=25mm]{geometry}
\usepackage{fontspec}
\usepackage{xeCJK}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{array}
\usepackage{tabularx}
\usepackage{booktabs}
\usepackage{enumitem}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{hyperref}
\usepackage{setspace}
\definecolor{GuidePaper}{HTML}{F7F4ED}
\definecolor{GuideText}{HTML}{211B18}
\definecolor{GuideMuted}{HTML}{5F5650}
\definecolor{GuideLine}{HTML}{D7D0C4}
\definecolor{GuideBlock}{HTML}{E7E3DC}
\definecolor{GuideAccent}{HTML}{6F3F2A}
\hypersetup{hidelinks}
\pagecolor{GuidePaper}
\setmainfont{Times New Roman}
\setCJKmainfont{SimSun}[BoldFont={SimHei}]
\setCJKsansfont{Microsoft YaHei}
\setmonofont{Consolas}
\XeTeXlinebreaklocale "zh"
\XeTeXlinebreakskip = 0pt plus 1pt
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.72em}
\setstretch{1.36}
\color{GuideText}
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0.35pt}
\renewcommand{\footrule}{\hbox to\headwidth{\color{GuideLine}\leaders\hrule height \footrulewidth\hfill}}
\fancyfoot[L]{\footnotesize\color{GuideMuted}计算机科学与技术学院学术部制作}
\fancyfoot[R]{\footnotesize\color{GuideMuted}\thepage}
\titleformat{\section}{\LARGE\bfseries\color{GuideText}}{\thesection}{0.7em}{}
\titleformat{\subsection}{\large\bfseries\color{GuideText}}{}{0pt}{}
\titlespacing*{\section}{0pt}{1.35em}{0.55em}
\titlespacing*{\subsection}{0pt}{1.0em}{0.25em}
\setlist[itemize]{leftmargin=2.2em,itemsep=0.25em,topsep=0.15em,label=\raisebox{0.2ex}{\scriptsize$\bullet$}}
\setlist[enumerate]{leftmargin=2.4em,itemsep=0.35em,topsep=0.2em,label=\arabic*.}
\newcolumntype{Y}{>{\raggedright\arraybackslash}X}
\newsavebox{\guideboxcontent}
\newenvironment{guidebox}{\par\medskip\noindent\begin{lrbox}{\guideboxcontent}\begin{minipage}{0.94\linewidth}\small\color{GuideText}}{\end{minipage}\end{lrbox}\begingroup\setlength{\fboxsep}{11pt}\colorbox{GuideBlock}{\usebox{\guideboxcontent}}\endgroup\par\medskip}
\newcommand{\thinrule}{\par\noindent\textcolor{GuideLine}{\rule{\linewidth}{0.5pt}}\par}
\newcommand{\covermeta}[2]{\textcolor{GuideMuted}{#1}\hspace{1.5em}#2\par}
\newcommand{\tagtext}[1]{\begingroup\setlength{\fboxsep}{3pt}\colorbox{GuideBlock}{\ttfamily\small #1}\endgroup}
\begin{document}
\pdfbookmark[1]{__TITLE__}{cover}
"""
    return template.replace("__TITLE__", escape_tex(title))


def end_document() -> str:
    return r"\end{document}" + "\n"


def cover(guide: dict) -> str:
    title = f"{guide['system']}：{guide['role']}操作指南"
    return rf"""
\begin{{titlepage}}
\thispagestyle{{empty}}
\vspace*{{34mm}}
\begin{{center}}
\includegraphics[width=18mm]{{logo.png}}\par
\vspace{{14mm}}
{{\fontsize{{29}}{{38}}\selectfont\bfseries {escape_tex(title)}\par}}
\vspace{{8mm}}
\thinrule
\vspace{{16mm}}
{{\large {escape_tex(guide['lead'])}\par}}
\vspace{{22mm}}
\begin{{minipage}}{{0.72\linewidth}}
\covermeta{{文档名称}}{{{escape_tex(title)}}}
\covermeta{{适用系统}}{{华侨大学计算机科学与技术学院综测填写与申报系统}}
\covermeta{{适用角色}}{{{escape_tex(guide['role'])}}}
\covermeta{{编制单位}}{{计算机科学与技术学院学术部}}
\covermeta{{版本}}{{2024-2025 学年}}
\end{{minipage}}
\end{{center}}
\vfill
\thinrule
{{\small\color{{GuideMuted}}页面内容以系统实际显示为准，材料归档以导出的正式文件为准。\par}}
\end{{titlepage}}
\setcounter{{page}}{{1}}
"""


def toc(guide: dict) -> str:
    rows = "\n".join(
        rf"\item {escape_tex(section['title'])}" for section in guide["sections"]
    )
    return rf"""
\section*{{目录}}
\thinrule
\begin{{enumerate}}
{rows}
\end{{enumerate}}
\newpage
"""


def paragraph(text: str) -> str:
    return escape_tex(text) + "\n\n"


def bullet(items: list[str]) -> str:
    body = "\n".join(rf"\item {escape_tex(item)}" for item in items)
    return "\\begin{itemize}\n" + body + "\n\\end{itemize}\n\n"


def steps(items: list[str]) -> str:
    body = "\n".join(rf"\item {escape_tex(item)}" for item in items)
    return "\\begin{enumerate}\n" + body + "\n\\end{enumerate}\n\n"


def note(text: str) -> str:
    return "\\begin{guidebox}\n" + escape_tex(text) + "\n\\end{guidebox}\n\n"


def subheading(text: str) -> str:
    return rf"\subsection*{{{escape_tex(text)}}}" + "\n"


def table(rows: list[list[str]]) -> str:
    column_count = len(rows[0])
    columns = "@{}" + "Y" * column_count + "@{}"
    output = [rf"\begin{{tabularx}}{{\linewidth}}{{{columns}}}", r"\toprule"]
    for index, row in enumerate(rows):
        output.append(" & ".join(escape_tex(cell) for cell in row) + r" \\")
        output.append(r"\midrule" if index == 0 else "")
    output.append(r"\bottomrule")
    output.append(r"\end{tabularx}")
    output.append("")
    return "\n".join(line for line in output if line != "") + "\n"


def render_block(block: tuple[str, object]) -> str:
    kind, value = block
    if kind == "p":
        return paragraph(value)
    if kind == "h3":
        return subheading(value)
    if kind == "bullet":
        return bullet(value)
    if kind == "steps":
        return steps(value)
    if kind == "note":
        return note(value)
    if kind == "table":
        return table(value)
    raise ValueError(f"未知内容块：{kind}")


def render_guide(guide: dict) -> str:
    parts = [begin_document(f"{guide['system']}：{guide['role']}操作指南"), cover(guide), toc(guide)]
    for index, section in enumerate(guide["sections"], start=1):
        parts.append(rf"\section*{{{index}. {escape_tex(section['title'])}}}" + "\n\\thinrule\n")
        parts.extend(render_block(block) for block in section["blocks"])
        parts.append("\n")
    parts.append(end_document())
    return "".join(parts)


def guides() -> list[dict]:
    return [
        {
            "filename": "evaluation-admin-guide",
            "system": "综合素质测评填写系统",
            "role": "管理员",
            "lead": "完成基础数据、学校来源成绩、班级进度核对和附件导出。",
            "sections": [
                {
                    "title": "进入系统后的处理顺序",
                    "blocks": [
                        ("p", "管理员进入综合素质测评填写系统后，先处理系统状态和基础数据，再导入学校来源成绩。班级端完成个人综测项目和审核小组签名后，管理员导出正式附件。"),
                        ("steps", [
                            "在系统入口选择“综合素质测评填写系统”。",
                            "进入系统设置，确认 2024-2025 学年处于启用状态，综测填写系统处于开放状态。",
                            "进入学生管理，维护年级、班级、班级类别和学生名单。",
                            "进入综测数据导入，导入学业成绩、体测与体育课成绩。",
                            "进入分数管理，按班级核对缺失项、总分和排名。",
                            "等待班长完成个人综测项目填写和综测审核小组签名。",
                            "进入附件导出，导出班级附件或按年级打包导出。",
                        ]),
                    ],
                },
                {
                    "title": "开启前需要准备的数据",
                    "blocks": [
                        ("table", [
                            ["数据", "来源", "系统用途"],
                            ["学生基础信息", "学院或班级名单", "生成学生账号、班级分组、分数归属和附件导出数据。"],
                            ["班级类别", "学院认定结果", "影响奖学金和荣誉称号筛选条件。"],
                            ["学业成绩", "教务系统成绩表", "系统读取 GPA，并生成学业学术素质分。"],
                            ["体测与体育课成绩", "体育相关成绩表", "生成体育基础分，并保存体测成绩、体育课成绩和社区表现分。"],
                        ]),
                        ("note", "平均绩点由系统按照“学业学术素质分 / 8 - 2.5”计算。申报补充信息模板内没有平均绩点字段，班级端无需收集该项。"),
                    ],
                },
                {
                    "title": "学校来源成绩导入",
                    "blocks": [
                        ("h3", "学业成绩"),
                        ("bullet", [
                            "上传教务系统导出的 Excel 文件。",
                            "系统读取学号、姓名和 GPA。",
                            "导入完成后，系统按“(GPA + 2.5) × 8”生成学业学术素质分。",
                            "失败记录显示学号不存在、姓名不一致或绩点格式错误时，应回到来源表修正后重新导入。",
                        ]),
                        ("h3", "体测与体育课成绩"),
                        ("bullet", [
                            "上传包含学号、姓名、体测成绩、体育课成绩、年级阶段和社区表现分的 Excel 文件。",
                            "大一和大二按“0.7 × 体测成绩 + 0.3 × 体育课成绩”生成体育基础分。",
                            "大三按体测成绩生成体育基础分。",
                            "社区表现分同步写入学生分数，用于奖学金与荣誉称号条件判断。",
                        ]),
                    ],
                },
                {
                    "title": "班级进度核对",
                    "blocks": [
                        ("p", "分数管理页面用于查看各班学生的各模块分数、总分和排名。管理员主要核对学校来源成绩是否完整，以及班级端是否已经完成个人综测项目填写。"),
                        ("bullet", [
                            "缺少学业学术素质分时，检查学业成绩导入记录。",
                            "缺少体育基础分或社区表现分时，检查体测与体育课成绩导入记录。",
                            "缺少德育测评、创新与实践能力、体育奖励分、美育、劳动教育、公益服务与社会工作、附加分时，通知班级端补充。",
                            "综测审核小组签名未完成时，申报系统会阻止该班提交申报。",
                        ]),
                    ],
                },
                {
                    "title": "附件导出与归档",
                    "blocks": [
                        ("table", [
                            ["导出材料", "导出位置", "内容"],
                            ["附件2", "附件导出", "学生综测分数、排名和班级审核信息。"],
                            ["附件4", "附件导出", "班级综测评审确认材料。"],
                            ["年级 ZIP", "附件导出", "同一年级多个班级附件打包文件。"],
                        ]),
                        ("note", "导出前检查学生名单、学校来源成绩、个人综测填写项和综测审核小组签名。导出后保留系统生成文件名，便于按年级和班级归档。"),
                    ],
                },
            ],
        },
        {
            "filename": "evaluation-monitor-guide",
            "system": "综合素质测评填写系统",
            "role": "班长",
            "lead": "完成本班个人综测项目收集、导入、核对和审核小组签名。",
            "sections": [
                {
                    "title": "进入系统后的处理顺序",
                    "blocks": [
                        ("steps", [
                            "在系统入口选择“综合素质测评填写系统”。",
                            "进入本班综测页面，查看学生名单和管理员已经导入的学校来源成绩。",
                            "维护综测审核小组成员，填写姓名和职务。",
                            "选择在线填写，或下载个人综测填写表模板后收集学生文件统一导入。",
                            "核对每名学生的分数、备注和缺失项。",
                            "组织审核小组成员在放大签名板中完成签名。",
                            "生成综测评审确认书后，本班综测评审状态变为完成。",
                        ]),
                    ],
                },
                {
                    "title": "两种填写方式",
                    "blocks": [
                        ("h3", "方式一：在线填写"),
                        ("bullet", [
                            "在本班综测页面打开学生记录。",
                            "逐项填写班级负责维护的分数和备注。",
                            "适合班级已经统一收齐材料，且班级负责人能够逐项录入的情况。",
                        ]),
                        ("h3", "方式二：收集学生填写表统一导入"),
                        ("bullet", [
                            "在综测数据导入页面下载“个人综测填写表模板”。",
                            "将模板发给学生，每名学生只填写本人学号、姓名、分数和备注。",
                            "收齐后放入同一个文件夹，在导入页面选择该文件夹。",
                            "系统逐个读取 Excel 文件，并显示导入成功数量和失败记录。",
                        ]),
                    ],
                },
                {
                    "title": "个人综测填写表填写规则",
                    "blocks": [
                        ("table", [
                            ["填写位置", "填写内容", "格式要求"],
                            ["第 1 行", "学号、姓名", "按照学生本人真实信息填写。"],
                            ["第 3 行", "各模块分数", "只填写数字，模板会限制满分和最小单位。"],
                            ["第 4 行", "备注", "写明加分依据、活动名称、获奖时间和证明材料来源。"],
                        ]),
                        ("table", [
                            ["模块", "满分", "填写说明"],
                            ["德育测评", "100", "填写德育测评分，整数填写。"],
                            ["创新与实践能力", "13", "按材料认定填写，保留 1 位小数。"],
                            ["体育奖励分", "3", "只填写体育奖励加分，体育基础分由管理员导入。"],
                            ["美育", "6", "按材料认定填写，最小单位 0.25。"],
                            ["劳动教育", "4", "按材料认定填写，整数填写。"],
                            ["公益服务与社会工作", "10", "按志愿服务、社会工作等材料填写，保留 1 位小数。"],
                            ["附加分", "5", "按附加分规则填写，最小单位 0.5。"],
                        ]),
                    ],
                },
                {
                    "title": "导入结果核对",
                    "blocks": [
                        ("bullet", [
                            "导入失败记录显示学号错误时，核对文件内学号和系统学生名单。",
                            "导入失败记录显示姓名错误时，核对学生姓名是否与系统一致。",
                            "导入失败记录显示学生不属于本班时，检查文件是否放入了其他班级学生表格。",
                            "分数超出范围或小数位错误时，回到 Excel 模板对应单元格修正。",
                        ]),
                    ],
                },
                {
                    "title": "综测审核小组签名",
                    "blocks": [
                        ("bullet", [
                            "在综测审核小组成员区域确认成员姓名和职务。",
                            "点击签名区域后进入放大签名板。",
                            "成员使用鼠标或触控板按下、拖动、松开完成书写。",
                            "签名位置跟随鼠标或触控板移动，写错后清空当前签名重新书写。",
                            "所有成员签名完成后生成综测评审确认书 PDF。",
                        ]),
                        ("note", "奖学金与荣誉称号申报提交前，系统会检查本班综测评审状态。状态未完成时，申报页面会阻止提交。"),
                    ],
                },
            ],
        },
        {
            "filename": "declaration-admin-guide",
            "system": "奖学金与荣誉称号申报系统",
            "role": "管理员",
            "lead": "完成申报基础数据导入、班级材料审核、获奖级别确认和汇总导出。",
            "sections": [
                {
                    "title": "开启申报系统前的准备",
                    "blocks": [
                        ("p", "管理员先导入外部奖项名单、院奖名额金额、先进班级名单和班长邮箱。完成这些数据后，班级端才能生成候选名单并提交申报。"),
                        ("table", [
                            ["数据", "导入入口", "作用"],
                            ["外部奖项名单", "申报数据导入", "只导入国家奖学金、国家励志奖学金和校级奖学金，用于奖项互斥。"],
                            ["院奖名额金额", "申报数据导入", "控制各班院级奖学金名额、金额和等级结构。"],
                            ["先进班级名单", "申报数据导入", "影响优秀学生干部班级推荐名额。"],
                            ["班长邮箱", "申报数据导入", "用于班长账号联系信息和邮件通知。"],
                        ]),
                        ("note", "奖项评选顺序为国家奖学金和国家励志奖学金、校级奖学金、院级奖学金和荣誉称号。外部奖项名单只需要导入国奖、国励和校奖。"),
                    ],
                },
                {
                    "title": "审核班级申报材料",
                    "blocks": [
                        ("steps", [
                            "进入申报审核页面，按班级查看提交状态。",
                            "打开班级申报记录，核对奖学金名单、荣誉称号名单和班长确认协议。",
                            "查看优秀学生和优秀学生干部的申报级别、推荐来源、任职情况和竞赛活动情况。",
                            "材料完整时确认通过，并填写最终获奖级别。",
                            "材料缺失或说明不清楚时退回修改，并填写修改意见。",
                        ]),
                    ],
                },
                {
                    "title": "荣誉称号审核规则",
                    "blocks": [
                        ("bullet", [
                            "荣誉称号分为优秀学生和优秀学生干部两个类型。",
                            "优秀学生没有名额限制，符合条件且班级已申报即可审核。",
                            "优秀学生干部默认班级推荐，班级也可选择学生会推荐。",
                            "学生会推荐不占用班级优秀学生干部名额。",
                            "班级填写的是申报级别，管理员审核通过时确认最终获奖级别。",
                        ]),
                        ("table", [
                            ["字段", "来源", "审核关注点"],
                            ["推荐来源", "申报补充信息模板", "班级推荐或学生会推荐。"],
                            ["申报级别", "申报补充信息模板", "校级或院级。"],
                            ["任职情况", "申报补充信息模板", "岗位、任期和考核情况是否清楚。"],
                            ["科技作品竞赛活动", "申报补充信息模板", "竞赛名称、时间、级别和获奖情况是否清楚。"],
                        ]),
                    ],
                },
                {
                    "title": "标签视图与材料核对",
                    "blocks": [
                        ("p", "标签视图支持查看全部、按班级查看、按奖项查看。管理员可通过标签快速确认学生是否已有国奖、国励、校奖、院奖或荣誉称号记录。"),
                        ("bullet", [
                            "查看全部，用于检查所有申报标签和审核标签。",
                            "按班级查看，用于核对单个班级是否存在超额或遗漏。",
                            "按奖项查看，用于核对奖项顺序和互斥关系。",
                        ]),
                    ],
                },
                {
                    "title": "申报材料导出",
                    "blocks": [
                        ("p", "全部班级审核通过后，进入申报材料导出页面导出汇总材料。附件2使用原始表格模板，系统按照模板列写入院级奖学金、优秀学生干部、优秀学生数据。"),
                        ("table", [
                            ["导出文件", "内容"],
                            ["附件2.2024-2025学年院级奖学金、优秀学生干部、优秀学生汇总表【含填报说明】", "院级奖学金、优秀学生干部、优秀学生汇总数据和模板说明。"],
                            ["申报明细", "班级申报记录、学生材料、审核状态。"],
                            ["院奖分配", "各班名额、金额和等级分配情况。"],
                            ["邮件发送记录", "通知邮件发送时间、收件人和状态。"],
                        ]),
                        ("note", "平均绩点由系统按照“学业学术素质分 / 8 - 2.5”生成。任职情况、科技作品竞赛活动、推荐来源等信息来自班级申报或申报补充信息模板。"),
                    ],
                },
            ],
        },
        {
            "filename": "declaration-monitor-guide",
            "system": "奖学金与荣誉称号申报系统",
            "role": "班长",
            "lead": "完成申报补充信息导入、奖学金申报、荣誉称号申报和班长确认签名。",
            "sections": [
                {
                    "title": "进入系统后的处理顺序",
                    "blocks": [
                        ("steps", [
                            "在系统入口选择“奖学金与荣誉称号申报系统”。",
                            "确认本班综测评审状态已经完成。",
                            "进入申报数据导入页面，下载并填写申报补充信息模板。",
                            "导入申报补充信息后，进入奖学金申报页面核对候选名单。",
                            "进入荣誉称号申报页面，选择优秀学生或优秀学生干部。",
                            "完成班长确认项并签署班长确认协议。",
                            "提交后在提交记录中查看审核状态和退回意见。",
                        ]),
                    ],
                },
                {
                    "title": "申报补充信息模板填写",
                    "blocks": [
                        ("table", [
                            ["字段", "填写内容"],
                            ["性别", "选择男或女。"],
                            ["处分情况", "选择无或有。"],
                            ["是否申报优秀学生", "学生本人愿意申报时选择是。"],
                            ["优秀学生申报级别", "选择校级或院级。"],
                            ["是否申报优秀学生干部", "学生本人愿意申报时选择是。"],
                            ["优秀学生干部推荐来源", "选择班级推荐或学生会推荐。"],
                            ["优秀学生干部申报级别", "选择校级或院级。"],
                            ["任职情况", "填写 2024-2025 学年任职岗位、任期和考核情况。"],
                            ["科技作品竞赛活动情况", "填写竞赛名称、时间、级别和获奖情况。"],
                            ["备注", "境外生填写生源地，其他特殊情况也写在备注中。"],
                        ]),
                        ("note", "平均绩点无需填写，系统会按照综测中的学业学术素质分自动计算。"),
                    ],
                },
                {
                    "title": "奖学金申报",
                    "blocks": [
                        ("bullet", [
                            "奖学金候选名单由系统按照综测分数、排名、德育分、体测成绩、社区表现分和外部奖项标签筛选。",
                            "页面会显示院奖名额、可支配金额、推荐人数和推荐金额。",
                            "未通过条件的学生会显示原因，页面无法勾选提交。",
                            "名单确认后完成班长确认项，并签署班长确认协议。",
                            "提交后等待管理员审核，退回时按照意见修正后重新提交。",
                        ]),
                        ("note", "外部奖项标签只包含国家奖学金、国家励志奖学金和校级奖学金。院级奖学金申报会自动避开已经获得更高顺序奖项的学生。"),
                    ],
                },
                {
                    "title": "荣誉称号申报",
                    "blocks": [
                        ("bullet", [
                            "荣誉称号分为优秀学生和优秀学生干部两个类型。",
                            "优秀学生没有名额限制，符合条件且本人愿意即可申报。",
                            "优秀学生干部默认班级推荐，也可选择学生会推荐。",
                            "学生会推荐不占用班级优秀学生干部名额。",
                            "班级推荐优秀学生干部名额受先进班级记录影响，系统提交时会自动校验。",
                            "班级填写申报级别，最终获奖级别由管理员审核通过时确认。",
                        ]),
                    ],
                },
                {
                    "title": "班长确认协议签名",
                    "blocks": [
                        ("bullet", [
                            "奖学金申报和荣誉称号申报均需要完成班长确认项。",
                            "点击签名区域后进入放大签名板。",
                            "使用鼠标或触控板按下、拖动、松开完成签名。",
                            "确认协议生成后，提交记录中会显示对应 PDF 材料。",
                        ]),
                        ("note", "任职情况和科技作品竞赛活动情况应写清楚时间、岗位、奖项等级和证明材料来源，避免审核退回。"),
                    ],
                },
            ],
        },
    ]


def find_tectonic() -> str:
    env_path = os.environ.get("TECTONIC")
    candidates = [
        env_path,
        shutil.which("tectonic"),
        r"C:\tmp\tectonic\tectonic.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return str(candidate)
    raise RuntimeError("未找到 LaTeX 编译器 tectonic。请设置 TECTONIC 环境变量或将 tectonic 加入 PATH。")


def compile_tex(tex_path: Path) -> Path:
    tectonic = find_tectonic()
    result = subprocess.run(
        [tectonic, "--keep-logs", "--outdir", str(BUILD_DIR), tex_path.name],
        cwd=tex_path.parent,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if result.returncode != 0:
        raise RuntimeError(f"LaTeX 编译失败：{tex_path.name}\n{result.stdout}")
    return BUILD_DIR / f"{tex_path.stem}.pdf"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(LOGO_PATH, BUILD_DIR / "logo.png")

    for guide in guides():
        tex_path = BUILD_DIR / f"{guide['filename']}.tex"
        tex_path.write_text(render_guide(guide), encoding="utf-8")
        pdf_path = compile_tex(tex_path)
        output_path = OUT_DIR / f"{guide['filename']}.pdf"
        shutil.copyfile(pdf_path, output_path)
        print(output_path)


if __name__ == "__main__":
    main()
