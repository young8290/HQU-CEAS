import { useEffect, useState } from 'react';
import DataPanel from '../common/DataPanel';
import StatusChip from '../common/StatusChip';
import { api } from '../../lib/api';

export default function MailPage() {
  const [settings, setSettings] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [form, setForm] = useState({ smtpHost: 'smtp.163.com', smtpPort: 465, username: '', password: '', senderName: '计算机科学与技术学院学术部', enabled: false });
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [settingData, logData] = await Promise.all([
      api.get('/mail/settings'),
      api.get('/mail/logs'),
    ]);
    setSettings(settingData);
    setLogs(logData.data || []);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function saveSettings() {
    try {
      await api.put('/mail/settings', form);
      setMessage('邮件配置已保存');
      load();
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function sendTest() {
    try {
      await api.post('/mail/settings/test', { recipientEmail: testEmail });
      setMessage('测试邮件已发送');
      load();
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function retry(logId: number) {
    try {
      await api.post(`/mail/logs/${logId}/retry`);
      setMessage('邮件已重新发送');
      load();
    } catch (error: any) {
      setMessage(error.message);
      load();
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white">邮箱配置与发送记录</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">SMTP 配置、发送记录和失败重发。</p>
      </header>
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{message}</div>}
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <DataPanel title="SMTP 配置" description={settings?.configured ? `账号：${settings.username}` : '尚未配置'}>
          <div className="space-y-3">
            <Input label="SMTP 主机" value={form.smtpHost} onChange={(value) => setForm({ ...form, smtpHost: value })} />
            <Input label="端口" value={String(form.smtpPort)} onChange={(value) => setForm({ ...form, smtpPort: Number(value) })} />
            <Input label="账号" value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
            <Input label="授权码" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
            <Input label="发件人显示名" value={form.senderName} onChange={(value) => setForm({ ...form, senderName: value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="h-4 w-4 accent-primary-600" />
              启用发送
            </label>
            <button type="button" onClick={saveSettings} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">保存配置</button>
          </div>
        </DataPanel>
        <DataPanel
          title="发送记录"
          actions={(
            <div className="flex gap-2">
              <input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="测试收件邮箱" className="rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950" />
              <button type="button" onClick={sendTest} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">测试发送</button>
            </div>
          )}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
                <tr>
                  <th className="px-3 py-2">收件人</th>
                  <th className="px-3 py-2">模板</th>
                  <th className="px-3 py-2">主题</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">失败原因</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2">{log.recipientEmail}</td>
                    <td className="px-3 py-2">{log.templateType}</td>
                    <td className="px-3 py-2">{log.subject}</td>
                    <td className="px-3 py-2"><StatusChip label={log.status} tone={log.status === 'sent' ? 'success' : 'danger'} /></td>
                    <td className="max-w-[280px] px-3 py-2 text-xs text-neutral-500">{log.failureReason || '-'}</td>
                    <td className="px-3 py-2">
                      {log.status === 'failed' ? (
                        <button
                          type="button"
                          onClick={() => retry(log.id)}
                          className="rounded-md border border-[#d8c9b8] px-3 py-1.5 text-xs text-[#7c4a34] hover:bg-[#fffaf2] dark:border-neutral-800 dark:text-primary-300"
                        >
                          重发
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600 dark:text-neutral-300">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" />
    </label>
  );
}
