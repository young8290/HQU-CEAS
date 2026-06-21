import { useEffect, useState } from 'react';
import DataPanel from '../common/DataPanel';
import { api } from '../../lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/audit-logs')
      .then((data) => setLogs(data.data || []))
      .catch((error) => setMessage(error.message));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white">操作日志</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">查看导入、申报、审核、签名、PDF 和邮件相关操作记录。</p>
      </header>
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{message}</div>}
      <DataPanel title="日志列表">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
              <tr><th className="px-3 py-2">时间</th><th className="px-3 py-2">模块</th><th className="px-3 py-2">动作</th><th className="px-3 py-2">操作人</th><th className="px-3 py-2">对象</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{log.module}</td>
                  <td className="px-3 py-2">{log.action}</td>
                  <td className="px-3 py-2">{log.actor?.displayName || log.actor?.username || '-'}</td>
                  <td className="px-3 py-2">{log.targetType || '-'} #{log.targetId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataPanel>
    </div>
  );
}
