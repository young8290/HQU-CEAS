import { useEffect, useState } from 'react';
import DataPanel from '../common/DataPanel';
import { api } from '../../lib/api';
import { wsClient } from '../../lib/ws';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [moduleFilter, setModuleFilter] = useState('score_review');
  const [classId, setClassId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  async function loadLogs() {
    const params = new URLSearchParams();
    if (moduleFilter) params.set('module', moduleFilter);
    if (classId) params.set('classId', classId);
    if (academicYearId) params.set('academicYearId', academicYearId);
    try {
      const data = await api.get(`/audit-logs${params.toString() ? `?${params.toString()}` : ''}`, { forceRefresh: true });
      setLogs(data.data || []);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [moduleFilter, classId, academicYearId]);

  useEffect(() => {
    wsClient.connect();
    wsClient.joinAuditAdmin();
    const handleAuditSync = (data: any) => {
      if (!data.log) return;
      setLogs((prev) => {
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
  }, [moduleFilter, classId, academicYearId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white">操作日志</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">查看导入、申报、审核、签名、PDF 和邮件相关操作记录。</p>
      </header>
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{message}</div>}
      <DataPanel title="日志列表">
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
