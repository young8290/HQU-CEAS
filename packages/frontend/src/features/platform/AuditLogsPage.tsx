import { useEffect, useState } from 'react';
import DataPanel from '../../components/ui/DataPanel';
import { api } from '../../lib/api';
import { wsClient } from '../../lib/ws';

type SystemGroup = 'evaluation' | 'declaration' | 'shared';

/** 审计日志 module 值 → 所属系统映射（两系统日志分离，不改 schema）。 */
export const MODULE_SYSTEM_MAP: Record<string, SystemGroup> = {
  score_review: 'evaluation',
  award_quota: 'declaration',
  award_declaration: 'declaration',
  honor_declaration: 'declaration',
  declaration_review: 'declaration',
  declaration_supplement: 'declaration',
  class_honor: 'declaration',
  external_award: 'declaration',
  signature: 'shared',
  pdf: 'shared',
  mail: 'shared',
  system: 'shared',
};

const SYSTEM_TABS: { value: '' | SystemGroup; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'evaluation', label: '综测系统' },
  { value: 'declaration', label: '申报系统' },
  { value: 'shared', label: '公共' },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [systemFilter, setSystemFilter] = useState<'' | SystemGroup>('');
  const [moduleFilter, setModuleFilter] = useState('score_review');
  const [classId, setClassId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  function selectSystem(value: '' | SystemGroup) {
    setSystemFilter(value);
    // module 细粒度过滤不属于所选系统时清空，避免出现恒空的组合条件。
    if (value && moduleFilter && MODULE_SYSTEM_MAP[moduleFilter] !== value) {
      setModuleFilter('');
    }
  }

  async function loadLogs() {
    const params = new URLSearchParams();
    if (systemFilter) params.set('system', systemFilter);
    if (moduleFilter) params.set('module', moduleFilter);
    if (classId) params.set('classId', classId);
    if (academicYearId) params.set('academicYearId', academicYearId);
    try {
      const data = await api.get(`/platform/audit-logs${params.toString() ? `?${params.toString()}` : ''}`, { forceRefresh: true });
      setLogs(data.data || []);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [systemFilter, moduleFilter, classId, academicYearId]);

  useEffect(() => {
    wsClient.connect();
    wsClient.joinAuditAdmin();
    const handleAuditSync = (data: any) => {
      if (!data.log) return;
      setLogs((prev) => {
        if (systemFilter && MODULE_SYSTEM_MAP[data.log.module] !== systemFilter) return prev;
        if (moduleFilter && data.log.module !== moduleFilter) return prev;
        if (classId && String(data.log.classId || '') !== classId) return prev;
        if (academicYearId && String(data.log.academicYearId || '') !== academicYearId) return prev;
        return [data.log, ...prev.filter((item) => item.id !== data.log.id)].slice(0, 100);
      });
    };
    wsClient.on('audit-log:sync', handleAuditSync);
    return () => {
      wsClient.off('audit-log:sync', handleAuditSync);
      wsClient.disconnect();
    };
  }, [systemFilter, moduleFilter, classId, academicYearId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white">操作日志</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">导入、申报、审核、签名、PDF 和邮件记录。</p>
      </header>
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{message}</div>}
      <DataPanel title="日志列表">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">系统</span>
          {SYSTEM_TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              onClick={() => selectSystem(tab.value)}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${
                systemFilter === tab.value
                  ? 'border-[#d9c8b8] bg-[#ead9c7] font-medium text-[#7c4a34] dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300'
                  : 'border-[#d8c9b8] bg-white text-neutral-600 hover:bg-[#f1e5d4] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            placeholder="模块"
            className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
          />
          <input
            value={academicYearId}
            onChange={(event) => setAcademicYearId(event.target.value)}
            placeholder="学年编号"
            className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
          />
          <input
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            placeholder="班级编号"
            className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
              <tr>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">模块</th>
                <th className="px-3 py-2">班级</th>
                <th className="px-3 py-2">学年</th>
                <th className="px-3 py-2">动作</th>
                <th className="px-3 py-2">操作人</th>
                <th className="px-3 py-2">对象</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {logs.map((log) => (
                <tr key={log.id || `${log.action}-${log.createdAt}`}>
                  <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">{log.module}</td>
                  <td className="px-3 py-2">{log.classId || '-'}</td>
                  <td className="px-3 py-2">{log.academicYearId || '-'}</td>
                  <td className="px-3 py-2">{log.action}</td>
                  <td className="px-3 py-2">{log.actor?.displayName || log.actor?.username || '-'}</td>
                  <td className="px-3 py-2">{log.targetType || '-'} #{log.targetId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="py-10 text-center text-sm text-neutral-500">暂无日志</div>}
        </div>
      </DataPanel>
    </div>
  );
}
