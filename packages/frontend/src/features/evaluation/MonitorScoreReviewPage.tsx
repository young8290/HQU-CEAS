import { useEffect, useState } from 'react';
import DataPanel from '../../components/ui/DataPanel';
import ScreenState from '../../components/ui/ScreenState';
import StatusChip from '../../components/ui/StatusChip';
import SignaturePad from '../../components/ui/SignaturePad';
import SignatureUpload from '../../components/ui/SignatureUpload';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { wsClient } from '../../lib/ws';

interface ReviewMemberDraft {
  id?: number;
  name: string;
  roleName: string;
  signatureFileId?: number | null;
  signedAt?: string | null;
}

type CheckStatus = 'pending' | 'reviewed' | 'issue';

interface ReviewStatusStudent {
  id: number;
  studentNo: string;
  name: string;
}

interface ReviewStatusMember {
  id: number;
  name: string;
  roleName?: string | null;
}

const reviewStatusLabels: Record<CheckStatus, string> = {
  pending: '待审核',
  reviewed: '已核对',
  issue: '有异议',
};

const reviewStatusTones: Record<CheckStatus, 'neutral' | 'success' | 'danger'> = {
  pending: 'neutral',
  reviewed: 'success',
  issue: 'danger',
};

function toMemberDrafts(items: any[]): ReviewMemberDraft[] {
  return items.map((item: any) => ({
    id: item.id,
    name: item.name || '',
    roleName: item.roleName || '',
    signatureFileId: item.signatureFileId ?? null,
    signedAt: item.signedAt ?? null,
  }));
}

function toInviteMap(inviteData: any) {
  return Object.fromEntries((inviteData.members || []).map((item: any) => [item.memberId, item]));
}

