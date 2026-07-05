"""生成四份操作指南 PDF。

内容与排版定义在本文件中,使用 tectonic(XeLaTeX 引擎)编译,
输出到 packages/frontend/public/guides/ 供前端页面内预览与下载。

用法:
    python scripts/generate_guides.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "packages" / "frontend" / "public" / "guides"
BUILD_DIR = ROOT / "scripts" / ".guide-build"
LOGO_PATH = ROOT / "packages" / "frontend" / "public" / "academic-dept-logo.png"

ACADEMIC_YEAR = "2024-2025 学年"
REVISION = "2026 年 7 月"
ORG_NAME = "计算机科学与技术学院学术部"
SYSTEM_EN = r"HQU-CEAS \textperiodcentered{} Comprehensive Evaluation \& Awards System"


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


PREAMBLE = r"""\documentclass[11pt,a4paper]{article}
\usepackage[a4paper,left=26mm,right=26mm,top=25mm,bottom=27mm,headsep=7mm]{geometry}
\usepackage{fontspec}
\usepackage{xeCJK}
\usepackage{graphicx}
\usepackage[table]{xcolor}
\usepackage{array}
\usepackage{tabularx}
\usepackage{booktabs}
\usepackage{enumitem}
\usepackage{fancyhdr}
\usepackage{titlesec}
\usepackage{setspace}
\usepackage{hyperref}
\definecolor{GuidePaper}{HTML}{F7F4ED}
\definecolor{GuideText}{HTML}{211B18}
\definecolor{GuideMuted}{HTML}{6B6259}
\definecolor{GuideLine}{HTML}{D8D0C2}
\definecolor{GuideBlock}{HTML}{EDE7DB}
\definecolor{GuideAccent}{HTML}{8C4A2E}
\definecolor{GuideWarn}{HTML}{A63A2B}
\hypersetup{hidelinks,pdftitle={__PDFTITLE__},pdfauthor={华侨大学计算机科学与技术学院学术部},pdfsubject={HQU-CEAS 操作指南},pdfcreator={HQU-CEAS guide generator (tectonic/XeLaTeX)}}
\pagecolor{GuidePaper}
\setmainfont{Times New Roman}
\setsansfont{Arial}
\setmonofont{Consolas}
\setCJKmainfont{SimSun}[BoldFont={SimHei}]
\setCJKsansfont{Microsoft YaHei}
\XeTeXlinebreaklocale "zh"
\XeTeXlinebreakskip = 0pt plus 1pt
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.62em}
\setstretch{1.32}
\raggedbottom
\color{GuideText}
\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0.5pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{GuideLine}\leaders\hrule height \headrulewidth\hfill}}
\renewcommand{\footrulewidth}{0.5pt}
\renewcommand{\footrule}{\hbox to\headwidth{\color{GuideLine}\leaders\hrule height \footrulewidth\hfill}}
\fancyhead[L]{\footnotesize\sffamily\color{GuideMuted}__HEADERLEFT__}
\fancyhead[R]{\footnotesize\sffamily\color{GuideMuted}HQU-CEAS}
\fancyfoot[L]{\footnotesize\color{GuideMuted}__ORGNAME__制作}
\fancyfoot[R]{\footnotesize\color{GuideMuted}第 \thepage\ 页}
\setlist[itemize]{leftmargin=1.7em,itemsep=0.28em,topsep=0.2em,label={\color{GuideAccent}\raisebox{0.14ex}{\small\textbullet}}}
\setlist[enumerate]{leftmargin=2.0em,itemsep=0.34em,topsep=0.25em,label={\sffamily\bfseries\color{GuideAccent}\arabic*.}}
\newcolumntype{Y}{>{\raggedright\arraybackslash}X}
\newcommand{\thinrule}{\par\noindent{\color{GuideLine}\rule{\linewidth}{0.5pt}}\par}
\newcommand{\guidesection}[3]{\filbreak\par\vspace{1.5em}\phantomsection\label{#3}{\noindent\sffamily\bfseries\LARGE{\color{GuideAccent}#1}\hspace{0.6em}{\color{GuideText}#2}\par}\vspace{0.45em}{\noindent\color{GuideLine}\rule{\linewidth}{0.6pt}}\par\vspace{0.55em}}
\newcommand{\guidesub}[1]{\par\vspace{0.75em}{\noindent\sffamily\bfseries\large{\color{GuideAccent}\rule[0.08em]{0.5em}{0.5em}}\hspace{0.55em}#1\par}\vspace{0.1em}}
\newcommand{\tocline}[3]{\noindent{\sffamily\bfseries\color{GuideAccent}#1}\hspace{1.2em}{\sffamily #2}\ \textcolor{GuideLine}{\leaders\hbox to 0.62em{\hss.\hss}\hfill}\ {\sffamily\color{GuideMuted}#3}\par\vspace{0.72em}}
\newcommand{\covermetarow}[2]{\makebox[24mm][l]{{\color{GuideMuted}\sffamily\small #1}}&{\small #2}\\[0.35em]}
\newsavebox{\calloutsavebox}
\newcommand{\callout}[3]{\par\medskip\noindent
\begin{lrbox}{\calloutsavebox}\begin{minipage}{\dimexpr\linewidth-28pt\relax}\small
{\sffamily\bfseries\color{#1}#2}\hspace{0.8em}#3\end{minipage}\end{lrbox}%
{\setlength{\fboxsep}{0pt}%
\colorbox{GuideBlock}{{\color{#1}\rule[\dimexpr-\dp\calloutsavebox-11pt\relax]{3pt}{\dimexpr\ht\calloutsavebox+\dp\calloutsavebox+22pt\relax}}\hspace{11pt}\raisebox{0pt}[\dimexpr\ht\calloutsavebox+11pt\relax][\dimexpr\dp\calloutsavebox+11pt\relax]{\usebox{\calloutsavebox}}\hspace{11pt}}}\par\medskip}
\begin{document}
"""


def begin_document(pdf_title: str, header_left_tex: str) -> str:
    return (
        PREAMBLE
        .replace("__PDFTITLE__", escape_tex(pdf_title))
        .replace("__HEADERLEFT__", header_left_tex)
        .replace("__ORGNAME__", escape_tex(ORG_NAME))
    )


def end_document() -> str:
    return r"\end{document}" + "\n"


def cover(guide: dict) -> str:
    title = f"{guide['system']}：{guide['role']}操作指南"
    return rf"""
\pdfbookmark[1]{{{escape_tex(title)}}}{{cover}}
\begin{{titlepage}}
\thispagestyle{{empty}}
\vspace*{{2mm}}
\noindent\begin{{minipage}}[c]{{15mm}}\includegraphics[width=12.5mm]{{logo.png}}\end{{minipage}}%
\begin{{minipage}}[c]{{\dimexpr\linewidth-15mm\relax}}
{{\sffamily\bfseries 华侨大学计算机科学与技术学院}}\\[1.5pt]
{{\footnotesize\sffamily\color{{GuideMuted}}College of Computer Science and Technology, Huaqiao University}}
\end{{minipage}}
\par\vspace{{4mm}}
\thinrule
\vspace*{{30mm}}
{{\noindent\sffamily\bfseries\color{{GuideAccent}}\large {escape_tex(guide['system'])}\par}}
\vspace{{5mm}}
{{\noindent\fontsize{{34}}{{46}}\selectfont\sffamily\bfseries {escape_tex(guide['role'])}操作指南\par}}
\vspace{{7mm}}
{{\noindent\color{{GuideAccent}}\rule{{26mm}}{{1.8pt}}\par}}
\vspace{{8mm}}
{{\noindent\large\color{{GuideMuted}}{escape_tex(guide['lead'])}\par}}
\vfill
\noindent{{\setlength{{\fboxsep}}{{14pt}}\colorbox{{GuideBlock}}{{\begin{{minipage}}{{\dimexpr\linewidth-28pt\relax}}
\begin{{tabular}}{{@{{}}l@{{\hspace{{5mm}}}}l@{{}}}}
\covermetarow{{适用系统}}{{{escape_tex(guide['system'])}}}
\covermetarow{{适用角色}}{{{escape_tex(guide['role'])}}}
\covermetarow{{适用学年}}{{{escape_tex(ACADEMIC_YEAR)}}}
\covermetarow{{编制单位}}{{{escape_tex(ORG_NAME)}}}
\makebox[24mm][l]{{{{\color{{GuideMuted}}\sffamily\small 修订时间}}}}&{{\small {escape_tex(REVISION)}}}
\end{{tabular}}
\end{{minipage}}}}}}
\vspace{{6mm}}
\thinrule
\vspace{{2mm}}
{{\noindent\footnotesize\color{{GuideMuted}}\sffamily {SYSTEM_EN}\hfill 页面内容以系统实际显示为准，材料归档以导出的正式文件为准\par}}
\end{{titlepage}}
\setcounter{{page}}{{1}}
"""


def toc(guide: dict) -> str:
    lines = [
        r"\pdfbookmark[1]{目录}{toc}",
        r"{\noindent\sffamily\bfseries\LARGE 目录\par}",
        r"\vspace{0.45em}",
        r"{\noindent\color{GuideLine}\rule{\linewidth}{0.6pt}}\par",
        r"\vspace{1.2em}",
    ]
    for index, section in enumerate(guide["sections"], start=1):
        lines.append(
            rf"\tocline{{{index:02d}}}{{{escape_tex(section['title'])}}}{{\pageref{{sec:{index}}}}}"
        )
    lines.append(r"\newpage")
    return "\n".join(lines) + "\n"


def paragraph(text: str) -> str:
    return escape_tex(text) + "\n\n"


def bullet(items: list[str]) -> str:
    body = "\n".join(rf"\item {escape_tex(item)}" for item in items)
    return "\\begin{itemize}\n" + body + "\n\\end{itemize}\n\n"


def steps(items: list[str]) -> str:
    body = "\n".join(rf"\item {escape_tex(item)}" for item in items)
    return "\\begin{enumerate}\n" + body + "\n\\end{enumerate}\n\n"


def note(text: str) -> str:
    return rf"\callout{{GuideAccent}}{{提示}}{{{escape_tex(text)}}}" + "\n\n"


def warn(text: str) -> str:
    return rf"\callout{{GuideWarn}}{{注意}}{{{escape_tex(text)}}}" + "\n\n"


def subheading(text: str) -> str:
    return rf"\guidesub{{{escape_tex(text)}}}" + "\n"


def table(rows: list[list[str]]) -> str:
    column_count = len(rows[0])
    columns = "@{}" + "Y" * column_count + "@{}"
    lines = [
        r"\par\medskip",
        r"{\small\renewcommand{\arraystretch}{1.42}%",
        rf"\begin{{tabularx}}{{\linewidth}}{{{columns}}}",
        r"\rowcolor{GuideBlock}",
        " & ".join(rf"{{\sffamily\bfseries {escape_tex(cell)}}}" for cell in rows[0]) + r" \\",
        r"\midrule",
    ]
    for row in rows[1:]:
        lines.append(" & ".join(escape_tex(cell) for cell in row) + r" \\")
    lines.append(r"\bottomrule")
    lines.append(r"\end{tabularx}}")
    lines.append(r"\par\medskip")
    return "\n".join(lines) + "\n\n"


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
    if kind == "warn":
        return warn(value)
    if kind == "table":
        return table(value)
    raise ValueError(f"未知内容块：{kind}")


def render_guide(guide: dict) -> str:
    pdf_title = f"{guide['system']}：{guide['role']}操作指南"
    header_left_tex = (
        escape_tex(guide["system"])
        + r"\hspace{0.4em}\textperiodcentered\hspace{0.4em}"
        + escape_tex(f"{guide['role']}操作指南")
    )
    parts = [begin_document(pdf_title, header_left_tex), cover(guide), toc(guide)]
    for index, section in enumerate(guide["sections"], start=1):
        title = escape_tex(section["title"])
        parts.append(rf"\pdfbookmark[1]{{{index}. {title}}}{{sec{index}}}" + "\n")
        parts.append(rf"\guidesection{{{index:02d}}}{{{title}}}{{sec:{index}}}" + "\n")
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
            "lead": "完成基础数据准备、学校来源成绩导入、班级进度核对和附件导出。",
            "sections": [
                {
                    "title": "进入系统后的处理顺序",
                    "blocks": [
                        ("p", "管理员进入综合素质测评填写系统后，先处理系统状态和基础数据，再导入学校来源成绩。班级端完成个人综测项目填写和审核小组签名后，管理员导出正式附件。"),
                        ("steps", [
                            "在系统入口选择“综合素质测评填写系统”。",
                            "进入“系统设置”，确认当前学年处于启用状态，综测填写系统处于开放状态。",
                            "进入“学生管理”，维护年级、班级、班级类别和学生名单。",
                            "进入“数据导入”，导入学业成绩、体测与体育课成绩。",
                            "进入“分数管理”，按班级核对缺失项、总分和排名；整体进度可在“综测总览”查看。",
                            "等待班级端完成个人综测项目填写和综测审核小组签名。",
                            "进入“附件导出”，导出班级附件或按年级打包导出。",
                        ]),
                        ("note", "班级端的填写与审核不需要管理员代办，但综测审核小组签名未完成的班级，后续在申报系统中无法提交奖学金与荣誉称号申报。"),
                    ],
                },
                {
                    "title": "开启前需要准备的数据",
                    "blocks": [
                        ("table", [
                            ["数据", "来源", "系统用途"],
                            ["学生基础信息", "学院或班级名单", "生成学生账号、班级分组、分数归属和附件导出数据。"],
                            ["班级类别", "学院认定结果", "影响奖学金和荣誉称号的筛选条件。"],
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
                            "上传教务系统导出的 Excel 成绩表，系统读取学号、姓名和 F 列 GPA。",
                            "导入完成后，系统按“(GPA + 2.5) × 8”生成学业学术素质分。",
                            "失败记录显示学号不存在、姓名不一致或绩点格式错误时，回到来源表修正后重新导入。",
                        ]),
                        ("h3", "体测与体育课成绩"),
                        ("bullet", [
                            "上传包含学号、姓名、体测成绩、体育课成绩、年级阶段和社区表现分的 Excel 文件。",
                            "大一、大二按“0.7 × 体测成绩 + 0.3 × 体育课成绩”生成体育基础分。",
                            "大三按体测成绩生成体育基础分。",
                            "社区表现分同步写入学生分数，用于奖学金与荣誉称号条件判断。",
                        ]),
                        ("note", "“个人综测填写表”通常由班长在“数据导入”页面导入，管理员也可以代为导入；导入失败明细可在“附件导出”页面下载。"),
                    ],
                },
                {
                    "title": "班级进度核对",
                    "blocks": [
                        ("p", "“分数管理”页面用于查看各班学生的各模块分数、总分和排名。管理员主要核对学校来源成绩是否完整，以及班级端是否已经完成个人综测项目填写。"),
                        ("bullet", [
                            "缺少学业学术素质分时，检查学业成绩导入记录。",
                            "缺少体育基础分或社区表现分时，检查体测与体育课成绩导入记录。",
                            "缺少德育测评、创新与实践能力、体育奖励分、美育、劳动教育、公益服务与社会工作、附加分时，通知班级端补充。",
                            "点击可编辑分数的明细入口，可查看班级登记的逐条加分事项。",
                        ]),
                        ("warn", "综测审核小组签名未完成时，申报系统会阻止该班提交申报，请在导出附件前逐班确认审核状态。"),
                    ],
                },
                {
                    "title": "附件导出与归档",
                    "blocks": [
                        ("table", [
                            ["导出材料", "导出位置", "内容"],
                            ["附件2", "附件导出", "学生综测分数、排名和班级审核信息。"],
                            ["附件4", "附件导出", "班级综测评审确认材料。"],
                            ["年级 ZIP", "附件导出", "同一年级多个班级附件的打包文件。"],
                        ]),
                        ("note", "附件由系统按官方模板自动填充，导出前检查学生名单、学校来源成绩、个人综测填写项和综测审核小组签名；导出后保留系统生成的文件名，便于按年级和班级归档。"),
                    ],
                },
            ],
        },
        {
            "filename": "evaluation-monitor-guide",
            "system": "综合素质测评填写系统",
            "role": "班长",
            "lead": "完成本班加分明细收集、填写或导入、核对，以及审核小组邀请与签名。",
            "sections": [
                {
                    "title": "进入系统后的处理顺序",
                    "blocks": [
                        ("steps", [
                            "在系统入口选择“综合素质测评填写系统”。",
                            "进入“本班综测总览”，查看本班数据准备情况。",
                            "进入“本班综测”，查看学生名单和管理员已导入的学校来源成绩。",
                            "选择在线逐条登记加分明细，或在“数据导入”下载个人综测填写表模板、收齐后统一导入。",
                            "核对每名学生的分数、加分明细和缺失项。",
                            "进入“审核小组确认”，维护成员、发送审核邀请链接，完成核对与签名。",
                            "全部成员签名后，系统生成综测评审确认书，本班综测评审状态变为完成。",
                        ]),
                    ],
                },
                {
                    "title": "两种填写方式",
                    "blocks": [
                        ("h3", "方式一：在线逐条登记加分明细"),
                        ("bullet", [
                            "在“本班综测”页面打开学生分数格的加分明细入口。",
                            "逐条填写加分事项和对应分数，系统自动合计并写入该模块分数。",
                            "适合班级已统一收齐材料，由班长逐项录入的情况。",
                        ]),
                        ("h3", "方式二：发放个人综测填写表统一导入"),
                        ("bullet", [
                            "在“数据导入”页面下载“个人综测填写表模板”。",
                            "把模板发给学生，每名学生一份 Excel 文件，只填写本人信息和加分明细。",
                            "收齐后在“数据导入”页面选择“个人综测填写表”，一次选择多个文件导入。",
                            "系统逐个读取文件，显示导入成功数量和失败记录。",
                        ]),
                    ],
                },
                {
                    "title": "个人综测填写表结构与填写规则",
                    "blocks": [
                        ("p", "个人综测填写表为多工作表结构：一个“学生信息”工作表加七个模块工作表。学生先在“学生信息”页填写学号和姓名，再进入各模块工作表逐条填写加分明细。"),
                        ("table", [
                            ["填写位置", "填写内容", "格式要求"],
                            ["“学生信息”页高亮单元格", "学号、姓名", "与系统内学生信息保持一致，导入时用于匹配学生。"],
                            ["模块工作表第 5-19 行 A 列", "加分事项", "每行一条，100 字以内，写明活动名称、时间、级别和获奖情况。"],
                            ["模块工作表第 5-19 行 B 列", "加分分数", "只填数字，受满分和最小单位限制，各行合计不能超过模块满分。"],
                            ["第 20 行合计、第 21 行检查结果", "无需填写", "由公式自动计算，检查结果提示不通过时回到明细修正。"],
                        ]),
                        ("table", [
                            ["模块工作表", "满分", "填写说明"],
                            ["德育测评", "100", "思想品德、纪律表现、集体活动等加分事项。"],
                            ["创新与实践能力", "13", "科研训练、竞赛、项目、论文、专利等，保留 1 位小数。"],
                            ["体育奖励分", "3", "运动会、体育竞赛获奖等；体育基础分由管理员导入，无需填写。"],
                            ["美育", "6", "文艺活动、艺术作品、展演比赛等，最小单位 0.25。"],
                            ["劳动教育", "4", "劳动实践、志愿劳动、宿舍劳动等，整数填写。"],
                            ["公益服务与社会工作", "10", "志愿服务、社会工作、班团工作等，保留 1 位小数。"],
                            ["附加分", "5", "符合学院附加分认定要求的事项，最小单位 0.5。"],
                        ]),
                        ("warn", "不要修改工作表名称、表头结构和公式行，否则导入时无法识别；每个模块工作表最多登记 15 条加分明细。"),
                    ],
                },
                {
                    "title": "导入结果核对",
                    "blocks": [
                        ("bullet", [
                            "失败记录显示学号错误时，核对文件内学号与系统学生名单。",
                            "失败记录显示姓名错误时，核对学生姓名是否与系统一致。",
                            "失败记录显示学生不属于本班时，检查是否混入了其他班级学生的表格。",
                            "分数超出范围或小数位错误时，回到 Excel 模板对应单元格修正后重新导入。",
                            "导入成功后回到“本班综测”，抽查加分明细与总分是否符合预期。",
                        ]),
                    ],
                },
                {
                    "title": "审核小组邀请、核对与签名",
                    "blocks": [
                        ("p", "“审核小组确认”页面完成班级内部综测审核：维护成员、发送审核邀请链接、跟踪核对进度、采集签名并生成确认书。"),
                        ("steps", [
                            "维护审核小组成员姓名和职务（系统默认提供班长、团支书、学习委员三类，可按实际调整），点击“保存成员”。",
                            "为每位成员生成审核邀请链接并复制发送；链接一人一条，成员首次登录后绑定当前访问设备。",
                            "成员打开链接进入“综测评审核对”页，逐名核对学生分数和加分明细，标记已核对或填写问题说明。",
                            "在“学生审核状态汇总”查看每名学生在各成员处的核对进度，在“班级操作日志”查看邀请、登录、核对和签名记录。",
                            "成员在核对页完成“本人签名”，也可以由班长在成员卡片的签名板中当面采集签名。",
                            "全部成员签名完成后，系统生成综测评审确认书 PDF，可在页面直接下载。",
                        ]),
                        ("warn", "奖学金与荣誉称号申报提交前，系统会检查本班综测评审状态；状态未完成时，申报页面会阻止提交。"),
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
                        ("p", "管理员先在“申报数据导入”页面导入外部奖项名单、院奖名额金额、先进班级名单和班长邮箱。完成这些数据后，班级端才能生成候选名单并提交申报。"),
                        ("table", [
                            ["数据", "导入入口", "作用"],
                            ["外部奖项名单", "申报数据导入", "只导入国家奖学金、国家励志奖学金和校级奖学金，用于奖项互斥。"],
                            ["院奖名额金额", "申报数据导入", "控制各班院级奖学金名额、金额和等级结构。"],
                            ["先进班级名单", "申报数据导入", "影响优秀学生干部的班级推荐名额。"],
                            ["班长邮箱", "申报数据导入", "用于班长账号联系信息和邮件通知。"],
                        ]),
                        ("p", "需要向班长发送账号或申报通知时，先在“邮箱配置”完成发件邮箱设置，并在“邮件模板”维护通知内容；发送记录可在对应页面查看。"),
                        ("note", "奖项评选顺序为：国家奖学金和国家励志奖学金、校级奖学金、院级奖学金和荣誉称号。外部奖项名单只需要导入国奖、国励和校奖。"),
                    ],
                },
                {
                    "title": "审核班级申报材料",
                    "blocks": [
                        ("steps", [
                            "进入“申报审核”页面，按班级查看提交状态。",
                            "打开班级申报记录，核对奖学金名单、荣誉称号名单和班长确认协议 PDF。",
                            "查看优秀学生和优秀学生干部的申报级别、推荐来源、任职情况和竞赛活动情况。",
                            "材料完整时确认通过，并填写最终获奖级别。",
                            "材料缺失或说明不清楚时退回修改，并填写修改意见；退回后班级端修正重新提交。",
                        ]),
                        ("note", "审核通过后，系统会为申报学生写入申报通过标签，标签可在“标签视图”按班级或按奖项核对。"),
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
                        ("p", "“标签视图”支持查看全部、按班级查看、按奖项查看。管理员可通过标签快速确认学生是否已有国奖、国励、校奖、院奖或荣誉称号记录。"),
                        ("bullet", [
                            "查看全部：检查所有申报标签和审核标签。",
                            "按班级查看：核对单个班级是否存在超额或遗漏。",
                            "按奖项查看：核对奖项顺序和互斥关系。",
                        ]),
                    ],
                },
                {
                    "title": "申报材料导出",
                    "blocks": [
                        ("p", "全部班级审核通过后，进入“申报材料导出”页面导出汇总材料。附件2使用学院原始表格模板，系统按照模板列写入院级奖学金、优秀学生干部、优秀学生数据。"),
                        ("table", [
                            ["导出文件", "内容"],
                            ["附件2 申报汇总表", "院级奖学金、优秀学生干部、优秀学生汇总数据和模板说明。"],
                            ["申报明细", "班级申报记录、学生材料、审核状态。"],
                            ["院奖分配", "各班名额、金额和等级分配情况。"],
                            ["邮件发送记录", "通知邮件发送时间、收件人和状态。"],
                        ]),
                        ("note", "平均绩点由系统按照“学业学术素质分 / 8 - 2.5”生成；任职情况、科技作品竞赛活动、推荐来源等信息来自班级申报和申报补充信息模板。"),
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
                            "确认本班综测评审状态已经完成（未完成时先回综测系统完成审核小组签名）。",
                            "进入“申报数据导入”页面，下载并填写申报补充信息模板后导入。",
                            "进入“奖学金申报”页面，核对候选名单并选择申报学生。",
                            "进入“荣誉称号”页面，选择优秀学生或优秀学生干部并完善材料说明。",
                            "完成班长确认项并签署班长确认协议后提交。",
                            "在“提交记录”查看审核状态、退回意见和确认协议 PDF。",
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
                            ["任职情况", "填写本学年任职岗位、任期和考核情况。"],
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
                            "候选名单由系统按综测分数、排名、德育分、体育基础分、社区表现分和外部奖项标签自动筛选。",
                            "页面显示院奖名额、可支配金额、推荐人数和推荐金额，提交前系统自动校验名额与金额限制。",
                            "未通过条件的学生会显示原因，页面不允许勾选提交。",
                            "名单确认后完成班长确认项，并在签名板签署班长确认协议。",
                            "提交后等待管理员审核，退回时按照意见修正后重新提交。",
                        ]),
                        ("note", "外部奖项标签只包含国家奖学金、国家励志奖学金和校级奖学金；院级奖学金申报会自动避开已获得更高顺序奖项的学生。"),
                    ],
                },
                {
                    "title": "荣誉称号申报",
                    "blocks": [
                        ("bullet", [
                            "荣誉称号分为优秀学生和优秀学生干部两个类型。",
                            "优秀学生没有名额限制，符合条件且本人愿意即可申报。",
                            "优秀学生干部默认班级推荐，也可选择学生会推荐；学生会推荐不占用班级名额。",
                            "班级推荐优秀学生干部名额受先进班级记录影响，提交时系统自动校验。",
                            "班级填写申报级别，最终获奖级别由管理员审核通过时确认。",
                        ]),
                    ],
                },
                {
                    "title": "班长确认协议签名",
                    "blocks": [
                        ("steps", [
                            "奖学金申报和荣誉称号申报分别完成各自的班长确认项。",
                            "点击签名区域进入放大签名板，使用鼠标或触控板按下、拖动、松开完成签名；写错可清空重写。",
                            "提交申报批次时系统生成班长确认协议 PDF 并归档。",
                            "在“提交记录”页面查看每次提交对应的确认协议和审核状态。",
                        ]),
                        ("warn", "任职情况和科技作品竞赛活动情况应写清楚时间、岗位、奖项等级和证明材料来源，说明不清楚是审核退回的主要原因。"),
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
