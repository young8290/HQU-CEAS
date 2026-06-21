import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getUser, type User } from '../../lib/auth';
import { AppLink } from '../../lib/router';

interface Stats {
  totalStudents: number;
  totalClasses: number;
  totalGrades: number;
  currentYear: string;
}

export default function DashboardContent() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    setUser(u);

    const loadStats = async () => {
      try {
        const years = await api.get('/academic-years');
        const currentYear = years.find((y: any) => y.isCurrent);

        if (u?.role !== 'admin') {
          setStats({
            totalStudents: 0,
            totalClasses: 0,
            totalGrades: 0,
            currentYear: currentYear?.name || '未设置',
          });
          return;
        }

        const grades = await api.get('/grades');
        const gradeClasses = await Promise.all(
          grades.map((grade: any) => api.get(`/grades/${grade.id}/classes`)),
        );

        const totalClasses = gradeClasses.reduce(
          (sum: number, classes: any[]) => sum + classes.length,
          0,
        );
        const totalStudents = gradeClasses.reduce(
          (sum: number, classes: any[]) =>
            sum + classes.reduce(
              (classSum, cls) => classSum + (cls._count?.students || 0),
              0,
            ),
          0,
        );

        setStats({
          totalStudents,
          totalClasses,
          totalGrades: grades.length,
          currentYear: currentYear?.name || '未设置',
        });
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">加载中...</div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium text-[#9a5b3d] dark:text-primary-300">{isAdmin ? '全院综测管理' : '班级综测管理'}</p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
              {user?.displayName || user?.username}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {isAdmin ? '查看全院综测数据准备情况，处理导入、分数、学生和附件。' : `${user?.gradeName || ''} ${user?.className || ''}，查看本班综测评审与签名状态。`}
            </p>
          </div>
          <span className="w-fit rounded-md border border-[#d9c8b8] bg-white px-3 py-1.5 text-xs text-[#7c4a34] dark:border-neutral-700 dark:bg-neutral-950 dark:text-primary-300">
            {isAdmin ? '管理员端' : '班长端'}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="当前学年" value={stats?.currentYear || '-'} />
        {isAdmin && (
          <>
            <StatCard title="年级总数" value={stats?.totalGrades?.toString() || '0'} />
            <StatCard title="班级总数" value={stats?.totalClasses?.toString() || '0'} />
            <StatCard title="学生总数" value={stats?.totalStudents?.toString() || '0'} />
          </>
        )}
        {!isAdmin && (
          <>
            <StatCard title="所属班级" value={user?.className || '-'} />
            <StatCard title="角色" value="班长" />
            <StatCard title="综测确认" value="待核对" />
          </>
        )}
      </div>

      <section className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 border-b border-[#e4d8ca] pb-4 dark:border-neutral-800">
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">综测系统功能</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">申报审核、奖学金和荣誉称号功能已经放入独立申报系统入口。</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            title={isAdmin ? '分数管理' : '本班综测'}
            description={isAdmin ? '查看和维护学生综测分数，支撑后续申报候选筛选。' : '核对本班综测分数，完成综测审核小组签名。'}
            href={isAdmin ? '/scores' : '/monitor/scores'}
          />
          {isAdmin && (
            <>
              <ActionCard
                title="数据导入"
                description="导入学生名单、综测数据、体测成绩、体育课成绩和社区表现分。"
                href="/import"
              />
              <ActionCard
                title="导出附件"
                description="导出综测附件和基础材料，支持申报前材料准备。"
                href="/export"
              />
              <ActionCard
                title="学生管理"
                description="维护学生、班级、年级和班级类别。"
                href="/students"
              />
              <ActionCard
                title="系统设置"
                description="维护学年、开放状态和账号信息。"
                href="/settings"
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function ActionCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <AppLink
      to={href}
      className="group block rounded-lg border border-[#ded6c8] bg-white p-4 transition-colors hover:border-[#9a5b3d] hover:bg-[#fffaf2] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-primary-500"
    >
        <h3 className="text-sm font-semibold text-neutral-950 transition-colors group-hover:text-[#7c4a34] dark:text-white dark:group-hover:text-primary-300">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{description}</p>
    </AppLink>
  );
}
