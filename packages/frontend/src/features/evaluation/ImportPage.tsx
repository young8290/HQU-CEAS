import { useEffect, useState } from 'react';
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

type ImportScope = 'evaluation' | 'declaration';

type ImportTypeItem = {
  value: string;
  label: string;
  description: string;
  adminOnly: boolean;
  scope: ImportScope;
};

const IMPORT_TYPES: ImportTypeItem[] = [
  { value: 'academic', label: '学业成绩', description: '教务成绩表，读取 F 列 GPA', adminOnly: true, scope: 'evaluation' },
  { value: 'sports', label: '体测与体育课成绩', description: '体测、体育课和年级阶段', adminOnly: true, scope: 'evaluation' },
  { value: 'personal', label: '个人综测填写表', description: '班级个人综测表', adminOnly: false, scope: 'evaluation' },
  { value: 'external_award', label: '外部奖项名单', description: '国奖、国励和校奖名单', adminOnly: true, scope: 'declaration' },
  { value: 'award_quota', label: '院奖名额金额', description: '班级名额和可支配金额', adminOnly: true, scope: 'declaration' },
  { value: 'class_honor', label: '先进班级名单', description: '先进班级和先进团支部', adminOnly: true, scope: 'declaration' },
  { value: 'declaration_supplement', label: '申报补充信息', description: '性别、处分、任职、竞赛活动和申报级别', adminOnly: false, scope: 'declaration' },
  { value: 'monitor_email', label: '班长邮箱', description: '班长邮箱与账号绑定', adminOnly: true, scope: 'declaration' },
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

export default function ImportPage({ scope = 'evaluation' }: { scope?: ImportScope }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [importType, setImportType] = useState<string>(scope === 'evaluation' ? 'academic' : 'external_award');
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [awardType, setAwardType] = useState('national_scholarship');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateMessage, setTemplateMessage] = useState('');

  const user = getUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadGrades();
    loadLogs();
    api.get('/evaluation/templates').then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const loadGrades = async () => {
    try {
      const data = await api.get('/platform/grades');
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
    } catch {}
  };

  const loadClasses = async (gradeId: number) => {
    try {
      const data = await api.get(`/platform/grades/${gradeId}/classes`);
      setClasses(data);
      if (!isAdmin && user?.classId) {
        setSelectedClass(user.classId);
      }
    } catch {}
  };

  const loadLogs = async () => {
    try {
      const data = await api.get('/evaluation/import/logs');
      setLogs(data);
    } catch {}
  };

  const handleGradeChange = (gradeId: number) => {
    setSelectedGrade(gradeId);
    setSelectedClass(null);
    loadClasses(gradeId);
  };

  const handleImport = async () => {
    if (importType === 'personal') {
      if (files.length === 0 || !selectedClass) return;
    } else if (!file) {
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);
    try {
      let endpoint = '';
      switch (importType) {
        case 'academic':
          endpoint = '/evaluation/import/academic';
          break;
        case 'sports':
          endpoint = '/evaluation/import/sports';
          break;
        case 'personal':
          endpoint = `/evaluation/import/personal/${selectedClass}`;
          break;
        case 'external_award':
          endpoint = '/declaration/external-awards/import';
          break;
        case 'award_quota':
          endpoint = '/declaration/award-quotas/import';
          break;
        case 'class_honor':
          endpoint = '/declaration/class-honors/import';
          break;
        case 'declaration_supplement':
          endpoint = user?.role === 'monitor' && user.classId ? `/declaration/declaration-supplements/import/${user.classId}` : '/declaration/declaration-supplements/import';
          break;
        case 'monitor_email':
          endpoint = '/platform/users/monitor-emails/import';
          break;
      }

      const data = importType === 'personal'
        ? await api.uploadMultiple(endpoint, files, 'files')
        : await (() => {
          const formData = new FormData();
          formData.append('file', file!);
          if (importType === 'external_award') {
            formData.append('awardType', awardType);
          }
          return api.upload(endpoint, formData);
        })();

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

  const availableTypes = IMPORT_TYPES.filter((item) => item.scope === scope && (isAdmin || !item.adminOnly));
  const visibleTemplates = templates.filter((template) => (TEMPLATE_SCOPE[template.type] || 'evaluation') === scope && (isAdmin || MONITOR_TEMPLATE_TYPES.has(template.type)));
  const needsClassSelection = importType === 'personal';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-950 dark:text-white font-headings">
          {scope === 'evaluation' ? '综测数据导入' : '申报数据导入'}
        </h1>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          {scope === 'evaluation' ? '学业成绩、体育成绩和个人综测表。' : '奖项、名额、先进班级和班长邮箱。'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {availableTypes.map((item) => (
          <button
            key={item.value}
            onClick={() => setImportType(item.value)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              importType === item.value
                ? 'border-[#9a5b3d] bg-[#fffaf2] text-[#7c4a34] dark:border-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                : 'border-[#ded6c8] bg-white text-neutral-600 hover:border-[#9a5b3d] hover:bg-[#fffaf2] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
            }`}
          >
            <div className="font-medium text-neutral-950 dark:text-white">{item.label}</div>
            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{item.description}</div>
          </button>
        ))}
      </div>

      {needsClassSelection && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {isAdmin && (
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">选择年级</label>
              <select
                value={selectedGrade || ''}
                onChange={(e) => handleGradeChange(Number(e.target.value))}
                className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              >
                <option value="">选择年级</option>
                {grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">选择班级</label>
            <select
              value={selectedClass || ''}
              onChange={(e) => setSelectedClass(Number(e.target.value))}
              disabled={!isAdmin && !!user?.classId}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="">选择班级</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {visibleTemplates.length > 0 && (
        <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 text-sm font-semibold text-neutral-950 dark:text-white">模板下载</h2>
          <div className="flex flex-wrap gap-2">
            {visibleTemplates.map((template) => (
              <button
                key={template.type}
                type="button"
                onClick={async () => {
                  await api.download(`/evaluation/templates/${template.type}/download`, `${template.name}.xlsx`);
                  setTemplateMessage(`已下载 ${template.name}`);
                }}
                className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {template.name}
              </button>
            ))}
          </div>
          {templateMessage && <p className="mt-2 text-xs text-neutral-500">{templateMessage}</p>}
        </div>
      )}

      {importType === 'external_award' && (
        <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">奖项类型</label>
          <select
            value={awardType}
            onChange={(event) => setAwardType(event.target.value)}
            className="w-full max-w-md rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          >
            <option value="national_scholarship">国家奖学金</option>
            <option value="national_inspirational_scholarship">国家励志奖学金</option>
            <option value="school_scholarship">校级奖学金</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            评选顺序：国奖和国励、校奖、院奖、荣誉称号。
          </p>
        </div>
      )}

      <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 dark:border-neutral-800 dark:bg-neutral-900">
        {importType === 'personal' ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">选择个人综测表文件夹</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              onChange={(e) => {
                const allFiles = Array.from(e.target.files || []);
                const excelFiles = allFiles.filter((item) => /\.(xlsx|xls)$/i.test(item.name));
                setFiles(excelFiles);
                setFile(null);
              }}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:rounded-md file:border file:border-[#d8c9b8] file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#7c4a34] hover:file:bg-[#f6f1e8] dark:file:border-neutral-800 dark:file:bg-neutral-950 dark:file:text-primary-300"
            />
            {files.length > 0 && <p className="mt-2 text-xs text-primary-600 dark:text-primary-400">已选择 {files.length} 个 Excel 文件</p>}
          </div>
        ) : (
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">选择文件</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:rounded-md file:border file:border-[#d8c9b8] file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#7c4a34] hover:file:bg-[#f6f1e8] dark:file:border-neutral-800 dark:file:bg-neutral-950 dark:file:text-primary-300"
            />
          </div>
        )}

        <div className="mt-4 rounded-md border border-[#e4d8ca] bg-white p-3 text-xs leading-6 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          {importType === 'academic' && <div><strong>学业成绩格式：</strong><br />读取 F 列 GPA，换算学业学术素质分。</div>}
          {importType === 'sports' && <div><strong>体育成绩格式：</strong><br />第 1 列学号，第 2 列姓名，第 3 列体测成绩，第 4 列体育课成绩，第 5 列年级阶段。</div>}
          {importType === 'personal' && <div><strong>个人综测表格式：</strong><br />学生信息页填写学号和姓名；七个模块页填写 A5:B19 明细。</div>}
          {importType === 'external_award' && <div><strong>外部奖项格式：</strong><br />国家奖学金、国家励志奖学金和校级奖学金。</div>}
          {importType === 'award_quota' && <div><strong>院奖名额格式：</strong><br />第 1 列年级，第 2 列班级，第 3 列名额，第 4 列可支配金额，第 5 列备注。</div>}
          {importType === 'class_honor' && <div><strong>先进班级格式：</strong><br />第 1 列年级，第 2 列班级，第 3 列荣誉类型。</div>}
          {importType === 'declaration_supplement' && <div><strong>申报补充格式：</strong><br />平均绩点按“学业学术素质分 / 8 - 2.5”计算；优秀学生干部推荐来源保留班级推荐和学生会推荐。</div>}
          {importType === 'monitor_email' && <div><strong>班长邮箱格式：</strong><br />第 1 列年级，第 2 列班级，第 3 列班长姓名，第 4 列邮箱。</div>}
        </div>

        <button
          onClick={handleImport}
          disabled={(importType === 'personal' ? files.length === 0 : !file) || (needsClassSelection && !selectedClass) || uploading}
          className="mt-4 rounded-md bg-[#9a5b3d] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? '导入中' : '导入'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950">
          <h3 className="mb-2 font-semibold text-green-700 dark:text-green-400">导入结果</h3>
          <div className="space-y-1 text-sm text-green-600 dark:text-green-400">
            <p>成功：{result.successCount ?? 0} 条</p>
            {(result.failCount ?? 0) > 0 && <p className="text-red-500">失败：{result.failCount} 条</p>}
          </div>
        </div>
      )}

      <div>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="text-sm text-neutral-500 hover:text-primary-600 transition-colors"
        >
          {showLogs ? '隐藏历史' : '导入历史'} ({logs.length})
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
                    <td className="px-4 py-2 text-xs text-neutral-400">{new Date(log.createdAt).toLocaleString()}</td>
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
