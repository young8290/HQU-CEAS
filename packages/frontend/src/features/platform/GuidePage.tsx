import DataPanel from '../../components/ui/DataPanel';
import { getUser } from '../../lib/auth';
import { AppLink } from '../../lib/router';

interface GuideLink {
  label: string;
  href: string;
}

interface GuideStep {
  name: string;
  where: string;
  links?: GuideLink[];
}

interface RoleGuide {
  role: string;
  title: string;
  description: string;
  steps: GuideStep[];
}

// 三段式角色化上手指引：每步 = 步名 + 去哪点 + 直达链接。
const roleGuides: RoleGuide[] = [
  {
    role: 'admin',
    title: '管理员：第一次使用怎么走',
    description: '从建学年到导出材料的完整链路，按顺序做完即可开学期。',
    steps: [
      {
        name: '第一步：创建学年并开放系统',
        where: '到「系统设置」创建当前学年并设为当前，勾选开放综测/申报系统。',
        links: [{ label: '系统设置', href: '/settings' }],
      },
      {
        name: '第二步：导入学生名单',
        where: '到「学生管理」下载模板，一次性导入全院学生（缺失的年级、班级会自动补建）。',
        links: [{ label: '学生管理', href: '/evaluation/students' }],
      },
      {
        name: '第三步：生成并分发班长账号',
        where: '到「账号管理」点「批量生成班长账号」，导出含密码表格或直接发送账号邮件。',
        links: [{ label: '账号管理', href: '/accounts' }],
      },
      {
        name: '第四步：导入学业与体育成绩',
        where: '到「数据导入」分别导入教务学业成绩表和体测/体育课成绩表。',
        links: [{ label: '数据导入', href: '/evaluation/import' }],
      },
      {
        name: '第五步：跟进综测进度并导出附件',
        where: '在「综测总览」「分数管理」查看各班填报情况，完成后到「附件导出」导出附件 2/附件 4。',
        links: [
          { label: '综测总览', href: '/evaluation/dashboard' },
          { label: '附件导出', href: '/evaluation/export' },
        ],
      },
      {
        name: '第六步：申报期导入名额并审核申报',
        where: '到「申报数据导入」导入外部奖项与院奖名额，班长提交后在「申报审核」逐班审核。',
        links: [
          { label: '申报数据导入', href: '/declaration/import' },
          { label: '申报审核', href: '/declaration/reviews' },
        ],
      },
    ],
  },
  {
    role: 'monitor',
    title: '班长：第一次使用怎么走',
    description: '用管理员发放的账号登录后，按顺序完成本班综测与申报。',
    steps: [
      {
        name: '第一步：修改初始密码',
        where: '到「系统设置」用初始密码换成自己的密码，并核对账号信息。',
        links: [{ label: '系统设置', href: '/settings' }],
      },
      {
        name: '第二步：填写本班综测分数',
        where: '到「本班综测」选择本班进入分数编辑，逐项填写并用「明」按钮记录加/减分明细，输入后自动保存。',
        links: [{ label: '本班综测', href: '/evaluation/class/scores' }],
      },
      {
        name: '第三步：组建审核小组并核对签名',
        where: '到「审核小组确认」添加小组成员，为每人生成审核链接发给对方；成员核对完成后采集签名。',
        links: [{ label: '审核小组确认', href: '/evaluation/class/review' }],
      },
      {
        name: '第四步：申报期提交奖学金与荣誉称号',
        where: '先到「申报数据导入」导入本班申报补充信息，再到「奖学金申报」「荣誉称号」勾选名单、确认事项并签名提交。',
        links: [
          { label: '申报数据导入', href: '/declaration/import' },
          { label: '奖学金申报', href: '/declaration/class/awards' },
          { label: '荣誉称号', href: '/declaration/class/honors' },
        ],
      },
      {
        name: '第五步：跟踪提交记录与退回意见',
        where: '到「提交记录」查看审核状态；被退回时按意见修改后重新提交。',
        links: [{ label: '提交记录', href: '/declaration/class/submissions' }],
      },
    ],
  },
  {
    role: 'reviewer',
    title: '审核成员：第一次使用怎么走',
    description: '无需注册账号，凭班长发来的专属链接参与综测核对。',
    steps: [
      {
        name: '第一步：打开班长发来的审核链接',
        where: '链接自动完成身份校验并绑定当前设备，直接进入本班综测核对页（/review/scores）。',
      },
      {
        name: '第二步：逐个核对学生分数',
        where: '在核对页查看每位学生各项分数与加分明细，对每人标记「已核对」或「有异议」（异议需填写说明）。',
      },
      {
        name: '第三步：完成核对后签名确认',
        where: '在页面底部「本人签名」手写或上传签名图片，签名后本班确认书自动更新。',
      },
    ],
  },
];

export default function GuidePage() {
  const user = getUser();
  // 当前角色的指引置顶展示，其余角色仍可查阅。
  const orderedGuides = [...roleGuides].sort((a, b) => {
    const aOwn = a.role === user?.role ? 0 : 1;
    const bOwn = b.role === user?.role ? 0 : 1;
    return aOwn - bOwn;
  });

  return (
    <div className="space-y-6">
      {orderedGuides.map((guide) => (
        <DataPanel
          key={guide.role}
          title={guide.role === user?.role ? `${guide.title}（我的角色）` : guide.title}
          description={guide.description}
        >
          <ol className="space-y-3">
            {guide.steps.map((step, index) => (
              <li
                key={step.name}
                className="rounded-lg border border-[#e8dcc9] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ead9c7] text-xs font-semibold text-[#7c4a34] dark:bg-primary-500/10 dark:text-primary-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-950 dark:text-white">{step.name}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{step.where}</p>
                    {step.links && step.links.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {step.links.map((link) => (
                          <AppLink
                            key={link.href + link.label}
                            to={link.href}
                            className="rounded-md border border-[#d8c9b8] bg-[#fffaf2] px-3 py-1.5 text-xs font-medium text-[#7c4a34] transition-colors hover:border-[#9a5b3d] hover:bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-primary-300"
                          >
                            前往{link.label}
                          </AppLink>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </DataPanel>
      ))}
      <p className="text-xs leading-5 text-neutral-400 dark:text-neutral-500">
        更完整的操作说明见各页面顶部的「操作指南」PDF；遇到问题联系计算机科学与技术学院学术部。
      </p>
    </div>
  );
}
