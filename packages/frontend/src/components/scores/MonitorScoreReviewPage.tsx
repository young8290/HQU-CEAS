import { useEffect, useState } from 'react';
import DataPanel from '../common/DataPanel';
import ScreenState from '../common/ScreenState';
import StatusChip from '../common/StatusChip';
import SignaturePad from '../signature/SignaturePad';
import SignatureUpload from '../signature/SignatureUpload';
import ScoresPage from './ScoresPage';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { wsClient } from '../../lib/ws';

export default function MonitorScoreReviewPage() {
  const user = getUser();
  const classId = user?.classId;
  const [record, setRecord] = useState<any>(null);
  const [members, setMembers] = useState<Array<{ name: string; roleName: string }>>([]);
  const [invites, setInvites] = useState<Record<number, any>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!classId) {
      setLoading(false);
      return;
    }
    try {
      const [data, inviteData, logData] = await Promise.all([
        api.get(`/score-review-groups/${classId}`, { forceRefresh: true }),
        api.get(`/score-review-invites/${classId}`, { forceRefresh: true }),
        api.get(`/score-review-invites/${classId}/logs`, { forceRefresh: true }),
      ]);
      setRecord(data);
      setInvites(Object.fromEntries((inviteData.members || []).map((item: any) => [item.memberId, item])));
      setLogs(logData.data || []);
      setMembers((data.members || []).map((item: any) => ({
        name: item.name || '',
        roleName: item.roleName || '',
      })));
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    wsClient.connect();
    wsClient.joinClass(classId);
    const handleLogSync = (data: any) => {
      if (!data.log) return;
      setLogs((prev) => [data.log, ...prev.filter((item) => item.id !== data.log.id)].slice(0, 50));
    };
    const handleSignatureSync = (data: any) => {
      if (data.record) setRecord(data.record);
    };
    wsClient.on('score-review:log:sync', handleLogSync);
    wsClient.on('score-review:signature:sync', handleSignatureSync);
    return () => {
      wsClient.off('score-review:log:sync', handleLogSync);
      wsClient.off('score-review:signature:sync', handleSignatureSync);
      wsClient.disconnect();
    };
  }, [classId]);

  async function saveMemberSignature(memberId: number, imageData: string, method: 'draw' | 'upload') {
    if (!classId || !record?.id) return;
    try {
      const signature = await api.post('/signatures', {
        signerName: record.members.find((item: any) => item.id === memberId)?.name || '审核小组成员',
        method,
        purpose: 'score_review_confirmation',
        imageData,
      });
      const updated = await api.post(`/score-review-groups/${classId}/signatures`, {
        recordId: record.id,
        memberId,
        signatureFileId: signature.id,
      });
      setRecord(updated);
      setMessage('审核小组成员签名已保存');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function saveMembers() {
    if (!classId) return;
    const cleanMembers = members
      .map((item) => ({ name: item.name.trim(), roleName: item.roleName.trim() }))
      .filter((item) => item.name);
    if (cleanMembers.length === 0) {
      setMessage('审核小组成员不能为空');
      return;
    }
    try {
      const updated = await api.put(`/score-review-groups/${classId}/members`, {
        members: cleanMembers,
      });
      setRecord(updated);
      setMembers((updated.members || []).map((item: any) => ({
        name: item.name || '',
        roleName: item.roleName || '',
      })));
      setMessage('审核小组成员已保存');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function generateInvite(memberId: number) {
    if (!classId) return;
    try {
      const result = await api.post(`/score-review-invites/${classId}/members/${memberId}`, {
        baseUrl: window.location.origin,
      });
      await navigator.clipboard?.writeText(result.url);
      setInvites((prev) => ({
        ...prev,
        [memberId]: {
          ...(prev[memberId] || {}),
          inviteStatus: result.invite.status,
          deviceBound: Boolean(result.invite.deviceIdHash),
          expiresAt: result.invite.expiresAt,
          lastLoginAt: result.invite.lastLoginAt,
        },
      }));
      setMessage(`审核链接已生成并复制：${result.url}`);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function revokeInvite(memberId: number) {
    if (!classId) return;
    try {
      await api.delete(`/score-review-invites/${classId}/members/${memberId}`);
      setInvites((prev) => ({
        ...prev,
        [memberId]: {
          ...(prev[memberId] || {}),
          inviteStatus: 'revoked',
        },
      }));
      setMessage('审核链接已撤销');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  function updateMember(index: number, key: 'name' | 'roleName', value: string) {
    setMembers(members.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  }

  function removeMember(index: number) {
    setMembers(members.filter((_, itemIndex) => itemIndex !== index));
  }

  if (loading) return <ScreenState label="综测评审加载中..." />;

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {message}
        </div>
      )}

      <DataPanel
        title="综测审核小组成员"
        description="班级端自行填写审核小组成员，保存后由对应成员完成签名。"
        actions={(
          <button
            type="button"
            onClick={saveMembers}
            className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm font-medium text-white hover:bg-[#7c4a34]"
          >
            保存成员
          </button>
        )}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StatusChip label={record?.status === 'completed' ? '已完成' : '待签名'} tone={record?.status === 'completed' ? 'success' : 'warning'} />
          {record?.pdfFile && (
            <button
              type="button"
              onClick={() => api.download(`/pdf-materials/${record.pdfFile.id}/download`, `综测评审确认书-${record.pdfFile.id}.pdf`)}
              className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              下载确认书 PDF
            </button>
          )}
        </div>

        <div className="mb-5 space-y-2 rounded-lg border border-[#ded6c8] bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
          {members.map((member, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={member.name}
                onChange={(event) => updateMember(index, 'name', event.target.value)}
                placeholder="成员姓名"
                className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
              <input
                value={member.roleName}
                onChange={(event) => updateMember(index, 'roleName', event.target.value)}
                placeholder="成员职务"
                className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => removeMember(index)}
                className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
              >
                移除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMembers([...members, { name: '', roleName: '' }])}
            className="rounded-md border border-[#d8c9b8] bg-[#fffaf2] px-3 py-2 text-sm text-[#7c4a34] hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-900 dark:text-primary-300"
          >
            添加成员
          </button>
        </div>

        {record?.members?.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {record.members.map((member: any) => {
              const invite = invites[member.id];
              return (
                <div key={member.id} className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{member.name}</p>
                      <p className="text-xs text-neutral-500">{member.roleName || '审核小组成员'}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <StatusChip label={member.signatureFileId ? '已签名' : '未签名'} tone={member.signatureFileId ? 'success' : 'warning'} />
                      <StatusChip label={invite?.deviceBound ? '已绑定设备' : '未绑定设备'} tone={invite?.deviceBound ? 'success' : 'neutral'} />
                    </div>
                  </div>
                  <div className="mb-3 rounded-md border border-[#eee4d8] bg-[#fffaf2] p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateInvite(member.id)}
                        className="rounded-md bg-[#9a5b3d] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7c4a34]"
                      >
                        {invite?.inviteStatus === 'active' ? '刷新审核链接' : '生成审核链接'}
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeInvite(member.id)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                      >
                        撤销链接
                      </button>
                    </div>
                    <p>链接状态：{invite?.inviteStatus || 'none'}</p>
                    <p>最近访问：{invite?.lastLoginAt ? new Date(invite.lastLoginAt).toLocaleString() : '-'}</p>
                    <p>过期时间：{invite?.expiresAt ? new Date(invite.expiresAt).toLocaleString() : '-'}</p>
                  </div>
                  <SignaturePad
                    signerName={member.name}
                    purpose="综测评审确认书"
                    onSaved={(imageData) => saveMemberSignature(member.id, imageData, 'draw')}
                  />
                  <div className="mt-3">
                    <SignatureUpload onLoaded={(imageData) => saveMemberSignature(member.id, imageData, 'upload')} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">保存审核小组成员后即可采集签名。</p>
        )}
      </DataPanel>

      <DataPanel title="班级操作日志" description="展示本班综测评审邀请、登录、审核状态和签名记录。">
        <div className="max-h-[360px] overflow-y-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
              <tr>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">动作</th>
                <th className="px-3 py-2">操作人</th>
                <th className="px-3 py-2">对象</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {logs.map((log) => (
                <tr key={log.id || `${log.action}-${log.createdAt}`}>
                  <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">{log.action}</td>
                  <td className="px-3 py-2">{log.actor?.displayName || log.actor?.username || '-'}</td>
                  <td className="px-3 py-2">{log.targetType || '-'} #{log.targetId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="py-8 text-center text-sm text-neutral-500">暂无操作日志</div>}
        </div>
      </DataPanel>

      <ScoresPage />
    </div>
  );
}
