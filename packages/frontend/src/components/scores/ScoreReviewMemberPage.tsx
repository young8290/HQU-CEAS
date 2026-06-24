import { useEffect, useMemo, useState } from 'react';
import ScreenState from '../common/ScreenState';
import StatusChip from '../common/StatusChip';
import SignaturePad from '../signature/SignaturePad';
import SignatureUpload from '../signature/SignatureUpload';
import { api } from '../../lib/api';
import { clearAuth, getUser } from '../../lib/auth';
import { navigateTo } from '../../lib/router';
import { wsClient } from '../../lib/ws';
import { SCORE_CATEGORIES_ORDER, SCORE_RULES } from '../../lib/validation';

type CheckStatus = 'pending' | 'reviewed' | 'issue';

const statusLabels: Record<CheckStatus, string> = {
  pending: '待审核',
  reviewed: '已核对',
  issue: '有异议',
};

const statusTones: Record<CheckStatus, 'neutral' | 'success' | 'danger'> = {
  pending: 'neutral',
  reviewed: 'success',
  issue: 'danger',
};

function scoreText(value: number | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : '0.00';
}

function logActor(log: any) {
  return log.actor?.displayName || log.actor?.username || '系统';
}

export default function ScoreReviewMemberPage() {
  const user = getUser();
  const [session, setSession] = useState<any>(null);
  const [checks, setChecks] = useState<Record<number, any>>({});
  const [aggregate, setAggregate] = useState<Record<number, CheckStatus>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | CheckStatus>('all');

  async function loadSession() {
    try {
      const data = await api.get('/score-review-invites/session', { forceRefresh: true });
      setSession(data);
      setChecks(data.checks || {});
      setAggregate(data.aggregate || {});
      setLogs(data.logs || []);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!user?.classId) return;
    wsClient.connect();
    wsClient.joinClass(user.classId);

    const handleCheckSync = (data: any) => {
      setChecks((prev) => ({
        ...prev,
        [data.studentId]: {
          ...(prev[data.studentId] || {}),
          [data.check.memberId]: data.check,
        },
      }));
      setAggregate((prev) => ({ ...prev, [data.studentId]: data.aggregate }));
    };
    const handleLogSync = (data: any) => {
      if (!data.log) return;
      setLogs((prev) => [data.log, ...prev.filter((item) => item.id !== data.log.id)].slice(0, 50));
    };
    const handleSignatureSync = (data: any) => {
      setSession((prev: any) => prev ? { ...prev, record: data.record } : prev);
    };

    wsClient.on('score-review:check:sync', handleCheckSync);
    wsClient.on('score-review:log:sync', handleLogSync);
    wsClient.on('score-review:signature:sync', handleSignatureSync);
    return () => {
      wsClient.off('score-review:check:sync', handleCheckSync);
      wsClient.off('score-review:log:sync', handleLogSync);
      wsClient.off('score-review:signature:sync', handleSignatureSync);
      wsClient.disconnect();
    };
  }, [user?.classId]);

  const students = useMemo(() => {
    const list = session?.students || [];
    return list.filter((student: any) => {
      const ownStatus = checks[student.id]?.[session?.member?.id]?.status || 'pending';
      const matchesSearch = !search || student.name.includes(search) || student.studentNo.includes(search);
      const matchesFilter = filter === 'all' || ownStatus === filter;
      return matchesSearch && matchesFilter;
    });
  }, [session, checks, search, filter]);

  function updateCheck(studentId: number, status: CheckStatus) {
    const currentRemark = checks[studentId]?.[session.member.id]?.remark || '';
    const remark = status === 'issue'
      ? window.prompt('填写异议说明', currentRemark) || currentRemark
      : currentRemark;
    setChecks((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [session.member.id]: {
          studentId,
          memberId: session.member.id,
          status,
          remark,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    wsClient.updateReviewCheck(studentId, status, remark);
  }

  async function saveSignature(imageData: string, method: 'draw' | 'upload') {
    if (!session?.member) return;
    try {
      const signature = await api.post('/signatures', {
        signerName: session.member.name,
        method,
        purpose: 'score_review_confirmation',
        imageData,
      });
      const record = await api.post('/score-review-invites/signature', {
        signatureFileId: signature.id,
      });
      setSession((prev: any) => ({ ...prev, record }));
      setMessage('本人签名已保存');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  function logout() {
    clearAuth();
    navigateTo('/login', { replace: true });
  }

  if (loading) return <ScreenState label="评审页面加载中..." />;
  if (!session) {
    return (
      <main className="min-h-screen bg-[#f7f3eb] p-6 dark:bg-neutral-950">
        <ScreenState label={message || '评审会话不可用'} />
      </main>
    );
  }

  const ownMember = session.record?.members?.find((member: any) => member.id === session.member.id) || session.member;

  return (
    <main className="min-h-screen bg-[#f7f3eb] p-4 text-neutral-900 dark:bg-neutral-950 dark:text-white md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-[#ded6c8] pb-4 dark:border-neutral-800 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{session.class?.grade?.name || ''}{session.class?.name || ''}</p>
            <h1 className="text-2xl font-semibold">综测评审核对</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">当前成员：{session.member.name}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
          >
            退出
          </button>
        </header>

        {message && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {message}
          </div>
        )}

        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <div className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">本人确认书签名</h2>
                <StatusChip label={ownMember.signatureFileId ? '已签名' : '未签名'} tone={ownMember.signatureFileId ? 'success' : 'warning'} />
              </div>
              <SignaturePad
                signerName={session.member.name}
                purpose="score_review_confirmation"
                onSaved={(imageData) => saveSignature(imageData, 'draw')}
              />
              <div className="mt-3">
                <SignatureUpload onLoaded={(imageData) => saveSignature(imageData, 'upload')} />
              </div>
            </div>

            <div className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="mb-3 text-base font-semibold">班级操作日志</h2>
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.id || `${log.action}-${log.createdAt}`} className="rounded-md border border-neutral-100 p-3 text-sm dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-xs text-neutral-500">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">{logActor(log)} · {log.targetType || '-'}</p>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-sm text-neutral-500">暂无操作日志</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索学号或姓名"
                className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
              />
              {(['all', 'pending', 'reviewed', 'issue'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-md border px-3 py-2 text-sm ${filter === item ? 'border-[#9a5b3d] bg-[#fff3e6] text-[#7c4a34]' : 'border-[#d8c9b8] bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`}
                >
                  {item === 'all' ? '全部' : statusLabels[item]}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
                  <tr>
                    <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-3 text-left dark:bg-neutral-950">学号</th>
                    <th className="sticky left-[96px] z-10 bg-neutral-50 px-3 py-3 text-left dark:bg-neutral-950">姓名</th>
                    {SCORE_CATEGORIES_ORDER.map((category) => (
                      <th key={category} className="px-3 py-3 text-center whitespace-nowrap">{SCORE_RULES[category]?.label || category}</th>
                    ))}
                    <th className="px-3 py-3 text-center">本人状态</th>
                    <th className="px-3 py-3 text-center">汇总</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {students.map((student: any) => {
                    const ownCheck = checks[student.id]?.[session.member.id];
                    const ownStatus = (ownCheck?.status || 'pending') as CheckStatus;
                    const aggregateStatus = (aggregate[student.id] || 'pending') as CheckStatus;
                    return (
                      <tr key={student.id} className="hover:bg-[#fffaf2] dark:hover:bg-neutral-800/60">
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-mono text-xs">{student.studentNo}</td>
                        <td className="sticky left-[96px] z-10 bg-inherit px-3 py-2 font-medium">{student.name}</td>
                        {SCORE_CATEGORIES_ORDER.map((category) => (
                          <td key={category} className="px-3 py-2 text-center whitespace-nowrap" title={student.scores[category]?.remark || ''}>
                            {scoreText(student.scores[category]?.value)}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            {(['pending', 'reviewed', 'issue'] as CheckStatus[]).map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => updateCheck(student.id, status)}
                                className={`rounded-md border px-2 py-1 text-xs ${ownStatus === status ? 'border-[#9a5b3d] bg-[#fff3e6] text-[#7c4a34]' : 'border-neutral-200 text-neutral-500 dark:border-neutral-700'}`}
                              >
                                {statusLabels[status]}
                              </button>
                            ))}
                          </div>
                          {ownCheck?.remark && <p className="mt-1 text-center text-xs text-amber-700">{ownCheck.remark}</p>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <StatusChip label={statusLabels[aggregateStatus]} tone={statusTones[aggregateStatus]} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {students.length === 0 && <div className="py-10 text-center text-sm text-neutral-500">暂无匹配学生</div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
