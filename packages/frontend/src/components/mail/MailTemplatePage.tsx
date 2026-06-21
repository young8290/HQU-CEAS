import { useEffect, useState } from 'react';
import DataPanel from '../common/DataPanel';
import { api } from '../../lib/api';

export default function MailTemplatePage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    setTemplates(await api.get('/mail/templates'));
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function save() {
    if (!editing) return;
    try {
      await api.put(`/mail/templates/${editing.id}`, {
        subject: editing.subject,
        body: editing.body,
        enabled: editing.enabled,
      });
      setMessage('邮件模板已保存');
      setEditing(null);
      load();
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white">邮件模板</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">维护班长账号通知、密码重置、申报开放和审核退回邮件内容。</p>
      </header>
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{message}</div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
        <DataPanel title="模板列表">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setEditing(template)}
                className="block w-full px-3 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-950"
              >
                <div className="font-medium text-neutral-900 dark:text-white">{template.subject}</div>
                <div className="text-xs text-neutral-500">{template.templateType}，版本 {template.version}</div>
              </button>
            ))}
          </div>
        </DataPanel>
        <DataPanel title="编辑模板" actions={editing && <button type="button" onClick={save} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">保存</button>}>
          {editing ? (
            <div className="space-y-3">
              <input value={editing.subject} onChange={(event) => setEditing({ ...editing, subject: event.target.value })} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" />
              <textarea value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} rows={12} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" />
              <p className="text-xs text-neutral-500">可用变量：{JSON.parse(editing.variablesJson || '[]').join('、')}</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">请选择左侧模板。</p>
          )}
        </DataPanel>
      </div>
    </div>
  );
}
