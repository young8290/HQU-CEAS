import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import ScreenState from '../../components/ui/ScreenState';
import StatusChip from '../../components/ui/StatusChip';
import SignaturePad from '../../components/ui/SignaturePad';
import SignatureUpload from '../../components/ui/SignatureUpload';
import { reviewApi } from '../../lib/api';
import { clearReviewAuth, getReviewUser, isReviewLoggedIn } from '../../lib/auth';
import { navigateTo } from '../../lib/router';
import { reviewWsClient } from '../../lib/ws';
import { EVALUATION_SCORE_CATEGORIES_ORDER, SCORE_RULES, supportsScoreDetails } from '../../lib/validation';

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

function scoreDetails(student: any, category: string) {
  return student.details?.[category] || [];
}

function detailsTotal(items: Array<{ itemScore: number }>) {
  return items.reduce((sum, item) => sum + Number(item.itemScore || 0), 0);
}

export default function ScoreReviewMemberPage() {
  const user = getReviewUser();
  const [session, setSession] = useState<any>(null);
  const [checks, setChecks] = useState<Record<number, any>>({});
  const [aggregate, setAggregate] = useState<Record<number, CheckStatus>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | CheckStatus>('all');
  const [activeDetail, setActiveDetail] = useState<{ student: any; category: string } | null>(null);

  async function loadSession() {
    if (!isReviewLoggedIn()) {
      navigateTo('/review-login', { replace: true });
      return;
    }
    try {
      const status = await reviewApi.get('/platform/system/entry-status', { forceRefresh: true });
      if (status.entryStatus?.comprehensiveEvalOpen !== true) {
        setSession(null);
        setMessage('综测系统当前关闭');
        return;
      }
      const data = await reviewApi.get('/evaluation/score-review-invites/session', { forceRefresh: true });
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
    reviewWsClient.connect();
    reviewWsClient.joinClass(user.classId);

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
      setSession((prev: any) => (prev ? { ...prev, record: data.record } : prev));
    };

    reviewWsClient.on('score-review:check:sync', handleCheckSync);
    reviewWsClient.on('score-review:log:sync', handleLogSync);
    reviewWsClient.on('score-review:signature:sync', handleSignatureSync);
    return () => {
      reviewWsClient.off('score-review:check:sync', handleCheckSync);
      reviewWsClient.off('score-review:log:sync', handleLogSync);
      reviewWsClient.off('score-review:signature:sync', handleSignatureSync);
      reviewWsClient.disconnect();
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

  async function updateCheck(studentId: number, status: CheckStatus) {
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
    try {
      const result = await reviewApi.put(`/evaluation/score-review-invites/checks/${studentId}`, { status, remark });
      setChecks((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [result.check.memberId]: result.check,
        },
      }));
      setAggregate((prev) => ({ ...prev, [studentId]: result.aggregate }));
    } catch (error: any) {
      await loadSession();
      setMessage(error.message);
    }
  }

  async function saveSignature(imageData: string, method: 'draw' | 'upload') {
    if (!session?.member) return;
    try {
      const signature = await reviewApi.post('/platform/signatures', {
        signerName: session.member.name,
        method,
        purpose: 'score_review_confirmation',
        imageData,
      });
      const record = await reviewApi.post('/evaluation/score-review-invites/signature', {
        signatureFileId: signature.id,
      });
      setSession((prev: any) => ({ ...prev, record }));
      setMessage('本人签名已保存');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  function logout() {
    clearReviewAuth();
    reviewWsClient.disconnect();
    navigateTo('/review-login', { replace: true });
  }

  if (loading) return <ScreenState label="评审页面加载中" />;
  if (!session) {
    return (
      <main className="min-h-screen bg-[#f7f3eb] p-6 dark:bg-neutral-950">
        <ScreenState label={message || '评审会话不可用'} />
      </main>
    );
  }

  const ownMember = session.record?.members?.find((member: any) => member.id === session.member.id) || session.member;
  const allStudents = session.students || [];
  const reviewedCount = allStudents.filter((student: any) => checks[student.id]?.[session.member.id]?.status === 'reviewed').length;
  const issueCount = allStudents.filter((student: any) => checks[student.id]?.[session.member.id]?.status === 'issue').length;
  const pendingCount = Math.max(0, allStudents.length - reviewedCount - issueCount);
  const activeDetailItems = activeDetail ? scoreDetails(activeDetail.student, activeDetail.category) : [];

  return (
    <main className="min-h-screen bg-[#f7f3eb] p-4 text-neutral-900 dark:bg-neutral-950 dark:text-white md:p-6">
      <div className="mx-auto max-w-[1680px] space-y-5">
        <header className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{session.class?.grade?.name || ''}{session.class?.name || ''}</p>
              <h1 className="mt-1 text-2xl font-semibold">综测评审核对</h1>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">成员：{session.member.name}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <div className="rounded-md border border-[#eee4d8] bg-[#fffaf2] px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs text-neutral-500">待核对</p>
                <p className="mt-1 text-lg font-semibold">{pendingCount}</p>
              </div>
              <div className="rounded-md border border-[#d9ead7] bg-[#f4fbf2] px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="text-xs text-neutral-500">已核对</p>
                <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">{reviewedCount}</p>
              </div>
              <div className="rounded-md border border-[#f1d1c9] bg-[#fff4ef] px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-xs text-neutral-500">有异议</p>
                <p className="mt-1 text-lg font-semibold text-red-700 dark:text-red-300">{issueCount}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-4 rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
          >
            退出
          </button>
        </header>

        {message && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {message}
          </div>
        )}

        <section className="space-y-4">
          <div className="rounded-lg border border-[#ded6c8] bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索学号或姓名"
                className="h-10 w-full rounded-md border border-[#d8c9b8] bg-white px-3 text-sm dark:border-neutral-800 dark:bg-neutral-950 lg:w-64"
              />
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'pending', 'reviewed', 'issue'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`h-10 rounded-md border px-3 text-sm ${
                      filter === item
                        ? 'border-[#9a5b3d] bg-[#fff3e6] text-[#7c4a34]'
                        : 'border-[#d8c9b8] bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                    }`}
                  >
                    {item === 'all' ? '全部' : statusLabels[item]}
                  </button>
                ))}
                <StatusChip label={ownMember.signatureFileId ? '本人已签名' : '本人未签名'} tone={ownMember.signatureFileId ? 'success' : 'warning'} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <table className="min-w-max text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
                <tr>
                  <th className="sticky left-0 z-20 w-[112px] min-w-[112px] border-r border-neutral-200 bg-neutral-50 px-3 py-3 text-left dark:border-neutral-800 dark:bg-neutral-950">学号</th>
                  <th className="sticky left-[112px] z-20 w-[128px] min-w-[128px] border-r border-neutral-200 bg-neutral-50 px-3 py-3 text-left shadow-[6px_0_8px_-8px_rgba(0,0,0,0.35)] dark:border-neutral-800 dark:bg-neutral-950">姓名</th>
                  {EVALUATION_SCORE_CATEGORIES_ORDER.map((category) => (
                    <th key={category} className="w-[112px] min-w-[112px] px-3 py-3 text-center whitespace-nowrap">
                      {SCORE_RULES[category]?.label || category}
                    </th>
                  ))}
                  <th className="w-[220px] min-w-[220px] px-3 py-3 text-center whitespace-nowrap">本人状态</th>
                  <th className="w-[96px] min-w-[96px] px-3 py-3 text-center whitespace-nowrap">汇总</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {students.map((student: any, index: number) => {
                  const ownCheck = checks[student.id]?.[session.member.id];
                  const ownStatus = (ownCheck?.status || 'pending') as CheckStatus;
                  const aggregateStatus = (aggregate[student.id] || 'pending') as CheckStatus;
                  const fixedBg = index % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-[#fbf8f1] dark:bg-neutral-900';
                  return (
                    <tr key={student.id} className={`${index % 2 === 0 ? '' : 'bg-[#fbf8f1] dark:bg-neutral-900'} hover:bg-[#fffaf2] dark:hover:bg-neutral-800/60`}>
                      <td className={`sticky left-0 z-10 w-[112px] min-w-[112px] border-r border-neutral-100 px-3 py-2 font-mono text-xs whitespace-nowrap dark:border-neutral-800 ${fixedBg}`}>{student.studentNo}</td>
                      <td className={`sticky left-[112px] z-10 w-[128px] min-w-[128px] border-r border-neutral-100 px-3 py-2 font-medium whitespace-nowrap shadow-[6px_0_8px_-8px_rgba(0,0,0,0.35)] dark:border-neutral-800 ${fixedBg}`}>{student.name}</td>
                      {EVALUATION_SCORE_CATEGORIES_ORDER.map((category) => {
                        const items = scoreDetails(student, category);
                        return (
                          <td key={category} className="px-3 py-2 text-center whitespace-nowrap" title={student.scores[category]?.remark || ''}>
                            <div className="flex min-h-[44px] flex-col items-center justify-center gap-1">
                              <span className={category === 'total' ? 'font-semibold text-neutral-950 dark:text-white' : ''}>
                                {scoreText(student.scores[category]?.value)}
                              </span>
                              {supportsScoreDetails(category) && (
                                <button
                                  type="button"
                                  onClick={() => setActiveDetail({ student, category })}
                                  className={`rounded border px-2 py-0.5 text-[11px] ${
                                    items.length
                                      ? 'border-[#d8c9b8] bg-[#fffaf2] text-[#7c4a34] dark:border-neutral-700 dark:bg-neutral-950 dark:text-primary-300'
                                      : 'border-neutral-200 text-neutral-400 dark:border-neutral-800 dark:text-neutral-500'
                                  }`}
                                >
                                  {items.length ? `${items.length}条明细` : '无明细'}
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <div className="grid grid-cols-3 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
                          {(['pending', 'reviewed', 'issue'] as CheckStatus[]).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => updateCheck(student.id, status)}
                              className={`px-2 py-1.5 text-xs ${
                                ownStatus === status
                                  ? 'bg-[#fff3e6] font-medium text-[#7c4a34]'
                                  : 'bg-white text-neutral-500 hover:bg-[#fffaf2] dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
                              }`}
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <details className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <summary className="cursor-pointer text-base font-semibold">本人签名</summary>
              <div className="mt-4">
                <SignaturePad signerName={session.member.name} purpose="score_review_confirmation" onSaved={(imageData) => saveSignature(imageData, 'draw')} />
                <div className="mt-3">
                  <SignatureUpload onLoaded={(imageData) => saveSignature(imageData, 'upload')} />
                </div>
              </div>
            </details>

            <details className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <summary className="cursor-pointer text-base font-semibold">班级操作日志</summary>
              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {logs.slice(0, 8).map((log) => (
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
            </details>
          </div>
        </section>

        {activeDetail && (
          <Modal onClose={() => setActiveDetail(null)} widthClass="w-[640px] max-w-[92vw]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
                    {activeDetail.student.name} · {SCORE_RULES[activeDetail.category]?.label || activeDetail.category}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    学号 {activeDetail.student.studentNo}，合计 {detailsTotal(activeDetailItems).toFixed(2)} 分
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDetail(null)}
                  className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                >
                  关闭
                </button>
              </div>
              {activeDetailItems.length ? (
                <div className="overflow-hidden rounded-md border border-[#d8c9b8] bg-white dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="grid grid-cols-[1fr_120px] border-b border-[#d8c9b8] bg-[#f7f2ea] text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                    <div className="px-3 py-2">加分事项</div>
                    <div className="px-3 py-2 text-center">加分分数</div>
                  </div>
                  {activeDetailItems.map((item: any, index: number) => (
                    <div key={item.id || `${item.itemName}-${index}`} className="grid grid-cols-[1fr_120px] border-b border-[#eee4d8] text-sm last:border-b-0 dark:border-neutral-800">
                      <div className="px-3 py-2 text-neutral-800 dark:text-neutral-100">{item.itemName}</div>
                      <div className="px-3 py-2 text-center tabular-nums text-neutral-700 dark:text-neutral-200">{Number(item.itemScore || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-[#d8c9b8] bg-white px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950">
                  暂无加分明细
                </div>
              )}
          </Modal>
        )}
      </div>
    </main>
  );
}