export default function MonitorScoreReviewPage() {
  const user = getUser();
  const classId = user?.classId;
  const [record, setRecord] = useState<any>(null);
  const [members, setMembers] = useState<ReviewMemberDraft[]>([]);
  const [invites, setInvites] = useState<Record<number, any>>({});
  const [reviewStatusMembers, setReviewStatusMembers] = useState<ReviewStatusMember[]>([]);
  const [reviewStudents, setReviewStudents] = useState<ReviewStatusStudent[]>([]);
  const [reviewChecks, setReviewChecks] = useState<Record<number, Record<number, any>>>({});
  const [reviewAggregate, setReviewAggregate] = useState<Record<number, CheckStatus>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  function applyReviewCheckData(checkData: any) {
    setReviewStatusMembers(checkData.members || []);
    setReviewStudents(checkData.students || []);
    setReviewChecks(checkData.checks || {});
    setReviewAggregate(checkData.aggregate || {});
  }

  async function loadReviewChecks() {
    if (!classId) return;
    const checkData = await api.get(`/evaluation/score-review-invites/${classId}/checks`, { forceRefresh: true });
    applyReviewCheckData(checkData);
  }

  async function load() {
    if (!classId) {
      setLoading(false);
      return;
    }
    try {
      const [data, inviteData, logData, checkData] = await Promise.all([
        api.get(`/evaluation/score-review-groups/${classId}`, { forceRefresh: true }),
        api.get(`/evaluation/score-review-invites/${classId}`, { forceRefresh: true }),
        api.get(`/evaluation/score-review-invites/${classId}/logs`, { forceRefresh: true }),
        api.get(`/evaluation/score-review-invites/${classId}/checks`, { forceRefresh: true }),
      ]);
      setRecord(data);
      setInvites(toInviteMap(inviteData));
      setLogs(logData.data || []);
      setMembers(toMemberDrafts(data.members || []));
      applyReviewCheckData(checkData);
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
      loadReviewChecks().catch((error: any) => setMessage(error.message));
    };
    const handleSignatureSync = (data: any) => {
      if (data.record) {
        setRecord(data.record);
        setMembers(toMemberDrafts(data.record.members || []));
        setReviewStatusMembers((data.record.members || []).map((member: any) => ({
          id: member.id,
          name: member.name,
          roleName: member.roleName,
        })));
      }
    };
    const handleCheckSync = (data: any) => {
      setReviewChecks((prev) => ({
        ...prev,
        [data.studentId]: {
          ...(prev[data.studentId] || {}),
          [data.check.memberId]: data.check,
        },
      }));
      setReviewAggregate((prev) => ({ ...prev, [data.studentId]: data.aggregate }));
    };
    const handleReviewConnectionReady = () => {
      loadReviewChecks().catch((error: any) => setMessage(error.message));
    };
    wsClient.on('score-review:log:sync', handleLogSync);
    wsClient.on('score-review:signature:sync', handleSignatureSync);
    wsClient.on('score-review:check:sync', handleCheckSync);
    wsClient.on('connected', handleReviewConnectionReady);
    wsClient.on('joined:class', handleReviewConnectionReady);
    return () => {
      wsClient.off('score-review:log:sync', handleLogSync);
      wsClient.off('score-review:signature:sync', handleSignatureSync);
      wsClient.off('score-review:check:sync', handleCheckSync);
      wsClient.off('connected', handleReviewConnectionReady);
      wsClient.off('joined:class', handleReviewConnectionReady);
      wsClient.disconnect();
    };
  }, [classId]);

  async function saveMemberSignature(memberId: number, imageData: string, method: 'draw' | 'upload') {
    if (!classId || !record?.id) return;
    try {
      const signature = await api.post('/platform/signatures', {
        signerName: record.members.find((item: any) => item.id === memberId)?.name || '审核小组成员',
        method,
        purpose: 'score_review_confirmation',
        imageData,
      });
      const updated = await api.post(`/evaluation/score-review-groups/${classId}/signatures`, {
        recordId: record.id,
        memberId,
        signatureFileId: signature.id,
      });
      setRecord(updated);
      setMembers(toMemberDrafts(updated.members || []));
      setMessage('签名已保存');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function saveMembers() {
    if (!classId) return;
    const cleanMembers = members
      .map((item) => ({ id: item.id, name: item.name.trim(), roleName: item.roleName.trim() }))
      .filter((item) => item.name);
    if (cleanMembers.length === 0) {
      setMessage('审核小组成员不能为空');
      return;
    }
    try {
      const updated = await api.put(`/evaluation/score-review-groups/${classId}/members`, {
        members: cleanMembers,
      });
      const [inviteData, checkData] = await Promise.all([
        api.get(`/evaluation/score-review-invites/${classId}`, { forceRefresh: true }),
        api.get(`/evaluation/score-review-invites/${classId}/checks`, { forceRefresh: true }),
      ]);
      setRecord(updated);
      setMembers(toMemberDrafts(updated.members || []));
      setInvites(toInviteMap(inviteData));
      applyReviewCheckData(checkData);
      setMessage('审核小组成员已保存');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function generateInvite(memberId: number) {
    if (!classId) return;
    try {
      const result = await api.post(`/evaluation/score-review-invites/${classId}/members/${memberId}`, {
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
      setMessage(`审核链接已复制：${result.url}`);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function revokeInvite(memberId: number) {
    if (!classId) return;
    try {
      await api.delete(`/evaluation/score-review-invites/${classId}/members/${memberId}`);
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
    setMembers(members.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function removeMember(index: number) {
    setMembers(members.filter((_, itemIndex) => itemIndex !== index));
  }

  if (loading) return <ScreenState label="综测评审加载中" />;

  const savedMembersById = new Map<number, any>((record?.members || []).map((member: any) => [member.id, member]));
  const reviewMemberCards = members
    .map((member, index) => {
      const savedMember = typeof member.id === 'number' ? savedMembersById.get(member.id) : null;
      const name = member.name.trim();
      const roleName = member.roleName.trim();
      const savedRoleName = savedMember?.roleName || '';
      const isSaved = Boolean(savedMember);
      const isDirty = Boolean(savedMember && (name !== savedMember.name || roleName !== savedRoleName));
      return {
        ...member,
        draftIndex: index,
        name,
        roleName,
        signatureFileId: isDirty ? null : savedMember?.signatureFileId ?? member.signatureFileId ?? null,
        signedAt: isDirty ? null : savedMember?.signedAt ?? member.signedAt ?? null,
        isSaved,
        isDirty,
      };
    })
    .filter((member) => member.name);
  const reviewStatusSummary = {
    pending: reviewStudents.filter((student) => (reviewAggregate[student.id] || 'pending') === 'pending').length,
    reviewed: reviewStudents.filter((student) => reviewAggregate[student.id] === 'reviewed').length,
    issue: reviewStudents.filter((student) => reviewAggregate[student.id] === 'issue').length,
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {message}
        </div>
      )}

      <DataPanel
        title="综测审核小组成员"
        description="维护成员、审核链接和签名。"
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
              onClick={() => api.download(`/platform/pdf-materials/${record.pdfFile.id}/download`, `综测评审确认书-${record.pdfFile.id}.pdf`)}
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

        {reviewMemberCards.length ? (
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
            {reviewMemberCards.map((member) => {
              const canUseMemberActions = member.isSaved && !member.isDirty && typeof member.id === 'number';
              const invite = canUseMemberActions ? invites[member.id!] : null;
              const signatureLabel = !member.isSaved
                ? '新增待保存'
                : member.isDirty
                  ? '修改待保存'
                  : member.signatureFileId
                    ? '已签名'
                    : '未签名';
              const signatureTone = !member.isSaved || member.isDirty
                ? 'warning'
                : member.signatureFileId
                  ? 'success'
                  : 'warning';
              return (
                <div key={member.id ?? `draft-${member.draftIndex}`} className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{member.name}</p>
                      <p className="text-xs text-neutral-500">{member.roleName || '审核小组成员'}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <StatusChip label={signatureLabel} tone={signatureTone} />
                      {canUseMemberActions ? (
                        <StatusChip label={invite?.deviceBound ? '已绑定设备' : '未绑定设备'} tone={invite?.deviceBound ? 'success' : 'neutral'} />
                      ) : (
                        <StatusChip label="待保存" tone="neutral" />
                      )}
                    </div>
                  </div>
                  <div className="mb-3 rounded-md border border-[#eee4d8] bg-[#fffaf2] p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!canUseMemberActions}
                        onClick={() => generateInvite(member.id!)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                          canUseMemberActions
                            ? 'bg-[#9a5b3d] text-white hover:bg-[#7c4a34]'
                            : 'cursor-not-allowed bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}
                      >
                        {invite?.inviteStatus === 'active' ? '刷新链接' : '生成链接'}
                      </button>
                      <button
                        type="button"
                        disabled={!canUseMemberActions}
                        onClick={() => revokeInvite(member.id!)}
                        className={`rounded-md border px-3 py-1.5 text-xs ${
                          canUseMemberActions
                            ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300'
                            : 'cursor-not-allowed border-neutral-200 text-neutral-400 dark:border-neutral-800 dark:text-neutral-500'
                        }`}
                      >
                        撤销链接
                      </button>
                    </div>
                    {canUseMemberActions ? (
                      <>
                        <p>链接状态：{invite?.inviteStatus || 'none'}</p>
                        <p>最近访问：{invite?.lastLoginAt ? new Date(invite.lastLoginAt).toLocaleString() : '-'}</p>
                        <p>过期时间：{invite?.expiresAt ? new Date(invite.expiresAt).toLocaleString() : '-'}</p>
                      </>
                    ) : (
                      <p>保存成员后生成链接并采集签名。</p>
                    )}
                  </div>
                  {canUseMemberActions ? (
                    <>
                      <SignaturePad signerName={member.name} purpose="综测评审确认书" onSaved={(imageData) => saveMemberSignature(member.id!, imageData, 'draw')} />
                      <div className="mt-3">
                        <SignatureUpload onLoaded={(imageData) => saveMemberSignature(member.id!, imageData, 'upload')} />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md border border-[#ded6c8] bg-[#fffaf2] px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
                      保存成员后采集签名
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">保存成员后采集签名。</p>
        )}
      </DataPanel>

      <DataPanel title="学生审核状态汇总" description="按学生查看各成员核对进度。">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StatusChip label={`待审核 ${reviewStatusSummary.pending}`} tone="neutral" />
          <StatusChip label={`已核对 ${reviewStatusSummary.reviewed}`} tone="success" />
          <StatusChip label={`有异议 ${reviewStatusSummary.issue}`} tone="danger" />
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="w-[132px] min-w-[132px] px-3 py-3">学号</th>
                <th className="w-[120px] min-w-[120px] px-3 py-3">姓名</th>
                {reviewStatusMembers.map((member) => (
                  <th key={member.id} className="w-[140px] min-w-[140px] px-3 py-3 text-center">
                    {member.name}
                  </th>
                ))}
                <th className="w-[112px] min-w-[112px] px-3 py-3 text-center">汇总</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {reviewStudents.map((student) => {
                const aggregateStatus = (reviewAggregate[student.id] || 'pending') as CheckStatus;
                return (
                  <tr key={student.id} className="hover:bg-[#fffaf2] dark:hover:bg-neutral-900">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{student.studentNo}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{student.name}</td>
                    {reviewStatusMembers.map((member) => {
                      const check = reviewChecks[student.id]?.[member.id];
                      const status = (check?.status || 'pending') as CheckStatus;
                      return (
                        <td key={member.id} className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StatusChip label={reviewStatusLabels[status]} tone={reviewStatusTones[status]} />
                            {check?.remark && (
                              <span className="max-w-[132px] truncate text-xs text-amber-700 dark:text-amber-300" title={check.remark}>
                                {check.remark}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <StatusChip label={reviewStatusLabels[aggregateStatus]} tone={reviewStatusTones[aggregateStatus]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {reviewStudents.length === 0 && <div className="py-8 text-center text-sm text-neutral-500">暂无学生审核状态</div>}
        </div>
      </DataPanel>

      <DataPanel title="班级操作日志" description="邀请、登录、核对和签名记录。">
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
    </div>
  );
}
