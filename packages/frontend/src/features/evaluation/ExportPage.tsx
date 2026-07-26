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

type ExportScope = 'evaluation' | 'declaration';

export default function ExportPage({ scope = 'evaluation' }: { scope?: ExportScope }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const user = getUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    try {
      const data = await api.get('/platform/grades');
      setGrades(data);
      if (!isAdmin && user?.gradeId) {
        setSelectedGrade(user.gradeId);
        loadClasses(user.gradeId);
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
      const data = await api.get(`/platform/grades/${gradeId}/classes`);
      setClasses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGradeChange = (gradeId: number) => {
    setSelectedGrade(gradeId);
    setSelectedClass(null);
    loadClasses(gradeId);
  };

  const handleExport = async (type: string) => {
    if (!selectedClass && !['all', 'accounts', 'failed', 'declarations', 'awardAllocation', 'honorDeclarations', 'declarationAttachment2', 'signatureNameList', 'mailLogs'].includes(type)) return;
    setExporting(true);
    setError('');
    setSuccessMsg('');

    try {
      let filename = '';
      let endpoint = '';

      // Build grade+class name prefix
      const gradeName = grades.find(g => g.id === selectedGrade)?.name || '';
      const className = classes.find(c => c.id === selectedClass)?.name || '';
      const prefix = `${gradeName}${className}`;

      switch (type) {
        case 'attachment2':
          endpoint = `/evaluation/export/attachment2/${selectedClass}`;
          filename = `${prefix}附件2.xlsx`;
          break;
        case 'attachment4':
          endpoint = `/evaluation/export/attachment4/${selectedClass}`;
          filename = `${prefix}附件4.xlsx`;
          break;
        case 'all':
          if (!selectedGrade) return;
          endpoint = `/evaluation/export/all/${selectedGrade}`;
          filename = `${gradeName}全部附件.zip`;
          break;
        case 'failed':
          endpoint = `/evaluation/export/failed-records`;
          filename = '导入失败记录.xlsx';
          break;
        case 'accounts':
          endpoint = `/evaluation/export/accounts`;
          filename = '账号列表.xlsx';
          break;
        case 'declarations':
          endpoint = `/declaration/export/declarations`;
          filename = '申报汇总.xlsx';
          break;
        case 'awardAllocation':
          endpoint = `/declaration/export/award-allocation`;
          filename = '院奖分配.xlsx';
          break;
        case 'honorDeclarations':
          endpoint = `/declaration/export/honor-declarations`;
          filename = '荣誉称号申报表.xlsx';
          break;
        case 'declarationAttachment2':
          endpoint = `/declaration/export/declaration-attachment2`;
          filename = '附件2.2024-2025学年院级奖学金、优秀学生干部、优秀学生汇总表【含填报说明】.xlsx';
          break;
        case 'signatureNameList':
          endpoint = `/declaration/export/signature-name-list`;
          filename = '附件2-签字名单.xlsx';
          break;
        case 'mailLogs':
          endpoint = `/declaration/export/mail-logs`;
          filename = '邮件发送记录.xlsx';
          break;
      }

      await api.download(endpoint, filename);
      setSuccessMsg(`已导出：${filename}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-950 dark:text-white font-headings">
          {scope === 'evaluation' ? '综测材料导出' : '申报材料导出'}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          {scope === 'evaluation'
            ? '综测附件、成绩汇总和失败记录。'
            : '申报汇总、院奖分配、荣誉明细、账号和邮件记录。'}
        </p>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Target Selection */}
      {scope === 'evaluation' && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-4 dark:border-neutral-800 dark:bg-neutral-900 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">选择年级</label>
            <select
              value={selectedGrade || ''}
              onChange={(e) => handleGradeChange(Number(e.target.value))}
              disabled={!isAdmin}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="">选择年级</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">选择班级</label>
            <select
              value={selectedClass || ''}
              onChange={(e) => setSelectedClass(Number(e.target.value))}
              disabled={!isAdmin && !!user?.classId}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="">选择班级</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scope === 'evaluation' && (
          <>
            <ExportCard
              title="导出附件2"
              description="按附件 2 模板生成综测汇总表"
              disabled={!selectedClass || exporting}
              onClick={() => handleExport('attachment2')}
              icon="附件2"
            />
            {isAdmin && (
              <ExportCard
                title="导出附件4"
                description="按附件 4 模板生成上报表"
                disabled={!selectedClass || exporting}
                onClick={() => handleExport('attachment4')}
                icon="附件4"
              />
            )}
            {isAdmin && (
              <ExportCard
                title="导出全部附件 ZIP"
                description="选定年级的附件 2 和附件 4"
                disabled={!selectedGrade || exporting}
                onClick={() => handleExport('all')}
                icon="ZIP"
              />
            )}
            {isAdmin && (
              <ExportCard
                title="导出导入失败记录"
                description="最近导入失败明细"
                disabled={exporting}
                onClick={() => handleExport('failed')}
                icon="失败"
              />
            )}
          </>
        )}
        {scope === 'declaration' && isAdmin && (
          <>
            <ExportCard
              title="导出申报汇总"
              description="申报批次、状态和学生数量"
              disabled={exporting}
              onClick={() => handleExport('declarations')}
              icon="申报"
            />
            <ExportCard
              title="导出院奖分配"
              description="班级名额和金额控制表"
              disabled={exporting}
              onClick={() => handleExport('awardAllocation')}
              icon="院奖"
            />
            <ExportCard
              title="导出附件2申报汇总表"
              description="院奖、优秀学生干部、优秀学生汇总"
              disabled={exporting}
              onClick={() => handleExport('declarationAttachment2')}
              icon="附件2"
            />
            <ExportCard
              title="附件2 签字名单（交学术部存档）"
              description="院级奖学金、优秀学生干部、优秀学生汇总表，打印后签字上交学术部存档。"
              disabled={exporting}
              onClick={() => handleExport('signatureNameList')}
              icon="签字"
            />
            <ExportCard
              title="导出荣誉称号明细"
              description="学生明细、材料和申报状态"
              disabled={exporting}
              onClick={() => handleExport('honorDeclarations')}
              icon="荣誉"
            />
            <ExportCard
              title="导出邮件记录"
              description="收件人、模板、状态和失败原因"
              disabled={exporting}
              onClick={() => handleExport('mailLogs')}
              icon="邮件"
            />
            <ExportCard
              title="导出账号列表"
              description="班长账号信息"
              disabled={exporting}
              onClick={() => handleExport('accounts')}
              icon="账号"
            />
          </>
        )}
      </div>
    </div>
  );
}

function ExportCard({ title, description, disabled, onClick, icon }: {
  title: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-5 text-left transition-colors hover:border-[#9a5b3d] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#ded6c8] disabled:hover:bg-[#fffaf2] dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-700 dark:hover:bg-neutral-950"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-500 dark:border-neutral-800">{icon}</span>
        <div>
          <h3 className="font-medium text-neutral-950 transition-colors group-hover:text-[#7c4a34] dark:text-white dark:group-hover:text-primary-400 font-headings">
            {title}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{description}</p>
        </div>
      </div>
    </button>
  );
}
