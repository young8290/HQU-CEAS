const fs = require('fs');
const path = require('path');
const outDir = path.resolve(__dirname);

const theme = {
  bg: '#f7f2ea',
  bg2: '#fbfaf7',
  surface: '#fffdf9',
  surfaceSoft: '#f4eee6',
  ink: '#2d2722',
  text: '#4b4038',
  muted: '#81766d',
  faint: '#b9aea4',
  border: '#e3d8cc',
  border2: '#d3c5b8',
  accent: '#b86445',
  accent2: '#d99672',
  green: '#5f7d61',
  amber: '#a56d2b',
  red: '#a3504d',
  blue: '#5d718f'
};

const prompts = {
  login: 'Claude-style warm minimalist Chinese university admin login page for HQU comprehensive evaluation and award declaration system, 1440x1024 desktop web UI, warm ivory background, terracotta accent, precise typography, single login panel, understated institutional wordmark, no decorative gradients, no emoji, clean form labels, calm academic administration mood.',
  entry: 'Claude-style system entry page for a university student affairs web app, two system options for comprehensive evaluation and scholarship honor declaration, warm minimal surfaces, slim borders, status chips, clear admin/monitor context, 1440x1024 desktop UI, no marketing hero, no stock images, no emoji.',
  dashboard: 'Claude-style admin dashboard for scholarship and honor declaration, dense but calm metrics, pending applications, import status, review reminders, warm ivory background, terracotta highlights, fine-line cards, table-first layout, 1440x1024 desktop web UI, Chinese labels.',
  monitorDashboard: 'Claude-style class monitor dashboard for a Chinese university scholarship and honor declaration system, monitor-only navigation, class-only tasks, class comprehensive score review, scholarship declaration progress, honor declaration progress, agreement signature status, warm ivory Claude-style minimal dashboard, 1440x1024 desktop web UI, no admin-only import or audit modules.',
  import: 'Claude-style import and template center for student affairs admin panel, structured upload modules for scores, physical test, community score, national award lists, quota tables, monitor email, warm minimalist visual system, 1440x1024 desktop UI, no clutter.',
  scores: 'Claude-style class comprehensive evaluation score review page, spreadsheet-like table with moral score, academic score, physical test score, PE course score, community score, total rank, review group handwritten signature or uploaded e-signature panel, PDF confirmation status, warm minimal admin UI, 1440x1024 desktop.',
  scholarship: 'Claude-style monitor scholarship declaration page, class-based application flow, candidate table, eligibility chips, quota and budget panel, handwritten signature pad, upload electronic signature image, agreement PDF generation status, warm minimal Chinese dashboard, 1440x1024 desktop UI.',
  honor: 'Claude-style honor title declaration page, candidate list for excellent student and excellent student cadre, student intention, cadre material notes, activity proof status, confirmation checklist, handwritten signature capture, generated PDF archive status, warm minimal Chinese university UI, 1440x1024 desktop.',
  review: 'Claude-style admin application review inbox, all class scholarship and honor submissions, status filters, review detail panel, signed class declaration agreement PDF preview, checklist and material notes, class comprehensive score review shown as a separate completed source status, return/pass actions, understated institutional dashboard, 1440x1024 desktop UI.',
  allocation: 'Claude-style college scholarship allocation page, quota and budget constraints, first second third award pyramid rule, auto allocation preview, budget usage bars, candidate ranking table, warm minimal data-heavy UI, 1440x1024 desktop.',
  accounts: 'Claude-style account and email management page for monitor accounts, NetEase academic department mailbox SMTP configuration, editable email templates, template variables, send credentials, reset password sending log, warm ivory admin UI, compact tables, 1440x1024 desktop.',
  logs: 'Claude-style operation log page for two systems, filters by module operator action time, audit table, detail drawer, warm minimal compliance UI, 1440x1024 desktop.',
  settings: 'Claude-style system settings page for academic year, system open switches, declaration agreement templates, PDF template coordinates, email config shortcut, warm minimal forms, clear labels and states, 1440x1024 desktop.'
};

function chip(text, tone = 'neutral') {
  return `<span class="chip ${tone}">${text}</span>`;
}

function progress(value, tone = '') {
  return `<div class="progress"><span class="${tone}" style="width:${value}%"></span></div>`;
}

