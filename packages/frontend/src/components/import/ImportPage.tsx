import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

interface Grade {
  id: number;
  name: string;
}

interface ClassItem {
  id: number;
  name: string;
}

interface ImportLog {
  id: number;
  type: string;
  filename: string | null;
  successCount: number;
  failCount: number;
  failDetails: string | null;
  createdAt: string;
}

type ImportScope = 'evaluation' | 'declaration';

const IMPORT_TYPES = [
  { value: 'academic', label: '学业成绩', description: '导入教务系统导出的成绩表（F列GPA）', adminOnly: true, scope: 'evaluation' },
  { value: 'sports', label: '体测与体育课成绩', description: '导入体测成绩、体育课成绩和年级阶段', adminOnly: true, scope: 'evaluation' },
  { value: 'personal', label: '个人综测填写表', description: '导入班级同学的个人综测填写表', adminOnly: false, scope: 'evaluation' },
  { value: 'external_award', label: '外部奖项名单', description: '导入国奖、国励和校奖名单', adminOnly: true, scope: 'declaration' },
  { value: 'award_quota', label: '院奖名额金额', description: '导入班级名额和可支配金额控制表', adminOnly: true, scope: 'declaration' },
  { value: 'class_honor', label: '先进班级名单', description: '导入先进班级和先进团支部名单', adminOnly: true, scope: 'declaration' },
  { value: 'declaration_supplement', label: '申报补充信息', description: '导入性别、处分、任职、竞赛活动和推荐来源', adminOnly: false, scope: 'declaration' },
  { value: 'monitor_email', label: '班长邮箱', description: '导入班长邮箱并关联班长账号', adminOnly: true, scope: 'declaration' },
];

const TEMPLATE_SCOPE: Record<string, ImportScope> = {
  personal_forms: 'evaluation',
  external_awards: 'declaration',
  award_quotas: 'declaration',
  class_honors: 'declaration',
  declaration_supplements: 'declaration',
  monitor_emails: 'declaration',
};

const MONITOR_TEMPLATE_TYPES = new Set(['personal_forms', 'declaration_supplements']);

const defaultTypeByScope: Record<ImportScope, string> = {
  evaluation: 'academic',
  declaration: 'external_award',
};