function shell(pageTitle, active, body, opts = {}) {
  const role = opts.role || 'admin';
  const isMonitor = role === 'monitor';
  const nav = isMonitor ? [
    ['monitor-dashboard', '本班总览'],
    ['scores', '本班综测'],
    ['scholarship', '奖学金申报'],
    ['honor', '荣誉称号'],
    ['submissions', '提交记录'],
    ['settings', '账号设置']
  ] : [
    ['dashboard', '总览'],
    ['import', '数据导入'],
    ['review', '申报审核'],
    ['scholarship-admin', '奖学金管理'],
    ['honor-admin', '荣誉称号'],
    ['accounts', '账号邮件'],
    ['logs', '操作日志'],
    ['settings', '系统设置']
  ];

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${pageTitle}</title>
<style>
:root {
  --bg: ${theme.bg};
  --bg2: ${theme.bg2};
  --surface: ${theme.surface};
  --surface-soft: ${theme.surfaceSoft};
  --ink: ${theme.ink};
  --text: ${theme.text};
  --muted: ${theme.muted};
  --faint: ${theme.faint};
  --border: ${theme.border};
  --border2: ${theme.border2};
  --accent: ${theme.accent};
  --accent2: ${theme.accent2};
  --green: ${theme.green};
  --amber: ${theme.amber};
  --red: ${theme.red};
  --blue: ${theme.blue};
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(255,255,255,.54), rgba(255,255,255,0) 320px),
    var(--bg);
  color: var(--text);
  font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
  letter-spacing: 0;
}
.app { display: flex; min-height: 100vh; }
.sidebar {
  width: 248px;
  padding: 24px 18px;
  border-right: 1px solid var(--border);
  background: rgba(255,253,249,.72);
}
.brand { display:flex; align-items:center; gap: 10px; margin-bottom: 28px; }
.mark {
  width: 34px; height: 34px; border-radius: 8px;
  border: 1px solid var(--border2);
  display:grid; place-items:center; color: var(--accent);
  font-weight: 700; font-size: 12px; background: var(--surface);
}
.brand strong { display:block; color: var(--ink); font-size: 15px; line-height: 1.2; }
.brand span { display:block; color: var(--muted); font-size: 11px; margin-top: 3px; }
.nav { display:flex; flex-direction:column; gap: 4px; }
.nav a {
  color: var(--muted);
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  display:flex; justify-content:space-between; align-items:center;
}
.nav a.active {
  background: #efe4d8;
  color: var(--ink);
  border: 1px solid #e5d3c2;
}
.nav a.active::after { content:""; width:6px; height:6px; border-radius:9px; background:var(--accent); }
.sidebarFoot {
  position:absolute; left:18px; bottom:22px; width:212px;
  padding: 12px; border: 1px solid var(--border); border-radius: 8px;
  background: rgba(255,253,249,.65); font-size: 12px; color: var(--muted); line-height:1.5;
}
.main { flex: 1; min-width: 0; padding: 28px 34px 42px; }
.topbar { display:flex; align-items:flex-start; justify-content:space-between; gap: 20px; margin-bottom: 22px; }
.eyebrow { color: var(--accent); font-size: 12px; font-weight: 700; margin-bottom: 6px; }
h1 { color: var(--ink); font-size: 30px; line-height: 1.18; margin: 0 0 8px; font-weight: 650; }
.sub { color: var(--muted); font-size: 14px; line-height: 1.65; max-width: 760px; }
.actions { display:flex; gap: 10px; align-items:center; }
button, .button {
  border: 1px solid var(--border2);
  background: var(--surface);
  color: var(--ink);
  height: 38px;
  padding: 0 14px;
  border-radius: 8px;
  font-weight: 650;
  font-size: 13px;
  display:inline-flex; align-items:center; gap:8px;
}
.primary { background: var(--ink); color: #fffaf3; border-color: var(--ink); }
.accent { background: #efe0d2; border-color: #dec4ae; color: #6f3c29; }
.grid { display:grid; gap: 14px; }
.cols2 { grid-template-columns: 1fr 1fr; }
.cols3 { grid-template-columns: repeat(3, 1fr); }
.cols4 { grid-template-columns: repeat(4, 1fr); }
.layout { display:grid; grid-template-columns: 1fr 360px; gap: 16px; align-items:start; }
.panel, .card {
  background: rgba(255,253,249,.86);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 1px 0 rgba(48,37,28,.03);
}
.panel { padding: 16px; }
.card { padding: 16px; }
.sectionTitle { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; }
.sectionTitle h2 { color: var(--ink); font-size: 16px; margin:0; font-weight:700; }
.sectionTitle p { color: var(--muted); margin:4px 0 0; font-size:12px; }
.metric .label { color: var(--muted); font-size: 12px; }
.metric .num { color: var(--ink); font-size: 30px; line-height:1.1; font-weight:700; margin-top:10px; }
.metric .hint { color: var(--muted); font-size: 12px; margin-top:8px; }
.chip {
  display:inline-flex; align-items:center; height: 24px; padding: 0 9px;
  border-radius: 999px; border: 1px solid var(--border2);
  background: #fbf7f1; color: var(--muted); font-size: 12px; font-weight:650; white-space:nowrap;
}
.chip.good { color: #48664a; background:#eef5ec; border-color:#d2e2ce; }
.chip.warn { color: #805421; background:#f7ead5; border-color:#e8d0a8; }
.chip.bad { color: #8d4240; background:#f6e5e3; border-color:#e7c9c6; }
.chip.info { color: #526987; background:#e9eff6; border-color:#cad7e6; }
.chip.accent { color: #7a412b; background:#f4e3d6; border-color:#e5cab6; }
table { width:100%; border-collapse: collapse; font-size: 13px; }
th {
  text-align:left; color: var(--muted); font-weight:650; font-size: 12px;
  padding: 10px 10px; border-bottom: 1px solid var(--border);
  background: rgba(246,240,232,.48);
}
td { padding: 11px 10px; border-bottom: 1px solid #eee5dc; color: var(--text); vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
.name { color: var(--ink); font-weight:700; }
.mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.muted { color: var(--muted); }
.tiny { font-size:12px; color: var(--muted); line-height: 1.5; }
.progress { height: 8px; background:#efe5db; border-radius: 20px; overflow:hidden; }
.progress span { display:block; height:100%; background: var(--accent); border-radius:20px; }
.progress span.green { background: var(--green); }
.progress span.amber { background: var(--amber); }
.progress span.blue { background: var(--blue); }
.steps { display:flex; gap: 8px; }
.step { flex:1; border:1px solid var(--border); background:var(--surface); border-radius:8px; padding:12px; }
.step b { display:block; color:var(--ink); font-size:13px; margin-bottom:5px; }
.checklist { display:grid; gap: 8px; }
.check {
  display:flex; align-items:center; gap: 9px; padding: 10px;
  border: 1px solid var(--border); border-radius: 8px; background:#fffaf4;
  color: var(--text); font-size: 13px;
}
.box {
  width: 17px; height:17px; border-radius:5px; border:1px solid var(--border2);
  background:#fff; display:inline-grid; place-items:center; color:#fff; font-size:11px; flex:0 0 auto;
}
.checked .box { background: var(--green); border-color: var(--green); }
.checked .box::after { content:"✓"; }
.input, .textarea {
  border:1px solid var(--border); background:#fffdf9; border-radius:8px;
  height:38px; padding:0 12px; color:var(--text); font-size:13px;
}
.textarea { height: 86px; padding:12px; line-height:1.5; }
.filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom: 12px; }
.softList { display:grid; gap: 10px; }
.softItem { border:1px solid var(--border); border-radius:8px; padding:12px; background:#fffaf4; }
.softItem b { color:var(--ink); font-size:13px; }
.softItem p { margin:5px 0 0; color:var(--muted); font-size:12px; line-height:1.5; }
.signatureBox {
  height: 118px;
  border: 1px dashed var(--border2);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.34)),
    #fffaf4;
  display:flex;
  align-items:center;
  justify-content:center;
  color:var(--muted);
  font-size:12px;
  position:relative;
  overflow:hidden;
}
.signatureBox::after {
  content:"";
  position:absolute;
  left:18px;
  right:18px;
  bottom:28px;
  height:1px;
  background:var(--border);
}
.signatureLine {
  position:absolute;
  width:160px;
  height:36px;
  border-bottom:2px solid #3f332b;
  transform:rotate(-7deg);
  opacity:.72;
}
.pdfCard {
  border:1px solid var(--border);
  border-radius:8px;
  padding:12px;
  background:#fffdf9;
}
.pdfCard b { display:block; color:var(--ink); font-size:13px; margin-bottom:5px; }
.templateBox {
  min-height:104px;
  border:1px solid var(--border);
  border-radius:8px;
  background:#fffdf9;
  padding:12px;
  font-size:12px;
  color:var(--muted);
  line-height:1.65;
}
.splitLine { height:1px; background: var(--border); margin: 14px 0; }
.loginWrap { min-height:100vh; display:grid; grid-template-columns: 1.05fr .95fr; }
.loginLeft { padding: 70px 78px; display:flex; flex-direction:column; justify-content:space-between; }
.loginRight { display:flex; align-items:center; justify-content:center; padding: 58px; }
.loginPanel { width: 420px; padding: 28px; background:rgba(255,253,249,.9); border:1px solid var(--border); border-radius:8px; }
.entryGrid { display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:28px; }
.entryCard { min-height:260px; padding:22px; border:1px solid var(--border); border-radius:8px; background:rgba(255,253,249,.88); }
.entryCard h2 { color:var(--ink); font-size:22px; margin:18px 0 10px; }
.entryCard p { color:var(--muted); font-size:14px; line-height:1.65; margin:0 0 22px; }
.largeMark { width:54px; height:54px; border-radius:8px; border:1px solid var(--border2); display:grid; place-items:center; color:var(--accent); font-weight:800; background:#fffaf4; }
.promptStamp { position:fixed; right:18px; bottom:14px; color:#b5a89d; font-size:10px; }
</style>
</head>
<body>
${opts.noShell ? body : `<div class="app"><aside class="sidebar"><div class="brand"><div class="mark">HQU</div><div><strong>${isMonitor ? '班级申报工作台' : 'CCES 管理后台'}</strong><span>计算机科学与技术学院</span></div></div><nav class="nav">${nav.map(([id, label]) => `<a class="${active === id ? 'active' : ''}">${label}</a>`).join('')}</nav><div class="sidebarFoot">当前学年<br><b style="color:var(--ink)">2024-2025 学年</b><br>${isMonitor ? '2023 级软件工程 1 班 · 班长' : '管理员 · 学术部工作台'}</div></aside><main class="main">${body}</main></div>`}
<div class="promptStamp">Claude-style minimal mockup · ${pageTitle}</div>
</body>
</html>`;
}

function top(title, sub, action = '导出当前视图') {
  return `<div class="topbar"><div><div class="eyebrow">HQU CCES</div><h1>${title}</h1><div class="sub">${sub}</div></div><div class="actions"><button>筛选</button><button class="primary">${action}</button></div></div>`;
}

const rows = [
  ['23240101', '陈若晴', '91', '58.20', '89', '96.42', chip('可申报', 'good')],
  ['23240108', '林言', '93', '57.80', '86', '94.86', chip('国励排除', 'warn')],
  ['23240115', '周知远', '90', '56.90', '84', '93.12', chip('待确认', 'info')],
  ['23240123', '许嘉宁', '94', '58.60', '91', '97.08', chip('已申报', 'accent')],
  ['23240127', '梁思齐', '88', '55.20', '78', '90.44', chip('德育不足', 'bad')]
];

const pages = [
  {
    id: 'login',
    file: '01-login.png',
    html: shell('登录页', 'login', `
      <div class="loginWrap">
        <section class="loginLeft">
          <div>
            <div class="brand"><div class="mark">HQU</div><div><strong>CCES 申报系统</strong><span>计算机科学与技术学院</span></div></div>
            <div class="eyebrow">SCHOLARSHIP AND HONOR DECLARATION</div>
            <h1 style="font-size:44px;max-width:640px;">综合素质测评与奖学金荣誉称号申报</h1>
            <p class="sub" style="font-size:16px;max-width:620px;">面向班级申报、管理员审核和学院材料归档的统一工作台。系统保留清晰的筛选条件、确认记录和操作日志。</p>
          </div>
          <div class="grid cols3">
            <div class="card metric"><div class="label">待审核班级</div><div class="num">18</div><div class="hint">含奖学金与荣誉称号</div></div>
            <div class="card metric"><div class="label">已导入名单</div><div class="num">6</div><div class="hint">国奖、国励、校奖等</div></div>
            <div class="card metric"><div class="label">签名完成率</div><div class="num">82%</div><div class="hint">综测审核小组</div></div>
          </div>
        </section>
        <section class="loginRight">
          <div class="loginPanel">
            <div class="sectionTitle"><div><h2>登录系统</h2><p>使用管理员或班长账号进入</p></div>${chip('安全访问','good')}</div>
            <div class="grid" style="gap:12px;margin-top:22px;">
              <label class="tiny">用户名</label><div class="input">admin</div>
              <label class="tiny">密码</label><div class="input">••••••••</div>
              <button class="primary" style="justify-content:center;margin-top:10px;">进入工作台</button>
              <div class="splitLine"></div>
              <div class="tiny">首次登录后在系统设置中修改密码。班长账号由管理员统一生成并通过邮件发送。</div>
            </div>
          </div>
        </section>
      </div>
    `, { noShell: true })
  },
  {
    id: 'entry',
    file: '02-system-entry.png',
    html: shell('系统入口', 'dashboard', `
      ${top('选择进入的系统', '同一套学生、班级、学年和综测数据在两个系统中共享。管理员可在系统设置中控制开放状态。', '进入管理后台')}
      <div class="entryGrid">
        <div class="entryCard">
          <div class="largeMark">综</div>
          <h2>综合素质测评填写系统</h2>
          <p>用于班级分数录入、学业与体育数据导入、综测总分计算、附件 2 和附件 4 导出。</p>
          <div class="steps"><div class="step"><b>开放中</b><span class="tiny">班长可进入本班页面</span></div><div class="step"><b>当前学年</b><span class="tiny">2024-2025</span></div></div>
        </div>
        <div class="entryCard">
          <div class="largeMark">奖</div>
          <h2>奖学金与荣誉称号申报系统</h2>
          <p>用于名单导入、数字条件筛选、班级统一申报、确认协议签署、管理员审核和最终材料导出。</p>
          <div class="steps"><div class="step"><b>开放中</b><span class="tiny">申报截止 11 月 14 日</span></div><div class="step"><b>待审核</b><span class="tiny">18 个班级批次</span></div></div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px;"><div class="sectionTitle"><div><h2>进入前检查</h2><p>关键依赖数据需要在申报前完成导入</p></div></div>
        <div class="grid cols4"><div>${chip('国奖名单 已导入','good')}</div><div>${chip('国励名单 已导入','good')}</div><div>${chip('院奖名额 待补齐','warn')}</div><div>${chip('班长邮箱 已导入','good')}</div></div>
      </div>
    `)
  },
  {
    id: 'dashboard',
    file: '03-admin-dashboard.png',
    html: shell('管理员总览', 'dashboard', `
      ${top('申报审核总览', '查看本学年奖学金、荣誉称号、名单导入、班级提交和签名完成情况。', '导出审核进度')}
      <div class="grid cols4">
        <div class="card metric"><div class="label">已提交申报</div><div class="num">42</div><div class="hint">${chip('较昨日 +8','good')}</div></div>
        <div class="card metric"><div class="label">待审核批次</div><div class="num">18</div><div class="hint">${chip('优先处理','warn')}</div></div>
        <div class="card metric"><div class="label">协议签署率</div><div class="num">91%</div><div class="hint">缺 4 个班级</div></div>
        <div class="card metric"><div class="label">名单导入</div><div class="num">6/8</div><div class="hint">院奖金额表待补齐</div></div>
      </div>
      <div class="layout" style="margin-top:16px;">
        <div class="panel"><div class="sectionTitle"><div><h2>最新申报批次</h2><p>管理员可进入详情审核、退回或确认通过</p></div>${chip('实时更新','info')}</div>
          <table><thead><tr><th>班级</th><th>类型</th><th>提交人</th><th>状态</th><th>提交时间</th></tr></thead><tbody>
            <tr><td class="name">2023 级软件工程 1 班</td><td>院级奖学金</td><td>林言</td><td>${chip('待审核','warn')}</td><td class="mono">11-12 19:42</td></tr>
            <tr><td class="name">2022 级计算机类 2 班</td><td>优秀学生干部</td><td>许嘉宁</td><td>${chip('材料待补','bad')}</td><td class="mono">11-12 18:10</td></tr>
            <tr><td class="name">2024 级人工智能 1 班</td><td>优秀学生</td><td>周知远</td><td>${chip('已通过','good')}</td><td class="mono">11-12 16:37</td></tr>
            <tr><td class="name">2023 级网络空间安全 1 班</td><td>院级奖学金</td><td>陈若晴</td><td>${chip('已退回','info')}</td><td class="mono">11-11 21:08</td></tr>
          </tbody></table>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>审核提醒</h2><p>系统根据材料状态自动整理</p></div></div>
          <div class="softList">
            <div class="softItem"><b>国奖、国励仅导入名单</b><p>不进入系统评选，只作为标签和互斥依据。</p></div>
            <div class="softItem"><b>院奖金额限制</b><p>普通班级需同时满足名额、金额和金字塔人数结构。</p></div>
            <div class="softItem"><b>提交阻断项</b><p>缺少班长确认协议、确认项或必要证明材料时，不允许提交。</p></div>
          </div>
        </aside>
      </div>
    `)
  },
  {
    id: 'monitorDashboard',
    file: '03b-monitor-dashboard.png',
    html: shell('班长本班总览', 'monitor-dashboard', `
      ${top('本班申报总览', '班长只查看本班综测核对、奖学金申报、荣誉称号申报、确认协议和提交记录。', '继续填写申报')}
      <div class="grid cols4">
        <div class="card metric"><div class="label">本班候选</div><div class="num">12</div><div class="hint">奖学金 8，荣誉称号 4</div></div>
        <div class="card metric"><div class="label">确认项</div><div class="num">7/9</div><div class="hint">${chip('仍需核对','warn')}</div></div>
        <div class="card metric"><div class="label">协议签署</div><div class="num">0/1</div><div class="hint">提交前必须完成</div></div>
        <div class="card metric"><div class="label">综测签名</div><div class="num">5/7</div><div class="hint">审核小组待补 2 人</div></div>
      </div>
      <div class="layout" style="margin-top:16px;">
        <div class="panel"><div class="sectionTitle"><div><h2>本班待办</h2><p>班长页面不显示全院导入、账号邮件和全院审核功能</p></div>${chip('班级视角','accent')}</div>
          <table><thead><tr><th>事项</th><th>进度</th><th>负责人</th><th>状态</th></tr></thead><tbody>
            <tr><td class="name">院级奖学金申报</td><td>候选 8 人，已选 6 人</td><td>班长</td><td>${chip('填写中','warn')}</td></tr>
            <tr><td class="name">荣誉称号申报</td><td>候选 4 人，材料待补 2 份</td><td>班长</td><td>${chip('材料待补','warn')}</td></tr>
            <tr><td class="name">班长确认协议</td><td>未签署</td><td>班长</td><td>${chip('阻止提交','bad')}</td></tr>
            <tr><td class="name">综测审核小组签名</td><td>5/7</td><td>审核小组</td><td>${chip('待补签名','info')}</td></tr>
          </tbody></table>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>本班提醒</h2><p>提交前需要逐项完成</p></div></div>
          <div class="softList">
            <div class="softItem"><b>权限范围</b><p>班长只能查看和提交本班数据，无法访问全院名单导入和审核列表。</p></div>
            <div class="softItem"><b>共同条件</b><p>杂项条件需要班长逐项勾选确认。</p></div>
            <div class="softItem"><b>签名要求</b><p>综测评审页由审核小组签名确认综测分数；奖学金和荣誉称号申报页由班长签署确认协议。</p></div>
          </div>
        </aside>
      </div>
    `, { role: 'monitor' })
  },
  {
    id: 'import',
    file: '04-import-center.png',
    html: shell('数据导入中心', 'import', `
      ${top('数据导入与模板中心', '管理员统一导入基础名单、综测扩展数据、外部奖项名单、院奖控制表和班长邮箱。', '下载全部模板')}
      <div class="grid cols3">
        ${['综测扩展数据','外部奖项名单','院奖名额金额表'].map((t,i)=>`<div class="card"><div class="sectionTitle"><div><h2>${t}</h2><p>${['体测成绩、体育课成绩、社区表现分','国奖、国励、校奖、教育部奖学金','班级名额、可支配金额、控制规则'][i]}</p></div>${chip(i===2?'待导入':'已导入',i===2?'warn':'good')}</div><button class="accent">选择文件</button><button style="margin-left:8px;">模板</button></div>`).join('')}
      </div>
      <div class="panel" style="margin-top:16px;"><div class="sectionTitle"><div><h2>导入记录</h2><p>失败记录可导出给班级复核</p></div>${chip('最近 20 条','info')}</div>
        <table><thead><tr><th>类型</th><th>文件名</th><th>成功</th><th>失败</th><th>导入人</th><th>时间</th></tr></thead><tbody>
          <tr><td>国奖名单</td><td>national_award_2024.xlsx</td><td class="mono">12</td><td class="mono">0</td><td>管理员</td><td>11-10 09:20</td></tr>
          <tr><td>综测扩展数据</td><td>scores_extra_23级.xlsx</td><td class="mono">286</td><td class="mono">3</td><td>管理员</td><td>11-10 10:14</td></tr>
          <tr><td>班长邮箱</td><td>monitor_email.xlsx</td><td class="mono">38</td><td class="mono">0</td><td>管理员</td><td>11-09 18:05</td></tr>
          <tr><td>先进班级名单</td><td>class_honors.xlsx</td><td class="mono">9</td><td class="mono">0</td><td>管理员</td><td>11-09 16:44</td></tr>
        </tbody></table>
      </div>
    `)
  },
  {
    id: 'scores',
    file: '05-score-review.png',
    html: shell('综测分数管理', 'scores', `
      ${top('班级综测分数核对', '导入体测成绩、体育课成绩和社区表现分后，系统按年级阶段计算体育基础分，并为申报提供数字依据。', '导出附件 2')}
      <div class="panel"><div class="sectionTitle"><div><h2>2023 级软件工程 1 班</h2><p>体育基础分：大一大二按 0.7 体测 + 0.3 体育课，大三按体测成绩</p></div>${chip('审核小组待签名','warn')}</div>
        <table><thead><tr><th>学号</th><th>姓名</th><th>德育</th><th>学业</th><th>体测</th><th>体育课</th><th>社区</th><th>综测总分</th><th>排名</th></tr></thead><tbody>
          ${rows.map((r,i)=>`<tr><td class="mono">${r[0]}</td><td class="name">${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${i===4?'74':'88'}</td><td>${i===4?'95':'99'}</td><td class="mono">${r[5]}</td><td>${i+1}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <div class="layout" style="margin-top:16px;">
        <div class="panel"><div class="sectionTitle"><div><h2>分数异常提示</h2><p>以下信息会影响申报筛选</p></div></div>
          <div class="grid cols3"><div class="card">${chip('德育低于 90','bad')}<p class="tiny">1 名学生无法进入奖学金共同条件。</p></div><div class="card">${chip('社区表现不足','bad')}<p class="tiny">1 名学生社区表现分低于 98。</p></div><div class="card">${chip('体测低于 80','warn')}<p class="tiny">影响校级优秀学生申报。</p></div></div>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>审核小组签名</h2><p>按班级成员名单动态生成签名位</p></div></div><div class="checklist"><div class="check checked"><span class="box"></span>班主任签名已采集</div><div class="check checked"><span class="box"></span>学习委员签名已采集</div><div class="check checked"><span class="box"></span>学生代表多人已签名</div><div class="check"><span class="box"></span>待补 2 人签名</div></div><div class="splitLine"></div><div class="pdfCard"><b>综测审核小组确认书.pdf</b><p class="tiny">签名 5/7，PDF 暂未生成。</p>${chip('待补签','warn')}</div></aside>
      </div>
    `, { role: 'monitor' })
  },
  {
    id: 'scholarship',
    file: '06-scholarship-declaration.png',
    html: shell('奖学金申报', 'scholarship', `
      ${top('院级奖学金班级申报', '班长查看系统筛选结果，核对名额金额和共同条件，通过手写签字或上传电子签名生成 PDF 后提交。', '提交班级申报')}
      <div class="layout">
        <div class="panel"><div class="sectionTitle"><div><h2>候选学生</h2><p>普通班级学习成绩前 60%，并排除国奖、国励、校奖等名单</p></div>${chip('名额 8 人','info')}</div>
          <table><thead><tr><th>学生</th><th>综测</th><th>学业排名</th><th>建议等级</th><th>状态</th></tr></thead><tbody>
            <tr><td class="name">陈若晴</td><td class="mono">96.42</td><td>3/42</td><td>一等奖</td><td>${chip('可申报','good')}</td></tr>
            <tr><td class="name">许嘉宁</td><td class="mono">95.80</td><td>5/42</td><td>二等奖</td><td>${chip('可申报','good')}</td></tr>
            <tr><td class="name">林言</td><td class="mono">94.86</td><td>4/42</td><td>无</td><td>${chip('国励排除','warn')}</td></tr>
            <tr><td class="name">周知远</td><td class="mono">93.12</td><td>8/42</td><td>三等奖</td><td>${chip('待确认','info')}</td></tr>
          </tbody></table>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>提交检查</h2><p>全部完成后允许提交</p></div></div>
          <div class="checklist"><div class="check checked"><span class="box"></span>共同条件已勾选</div><div class="check checked"><span class="box"></span>名额金额未超限</div><div class="check checked"><span class="box"></span>人数结构符合要求</div><div class="check checked"><span class="box"></span>班长签名已采集</div><div class="check"><span class="box"></span>协议 PDF 待生成</div><div class="check"><span class="box"></span>候选名单待最终核对</div></div>
        </aside>
      </div>
      <div class="grid cols3" style="margin-top:16px;"><div class="card metric"><div class="label">金额使用</div><div class="num">5,400</div><div class="hint">可支配金额 6,000</div>${progress(90,'amber')}</div><div class="card metric"><div class="label">推荐人数</div><div class="num">8</div><div class="hint">一等 1 / 二等 3 / 三等 4</div></div><div class="card metric"><div class="label">排除名单</div><div class="num">2</div><div class="hint">国励 1，校奖 1</div></div></div>
      <div class="layout" style="margin-top:16px;">
        <div class="panel"><div class="sectionTitle"><div><h2>签名确认</h2><p>支持页面手写签字，也可上传 PNG/JPG 电子签名图片</p></div>${chip('班长签名','accent')}</div>
          <div class="grid cols2">
            <div><div class="tiny" style="margin-bottom:6px;">页面手写签字</div><div class="signatureBox"><span class="signatureLine"></span>签名画布</div></div>
            <div><div class="tiny" style="margin-bottom:6px;">上传电子签名图片</div><div class="signatureBox">拖入或选择签名图片</div></div>
          </div>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>PDF 材料状态</h2><p>签名确认后写入模板指定位置</p></div>${chip('阻止提交','bad')}</div>
          <div class="softList"><div class="pdfCard"><b>确认协议 PDF</b><p class="tiny">班长签名已采集，等待生成 PDF。</p>${chip('待生成','warn')}</div><div class="pdfCard"><b>申报学生明细 PDF</b><p class="tiny">候选名单、奖项等级和确认项将随提交生成。</p>${chip('待生成','info')}</div></div>
        </aside>
      </div>
    `, { role: 'monitor' })
  },
  {
    id: 'honor',
    file: '07-honor-declaration.png',
    html: shell('荣誉称号申报', 'honor', `
      ${top('荣誉称号班级申报', '班长按学生个人意愿提交荣誉称号申报，补充材料说明并完成签名 PDF 归档。', '提交荣誉申报')}
      <div class="layout">
        <div class="panel"><div class="sectionTitle"><div><h2>称号候选人</h2><p>系统只判断明确数字条件，干部材料由班级补充说明</p></div>${chip('4 类称号','info')}</div>
          <table><thead><tr><th>学生</th><th>申报称号</th><th>数字条件</th><th>个人意愿</th><th>材料状态</th></tr></thead><tbody>
            <tr><td class="name">陈若晴</td><td>校级优秀学生</td><td>${chip('符合','good')}</td><td>同意</td><td>${chip('完整','good')}</td></tr>
            <tr><td class="name">许嘉宁</td><td>院级优秀学生干部</td><td>${chip('符合','good')}</td><td>同意</td><td>${chip('活动说明待补','warn')}</td></tr>
            <tr><td class="name">周知远</td><td>校级优秀学生干部</td><td>${chip('符合','good')}</td><td>同意</td><td>${chip('任职证明待补','warn')}</td></tr>
            <tr><td class="name">梁思齐</td><td>院级优秀学生</td><td>${chip('不符合','bad')}</td><td>同意</td><td>${chip('德育不足','bad')}</td></tr>
          </tbody></table>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>材料说明</h2><p>优秀学生干部必须补充</p></div></div>
          <div class="textarea">任职组织：学院团委学生会学习部。任期：2024.09 至 2025.09。组织活动：学院学习经验分享会，活动影响良好。</div>
          <div class="splitLine"></div>
          <div class="checklist"><div class="check checked"><span class="box"></span>学生本人具有申报意愿</div><div class="check checked"><span class="box"></span>干部任职信息真实有效</div><div class="check"><span class="box"></span>活动证明已上传</div></div>
        </aside>
      </div>
      <div class="layout" style="margin-top:16px;">
        <div class="panel"><div class="sectionTitle"><div><h2>班长签名与确认协议</h2><p>页面手写签字或上传电子签名图片后生成 PDF</p></div>${chip('签名采集中','warn')}</div>
          <div class="grid cols2">
            <div><div class="tiny" style="margin-bottom:6px;">班长确认协议签名</div><div class="signatureBox"><span class="signatureLine"></span>林言 · 11-12 20:18</div></div>
            <div><div class="tiny" style="margin-bottom:6px;">上传电子签名图片</div><div class="signatureBox">拖入或选择班长电子签名图片</div></div>
          </div>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>PDF 归档</h2><p>生成后进入管理员审核材料</p></div></div>
          <div class="softList"><div class="pdfCard"><b>荣誉称号确认协议.pdf</b><p class="tiny">已放入班长签名，等待最终提交。</p>${chip('已生成','good')}</div><div class="pdfCard"><b>荣誉称号申报明细.pdf</b><p class="tiny">候选人、申报称号和材料说明随提交生成。</p>${chip('待生成','info')}</div></div>
        </aside>
      </div>
    `, { role: 'monitor' })
  },
  {
    id: 'review',
    file: '08-admin-review.png',
    html: shell('管理员申报审核', 'review', `
      ${top('班级申报审核', '管理员接收班级提交的申报，核对数字条件、确认项、班长确认协议 PDF 和材料说明。综测审核小组材料在综测评审页面单独管理。', '批量导出')}
      <div class="filters">${['全部','待审核','缺协议 PDF','材料待补','已退回','已通过'].map((f,i)=>chip(f,i===1?'warn':i===5?'good':'neutral')).join('')}</div>
      <div class="layout">
        <div class="panel"><div class="sectionTitle"><div><h2>申报批次</h2><p>按提交时间排序</p></div></div>
          <table><thead><tr><th>班级</th><th>申报类型</th><th>人数</th><th>完整性</th><th>状态</th></tr></thead><tbody>
            <tr><td class="name">2023 级软件工程 1 班</td><td>院级奖学金</td><td>8</td><td>3/5</td><td>${chip('缺协议 PDF','warn')}</td></tr>
            <tr><td class="name">2022 级计算机类 2 班</td><td>优秀学生干部</td><td>2</td><td>5/5</td><td>${chip('待审核','warn')}</td></tr>
            <tr><td class="name">2024 级人工智能 1 班</td><td>优秀学生</td><td>3</td><td>5/5</td><td>${chip('已通过','good')}</td></tr>
            <tr><td class="name">2023 级网络空间安全 1 班</td><td>荣誉称号</td><td>4</td><td>4/5</td><td>${chip('材料待补','bad')}</td></tr>
          </tbody></table>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>审核详情</h2><p>2023 级软件工程 1 班</p></div>${chip('待处理','warn')}</div>
          <div class="softList"><div class="softItem"><b>数字条件</b><p>8 名学生全部符合院奖数字筛选条件。</p></div><div class="softItem"><b>协议 PDF</b><p>班长签名已采集，PDF 尚未生成。</p></div><div class="softItem"><b>材料说明</b><p>奖学金申报无需综测审核小组签名，管理员只检查班长确认协议和必要证明材料。</p></div></div>
          <div class="actions" style="margin-top:14px;"><button>退回修改</button><button class="primary" style="background:#8d8177;border-color:#8d8177;">缺 PDF 无法通过</button></div>
        </aside>
      </div>
      <div class="grid cols3" style="margin-top:16px;">
        <div class="pdfCard"><b>班级确认协议.pdf</b><p class="tiny">状态：未生成。原因：缺 PDF 套版结果。</p>${chip('阻止通过','bad')}</div>
        <div class="pdfCard"><b>证明材料汇总.pdf</b><p class="tiny">状态：待补充。管理员可查看材料说明和附件。</p>${chip('材料待补','warn')}</div>
        <div class="pdfCard"><b>申报学生明细.pdf</b><p class="tiny">状态：已生成。可预览和下载。</p>${chip('可预览','good')}</div>
      </div>
    `)
  },
  {
    id: 'allocation',
    file: '09-award-allocation.png',
    html: shell('院奖分配', 'scholarship', `
      ${top('院级奖学金自动分配', '系统根据名额、金额和金字塔结构生成建议方案，班长提交前可查看约束结果。', '应用建议方案')}
      <div class="grid cols3">
        <div class="card metric"><div class="label">可支配金额</div><div class="num">6,000</div><div class="hint">当前使用 5,400</div>${progress(90,'amber')}</div>
        <div class="card metric"><div class="label">推荐名额</div><div class="num">8</div><div class="hint">当前占用 8</div>${progress(100,'green')}</div>
        <div class="card metric"><div class="label">人数结构</div><div class="num">1 ≤ 3 ≤ 4</div><div class="hint">${chip('符合','good')}</div></div>
      </div>
      <div class="layout" style="margin-top:16px;">
        <div class="panel"><div class="sectionTitle"><div><h2>分配预览</h2><p>按综测总分排序后自动生成</p></div>${chip('建议方案','accent')}</div>
          <table><thead><tr><th>排名</th><th>学生</th><th>综测总分</th><th>奖项</th><th>金额</th><th>约束</th></tr></thead><tbody>
            <tr><td>1</td><td class="name">陈若晴</td><td>96.42</td><td>一等奖</td><td class="mono">1000</td><td>${chip('通过','good')}</td></tr>
            <tr><td>2</td><td class="name">许嘉宁</td><td>95.80</td><td>二等奖</td><td class="mono">800</td><td>${chip('通过','good')}</td></tr>
            <tr><td>3</td><td class="name">周知远</td><td>93.12</td><td>二等奖</td><td class="mono">800</td><td>${chip('通过','good')}</td></tr>
            <tr><td>4</td><td class="name">沈临川</td><td>92.90</td><td>三等奖</td><td class="mono">600</td><td>${chip('通过','good')}</td></tr>
          </tbody></table>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>规则提醒</h2><p>超出任一条件会阻止提交</p></div></div>
          <div class="softList"><div class="softItem"><b>金额</b><p>一等奖 1000 元，二等奖 800 元，三等奖 600 元。</p></div><div class="softItem"><b>结构</b><p>一等奖人数小于等于二等奖人数，二等奖人数小于等于三等奖人数。</p></div><div class="softItem"><b>排除</b><p>国奖、国励、校奖获得者不可推荐院奖。</p></div></div>
        </aside>
      </div>
    `, { role: 'monitor' })
  },
  {
    id: 'accounts',
    file: '10-accounts-mail.png',
    html: shell('账号邮件', 'accounts', `
      ${top('班长账号与邮件管理', '管理员通过学术部网易邮箱发送班长账号、密码重置和申报通知，邮件模板由系统内维护。', '发送测试邮件')}
      <div class="grid cols3"><div class="card metric"><div class="label">班长账号</div><div class="num">38</div><div class="hint">覆盖全部本科班级</div></div><div class="card metric"><div class="label">邮箱完整率</div><div class="num">97%</div><div class="hint">1 个班级待补</div></div><div class="card metric"><div class="label">SMTP 状态</div><div class="num">待测</div><div class="hint">网易邮箱授权码</div></div></div>
      <div class="layout" style="margin-top:16px;">
        <div class="panel"><div class="sectionTitle"><div><h2>学术部网易邮箱配置</h2><p>首次配置需登录网易邮箱开启 SMTP 并获取授权码</p></div>${chip('授权码密文保存','info')}</div>
          <div class="grid cols2"><div class="input">SMTP：smtp.163.com</div><div class="input">端口：465</div><div class="input">账号：academic_department@163.com</div><div class="input">授权码：••••••••••••</div></div>
          <div class="splitLine"></div>
          <div class="grid cols3"><button class="accent">保存配置</button><button>发送测试邮件</button><button>查看发送日志</button></div>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>模板变量</h2><p>发送时由后端替换</p></div></div>
          <div class="softList"><div class="softItem"><b>班长账号通知</b><p>{{班级}} {{班长姓名}} {{登录账号}} {{初始密码}} {{系统链接}}</p></div><div class="softItem"><b>审核退回通知</b><p>{{申报类型}} {{退回原因}} {{修改截止时间}}</p></div></div>
        </aside>
      </div>
      <div class="panel" style="margin-top:16px;"><div class="sectionTitle"><div><h2>邮件模板编辑</h2><p>管理员自行编辑标题和正文，保存后用于批量发送</p></div>${chip('当前模板：班长账号通知','accent')}</div>
        <div class="grid cols2"><div><div class="tiny" style="margin-bottom:6px;">邮件标题</div><div class="input">华侨大学计算机学院班长账号通知</div><div class="tiny" style="margin:12px 0 6px;">邮件正文</div><div class="templateBox">请 {{班长姓名}} 使用账号 {{登录账号}} 和初始密码 {{初始密码}} 登录系统：{{系统链接}}。首次登录后请修改密码。</div></div>
        <div><div class="tiny" style="margin-bottom:6px;">发送记录</div><table><thead><tr><th>班级</th><th>邮箱</th><th>模板</th><th>状态</th></tr></thead><tbody><tr><td>软件工程 1 班</td><td>sw1@hqu.edu.cn</td><td>账号通知</td><td>${chip('成功','good')}</td></tr><tr><td>计算机类 2 班</td><td>cs2@hqu.edu.cn</td><td>账号通知</td><td>${chip('待发送','warn')}</td></tr><tr><td>人工智能 1 班</td><td>ai1@hqu.edu.cn</td><td>密码重置</td><td>${chip('失败','bad')}</td></tr></tbody></table></div></div>
      </div>
    `)
  },
  {
    id: 'logs',
    file: '11-audit-logs.png',
    html: shell('操作日志', 'logs', `
      ${top('两系统操作日志', '记录综测、导入、导出、账号、申报、审核、退回、通过和邮件发送等关键操作。', '导出日志')}
      <div class="filters">${['全部模块','综测分数','奖学金申报','荣誉称号','账号邮件','系统设置'].map((f,i)=>chip(f,i===0?'accent':'neutral')).join('')}</div>
      <div class="panel"><div class="sectionTitle"><div><h2>最近操作</h2><p>支持按操作人、模块、对象、时间筛选</p></div></div>
        <table><thead><tr><th>时间</th><th>操作人</th><th>模块</th><th>动作</th><th>对象</th><th>结果</th></tr></thead><tbody>
          <tr><td class="mono">11-12 20:41</td><td>管理员</td><td>申报审核</td><td>退回修改</td><td>软件工程 1 班院奖申报</td><td>${chip('成功','good')}</td></tr>
          <tr><td class="mono">11-12 20:18</td><td>林言</td><td>奖学金申报</td><td>提交申报</td><td>2023 级软件工程 1 班</td><td>${chip('阻止提交','warn')}</td></tr>
          <tr><td class="mono">11-12 19:52</td><td>管理员</td><td>外部名单</td><td>导入国励名单</td><td>national_inspire.xlsx</td><td>${chip('成功','good')}</td></tr>
          <tr><td class="mono">11-12 18:44</td><td>许嘉宁</td><td>荣誉称号</td><td>更新材料说明</td><td>优秀学生干部申报</td><td>${chip('成功','good')}</td></tr>
        </tbody></table>
      </div>
    `)
  },
  {
    id: 'settings',
    file: '12-settings.png',
    html: shell('系统设置', 'settings', `
      ${top('系统设置', '管理学年、系统开放状态、确认协议模板、PDF 签名位置、邮件配置和申报截止时间。', '保存设置')}
      <div class="layout">
        <div class="grid">
          <div class="panel"><div class="sectionTitle"><div><h2>系统开放状态</h2><p>分别控制综测填写系统和申报系统</p></div></div>
            <div class="grid cols2"><div class="card"><b>综合素质测评填写系统</b><p class="tiny">开放给管理员和班长</p>${chip('开放中','good')}</div><div class="card"><b>奖学金荣誉称号申报系统</b><p class="tiny">开放班级统一申报</p>${chip('开放中','good')}</div></div>
          </div>
          <div class="panel"><div class="sectionTitle"><div><h2>确认协议模板</h2><p>班长提交申报时必须签署，签名后生成 PDF</p></div>${chip('当前版本 v3','info')}</div><div class="textarea">本人作为本班申报负责人，已根据学院通知和系统筛选结果，对本班奖学金与荣誉称号申报信息进行核对……</div></div>
          <div class="panel"><div class="sectionTitle"><div><h2>PDF 模板与签名位置</h2><p>协议和确认书按模板坐标写入签名图片</p></div>${chip('2 个模板','accent')}</div>
            <div class="grid cols2"><div class="pdfCard"><b>确认协议 PDF 模板</b><p class="tiny">签名坐标：第 1 页 x 438, y 712。</p>${chip('已配置','good')}</div><div class="pdfCard"><b>综测审核小组确认书模板</b><p class="tiny">按成员名单动态增加签名位。</p>${chip('待校准','warn')}</div></div>
          </div>
        </div>
        <aside class="panel"><div class="sectionTitle"><div><h2>邮件配置</h2><p>用于发送班长账号和重置密码通知</p></div></div>
          <div class="grid" style="gap:10px;"><div class="input">SMTP 主机：smtp.163.com</div><div class="input">发件人：学术部网易邮箱</div><div class="input">授权码：密文保存</div><div class="input">模板：4 个已启用</div><button class="accent">进入邮件管理</button></div>
          <div class="splitLine"></div>
          <div class="sectionTitle"><div><h2>学年</h2><p>当前启用</p></div>${chip('2024-2025','accent')}</div>
        </aside>
      </div>
    `)
  }
];

function main() {
  const promptLines = ['# Frontend image prompts', ''];

  for (const spec of pages) {
    const htmlFile = spec.file.replace(/\.png$/, '.html');
    fs.writeFileSync(path.join(outDir, htmlFile), spec.html, 'utf8');
    promptLines.push(`## ${spec.file}`, '', prompts[spec.id], '');
  }

  fs.writeFileSync(path.join(outDir, 'prompts.md'), promptLines.join('\n'), 'utf8');
}

main();