export default function ImportPage({ scope = 'evaluation' }: { scope?: ImportScope }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [importType, setImportType] = useState<string>(defaultTypeByScope[scope]);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [awardType, setAwardType] = useState('national_scholarship');
  const [templates, setTemplates] = useState<any[]>([]);

  const user = getUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadGrades();
    loadLogs();
    api.get('/templates').then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const loadGrades = async () => {
    try {
      const data = await api.get('/grades');
      setGrades(data);
      if (!isAdmin && scope === 'evaluation' && user?.gradeId) {
        setSelectedGrade(user.gradeId);
        loadClasses(user.gradeId);
        setImportType('personal');
      } else if (!isAdmin && scope === 'declaration') {
        setImportType('declaration_supplement');
        if (user?.gradeId) {
          setSelectedGrade(user.gradeId);
          loadClasses(user.gradeId);
        }
        if (user?.classId) {
          setSelectedClass(user.classId);
        }
      } else if (data.length > 0) {
        setSelectedGrade(data[0].id);
        loadClasses(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadClasses = async (gradeId: number) => {
    try {
      const data = await api.get(`/grades/${gradeId}/classes`);
      setClasses(data);
      if (!isAdmin && user?.classId) {
        setSelectedClass(user.classId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await api.get('/import/logs');
      setLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGradeChange = (gradeId: number) => {
    setSelectedGrade(gradeId);
    setSelectedClass(null);
    loadClasses(gradeId);
  };

  const handleImport = async () => {
    if (importType === 'personal') {
      // Personal import: use folder/multiple files
      if (files.length === 0) return;
      if (!selectedClass) return;
    } else {
      if (!file) return;
    }
    setUploading(true);
    setError('');
    setResult(null);

    try {
      let endpoint = '';
      switch (importType) {
        case 'academic':
          endpoint = '/import/academic';
          break;
        case 'sports':
          endpoint = '/import/sports';
          break;
        case 'personal':
          endpoint = `/import/personal/${selectedClass}`;
          break;
        case 'external_award':
          endpoint = '/external-awards/import';
          break;
        case 'award_quota':
          endpoint = '/award-quotas/import';
          break;
        case 'class_honor':
          endpoint = '/class-honors/import';
          break;
        case 'declaration_supplement':
          endpoint = user?.role === 'monitor' && user.classId
            ? `/declaration-supplements/import/${user.classId}`
            : '/declaration-supplements/import';
          break;
        case 'monitor_email':
          endpoint = '/users/monitor-emails/import';
          break;
      }

      let data;
      if (importType === 'personal') {
        data = await api.uploadMultiple(endpoint, files, 'files');
      } else {
        const formData = new FormData();
        formData.append('file', file!);
        if (importType === 'external_award') {
          formData.append('awardType', awardType);
        }
        data = await api.upload(endpoint, formData);
      }
      setResult(data);
      setFile(null);
      setFiles([]);
      await loadLogs();
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setUploading(false);
    }
  };

  const availableTypes = IMPORT_TYPES.filter((t) => t.scope === scope && (isAdmin || !t.adminOnly));
  const visibleTemplates = templates.filter((template) => (
    (TEMPLATE_SCOPE[template.type] || 'evaluation') === scope
    && (isAdmin || MONITOR_TEMPLATE_TYPES.has(template.type))
  ));

  // academic/sports imports don't need class selection
  const needsClassSelection = importType === 'personal';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-950 dark:text-white font-headings">
          {scope === 'evaluation' ? '综测数据导入' : '申报数据导入'}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          {scope === 'evaluation'
            ? '导入学业成绩、体测体育课成绩和班级个人综测填写表。'
            : '导入奖项名单、院奖名额金额、先进班级名单和班长邮箱。'}
        </p>
      </div>

      {/* Import Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {availableTypes.map((t) => (
          <button
            key={t.value}
            onClick={() => setImportType(t.value)}
            className={`p-4 rounded-lg border text-left transition-colors ${
              importType === t.value
                ? 'border-[#9a5b3d] bg-[#fffaf2] text-[#7c4a34] dark:border-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                : 'border-[#ded6c8] bg-white text-neutral-600 hover:border-[#9a5b3d] hover:bg-[#fffaf2] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-primary-700'
            }`}
          >
            <div className="font-medium text-neutral-950 dark:text-white">{t.label}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t.description}</div>
          </button>
        ))}
      </div>

      {/* Target Selection - only for personal import */}
      {needsClassSelection && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isAdmin && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">选择年级</label>
            <select
              value={selectedGrade || ''}
              onChange={(e) => handleGradeChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md border border-[#d8c9b8] bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="">请选择年级</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">选择班级</label>
          <select
            value={selectedClass || ''}
            onChange={(e) => setSelectedClass(Number(e.target.value))}
            disabled={!isAdmin && !!user?.classId}
            className="w-full px-3 py-2 rounded-md border border-[#d8c9b8] bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          >
            <option value="">请选择班级</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      )}

      {visibleTemplates.length > 0 && (
        <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-white mb-3">模板下载</h2>
          <div className="flex flex-wrap gap-2">
            {visibleTemplates.map((template) => (
              <button
                key={template.type}
                type="button"
                onClick={() => api.download(`/templates/${template.type}/download`, `${template.name}.xlsx`)}
                className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {importType === 'external_award' && (
        <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">奖项类型</label>
          <select
            value={awardType}
            onChange={(event) => setAwardType(event.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-md border border-[#d8c9b8] bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          >
            <option value="national_scholarship">国家奖学金</option>
            <option value="national_inspirational_scholarship">国家励志奖学金</option>
            <option value="school_scholarship">校级奖学金</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            奖项评选顺序为国奖和国励、校奖、院奖和荣誉称号。外部奖项名单只作为标签和互斥依据保存。
          </p>
        </div>
      )}

      {/* File upload */}
      <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-4">
          {importType === 'personal' ? (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">选择文件夹（包含全班同学的综测填写表）</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              onChange={(e) => {
                const allFiles = Array.from(e.target.files || []);
                const excelFiles = allFiles.filter(f => /\.(xlsx|xls)$/i.test(f.name));
                setFiles(excelFiles);
                setFile(null);
              }}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:rounded-md file:border file:border-[#d8c9b8] file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#7c4a34] hover:file:bg-[#f6f1e8] dark:file:border-neutral-800 dark:file:bg-neutral-950 dark:file:text-primary-300"
            />
            {files.length > 0 && (
              <p className="mt-2 text-xs text-primary-600 dark:text-primary-400">
                已选择 {files.length} 个Excel文件
              </p>
            )}
          </div>
          ) : (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">选择文件</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:rounded-md file:border file:border-[#d8c9b8] file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#7c4a34] hover:file:bg-[#f6f1e8] dark:file:border-neutral-800 dark:file:bg-neutral-950 dark:file:text-primary-300"
            />
          </div>
          )}

          {/* Import type specific tips */}
          <div className="rounded-md border border-[#e4d8ca] bg-white p-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            {importType === 'academic' && (
              <div>
                <strong>学业成绩导入说明：</strong>
                <br />• 读取F列（GPA）数据
                <br />• 自动计算学业学术素质分 = (GPA + 2.5) × 8
                <br />• 按学号自动匹配全部学生，无需选择年级班级
              </div>
            )}
            {importType === 'sports' && (
              <div>
                <strong>体测与体育课成绩导入说明：</strong>
                <br />• 第1列学号，第2列姓名，第3列体测成绩，第4列体育课成绩，第5列年级阶段
                <br />• 大一和大二按 0.7 × 体测成绩 + 0.3 × 体育课成绩计算体育基础分
                <br />• 大三按体测成绩计算体育基础分
              </div>
            )}
            {importType === 'personal' && (
              <div>
                <strong>个人综测填写表导入说明：</strong>
                <br />• 选择包含全班同学综测表的文件夹，自动导入全部Excel文件
                <br />• 每个文件的每个工作表对应一个学生
                <br />• B1=学号, D1=姓名, B3-H3=各项分数, B4-H4=备注
                <br />• 列顺序: 德育(100) / 创新(13) / 体育附加(3) / 美育(6) / 劳动(4) / 公益(10) / 附加(5)
                <br />• 不匹配的学生会记录在失败列表中
              </div>
            )}
            {importType === 'external_award' && (
              <div>
                <strong>外部奖项名单导入说明：</strong>
                <br />• 第1列学号，第2列姓名，第3列奖项名称，第4列奖项等级
                <br />• 仅支持国家奖学金、国家励志奖学金和校级奖学金
                <br />• 导入顺序遵循国奖/国励、校奖、院奖/荣誉称号
              </div>
            )}
            {importType === 'award_quota' && (
              <div>
                <strong>院奖名额金额导入说明：</strong>
                <br />• 第1列年级，第2列班级，第3列名额，第4列可支配金额，第5列备注
              </div>
            )}
            {importType === 'class_honor' && (
              <div>
                <strong>先进班级名单导入说明：</strong>
                <br />• 第1列年级，第2列班级，第3列荣誉类型
              </div>
            )}
            {importType === 'declaration_supplement' && (
              <div>
                <strong>申报补充信息导入说明：</strong>
                <br />• 按模板填写性别、处分情况、学生本人意愿、申报级别、干部推荐来源、任职情况、科技作品竞赛活动情况和备注
                <br />• 平均绩点由系统按“学业学术素质分 / 8 - 2.5”自动计算，无需在模板中填写
                <br />• 优秀学生干部推荐来源可选“班级推荐”或“学生会推荐”，学生会推荐不占班级优秀学生干部名额
                <br />• 申报级别填写“校级”或“院级”，最终获奖级别由管理员审核时确认
              </div>
            )}
            {importType === 'monitor_email' && (
              <div>
                <strong>班长邮箱导入说明：</strong>
                <br />• 第1列年级，第2列班级，第3列班长姓名，第4列邮箱
                <br />• 系统会按年级和班级找到班长账号并写入邮箱
              </div>
            )}
          </div>

          <button
            onClick={handleImport}
            disabled={(importType === 'personal' ? files.length === 0 : !file) || (needsClassSelection && !selectedClass) || uploading}
            className="px-6 py-2.5 rounded-md bg-[#9a5b3d] text-sm font-medium text-white transition-colors hover:bg-[#7c4a34] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? '导入中...' : '开始导入'}
          </button>
        </div>
      </div>

      {/* Result */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950">
          <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">导入结果</h3>
          <div className="space-y-1 text-sm text-green-600 dark:text-green-400">
            <p>成功: {result.successCount ?? 0} 条</p>
            {(result.failCount ?? 0) > 0 && <p className="text-red-500">失败: {result.failCount} 条</p>}
            {result.failures?.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-red-500">失败记录:</p>
                <ul className="list-disc pl-5 mt-1 text-red-500">
                  {result.failures.slice(0, 20).map((r: any, i: number) => (
                    <li key={i}>{r.studentNo || r.name}: {r.reason}</li>
                  ))}
                  {result.failures.length > 20 && (
                    <li>...还有 {result.failures.length - 20} 条</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Logs */}
      <div>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="text-sm text-neutral-500 hover:text-primary-600 transition-colors"
        >
          {showLogs ? '隐藏' : '查看'}导入历史 ({logs.length})
        </button>
        {showLogs && logs.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                  <th className="px-4 py-2 text-left text-neutral-600 dark:text-neutral-300">时间</th>
                  <th className="px-4 py-2 text-left text-neutral-600 dark:text-neutral-300">类型</th>
                  <th className="px-4 py-2 text-left text-neutral-600 dark:text-neutral-300">成功</th>
                  <th className="px-4 py-2 text-left text-neutral-600 dark:text-neutral-300">失败</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-neutral-100 dark:border-neutral-800/50">
                    <td className="px-4 py-2 text-neutral-400 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{log.type}</td>
                    <td className="px-4 py-2 text-green-600">{log.successCount}</td>
                    <td className="px-4 py-2 text-red-500">{log.failCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
