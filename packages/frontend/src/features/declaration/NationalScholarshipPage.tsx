import { useEffect, useState } from 'react';
import DataPanel from '../../components/ui/DataPanel';
import ScreenState from '../../components/ui/ScreenState';
import StatusChip from '../../components/ui/StatusChip';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

interface ReviewDraft {
  achievements: string;
  reviewNote: string;
  finalRank: string;
  selected: boolean;
}

const inputClass = 'w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white';
const smallButtonClass = 'rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300';
const primaryButtonClass = 'rounded-md bg-[#9a5b3d] px-4 py-2 text-sm font-medium text-white hover:bg-[#7c4a34] disabled:cursor-not-allowed disabled:opacity-60';

export default function NationalScholarshipPage() {
  const user = getUser();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [years, setYears] = useState<any[]>([]);
  const [yearId, setYearId] = useState<number | null>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [computing, setComputing] = useState(false);

  // 新建表单
  const [name, setName] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [suggestGroups, setSuggestGroups] = useState<any[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [quota, setQuota] = useState('1');
  const [poolRatio, setPoolRatio] = useState('0.1');
  const [paramW, setParamW] = useState('0.5');
  const [paramD, setParamD] = useState('1.0');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);

  // 临界层评议草稿（candidateId → 草稿）
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, ReviewDraft>>({});
  const [savingReviewId, setSavingReviewId] = useState<number | null>(null);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    setLoading(true);
    try {
      const [yearData, gradeData] = await Promise.all([
        api.get('/platform/academic-years'),
        api.get('/platform/grades'),
      ]);
      setYears(yearData || []);
      setGrades(gradeData || []);
      const current = (yearData || []).find((year: any) => year.isCurrent) || (yearData || [])[0];
      if (!current) {
        setMessage('未找到学年数据，请先在系统设置中创建学年');
        return;
      }
      setYearId(current.id);
      await loadEvaluations(current.id);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvaluations(targetYearId: number) {
    try {
      const data = await api.get(`/declaration/national-scholarships?academicYearId=${targetYearId}`);
      setEvaluations(data || []);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function changeYear(nextYearId: number) {
    setYearId(nextYearId);
    setDetail(null);
    await loadEvaluations(nextYearId);
  }

  async function openDetail(id: number) {
    setDetailLoading(true);
    try {
      const data = await api.get(`/declaration/national-scholarships/${id}`);
      setDetail(data);
      const drafts: Record<number, ReviewDraft> = {};
      (data.candidates || []).forEach((candidate: any) => {
        drafts[candidate.id] = {
          achievements: candidate.achievements || '',
          reviewNote: candidate.reviewNote || '',
          finalRank: candidate.finalRank == null ? '' : String(candidate.finalRank),
          selected: !!candidate.selected,
        };
      });
      setReviewDrafts(drafts);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadSuggestions() {
    if (!gradeId) {
      setMessage('请先选择年级，再获取建议平行班');
      return;
    }
    setSuggesting(true);
    try {
      const data = await api.get(`/declaration/national-scholarships/suggest-classes?academicYearId=${yearId}&gradeId=${gradeId}`);
      setSuggestGroups(data || []);
      if (!(data || []).length) setMessage('该年级下暂无班级');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setSuggesting(false);
    }
  }

  function toggleClass(classId: number) {
    setSelectedClassIds((prev) => (
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    ));
  }

  function selectMajor(group: any) {
    const ids: number[] = group.classes.map((cls: any) => cls.id);
    setSelectedClassIds((prev) => Array.from(new Set([...prev, ...ids])));
    if (!name.trim()) {
      setName(`${group.gradeName || ''}${group.major}（合组）`);
    }
  }

  async function createEvaluation() {
    if (!yearId) return;
    if (!name.trim()) {
      setMessage('请填写评比单元名称');
      return;
    }
    if (!selectedClassIds.length) {
      setMessage('请至少勾选一个班级');
      return;
    }
    setCreating(true);
    try {
      const created = await api.post('/declaration/national-scholarships', {
        name: name.trim(),
        academicYearId: yearId,
        classIds: selectedClassIds,
        quota: Number(quota),
        poolRatio: Number(poolRatio),
        paramW: Number(paramW),
        paramD: Number(paramD),
        note: note.trim() || undefined,
      });
      setMessage(`评比单元"${created.name}"已创建，可点击"计算/重算"生成候选池`);
      setName('');
      setNote('');
      setSelectedClassIds([]);
      await loadEvaluations(yearId);
      await openDetail(created.id);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function compute() {
    if (!detail) return;
    setComputing(true);
    try {
      const result = await api.post(`/declaration/national-scholarships/${detail.id}/compute`);
      setMessage(`计算完成：B_解析=${formatB(result.analyticB)}，B_经验=${formatB(result.empiricalB)}，B_最终=${formatB(result.effectiveB)}；入池 ${result.poolCount} 人，临界层 ${result.criticalCount} 人`);
      await Promise.all([openDetail(detail.id), yearId ? loadEvaluations(yearId) : Promise.resolve()]);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setComputing(false);
    }
  }

  async function toggleFlag(candidate: any, field: 'isClassRecommended' | 'hasMajorAchievement') {
    if (!detail) return;
    try {
      await api.put(`/declaration/national-scholarships/${detail.id}/candidates/${candidate.id}/flags`, {
        [field]: !candidate[field],
      });
      setMessage(`已更新 ${candidate.name} 的${field === 'isClassRecommended' ? '班级推荐' : '重大成果'}标记，需点击"计算/重算"后重新入池与分层`);
      await openDetail(detail.id);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function saveReview(candidate: any) {
    if (!detail) return;
    const draft = reviewDrafts[candidate.id];
    if (!draft) return;
    setSavingReviewId(candidate.id);
    try {
      if ((draft.achievements || '') !== (candidate.achievements || '')) {
        await api.put(`/declaration/national-scholarships/${detail.id}/candidates/${candidate.id}/flags`, {
          achievements: draft.achievements,
        });
      }
      await api.put(`/declaration/national-scholarships/${detail.id}/candidates/${candidate.id}/review`, {
        reviewNote: draft.reviewNote,
        finalRank: draft.finalRank === '' ? null : Number(draft.finalRank),
        selected: draft.selected,
      });
      setMessage(`${candidate.name} 的评议已保存留痕`);
      await openDetail(detail.id);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setSavingReviewId(null);
    }
  }

  async function exportTable() {
    if (!detail) return;
    try {
      await api.download(`/declaration/national-scholarships/${detail.id}/export`, `${detail.name}候选人比较表.xlsx`);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  function updateDraft(candidateId: number, patch: Partial<ReviewDraft>) {
    setReviewDrafts((prev) => ({
      ...prev,
      [candidateId]: { ...(prev[candidateId] || { achievements: '', reviewNote: '', finalRank: '', selected: false }), ...patch },
    }));
  }

  if (loading) {
    return <ScreenState label="国家奖学金评定数据加载中" />;
  }

  const candidates: any[] = detail?.candidates || [];
  const poolCandidates = candidates.filter((candidate) => candidate.inPool);
  const criticalCandidates = poolCandidates.filter((candidate) => candidate.isCritical);

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        {/* ① 评比单元列表 + 新建 */}
        <DataPanel
          title="评比单元"
          description={`同年级平行班合组为一个评比单元。操作人：${user?.displayName || user?.username || '-'}`}
          actions={(
            <select
              value={yearId ?? ''}
              onChange={(event) => changeYear(Number(event.target.value))}
              className="rounded-md border border-[#d8c9b8] bg-white px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? '（当前）' : ''}</option>
              ))}
            </select>
          )}
        >
          <div className="space-y-4">
            {evaluations.length ? (
              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {evaluations.map((evaluation) => (
                  <button
                    key={evaluation.id}
                    type="button"
                    onClick={() => openDetail(evaluation.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${detail?.id === evaluation.id
                      ? 'border-[#9a5b3d] bg-[#f6ede2] dark:border-primary-400 dark:bg-neutral-800'
                      : 'border-[#ded6c8] bg-white hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-neutral-900 dark:text-white">{evaluation.name}</span>
                      <StatusChip label={statusLabel(evaluation.status)} tone={statusTone(evaluation.status)} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      名额 {evaluation.quota}｜班级 {evaluation.classIds?.length || 0} 个｜候选记录 {evaluation.candidateCount || 0} 条
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[#d8c9b8] px-3 py-4 text-center text-xs leading-5 text-neutral-500 dark:border-neutral-800">
                <p className="font-medium text-neutral-600 dark:text-neutral-300">还没有评比单元</p>
                <p className="mt-1">下一步：在下方「新建评比单元」选择年级 → 点「建议平行班」勾选合组班级 → 创建后点「计算/重算」生成候选池与分层。</p>
              </div>
            )}

            <div className="space-y-3 border-t border-[#e4d8ca] pt-4 dark:border-neutral-800">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">新建评比单元</p>
              <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="评比单元名称，如：2023级计算机科学与技术（合组）" />
              <div className="flex gap-2">
                <select value={gradeId} onChange={(event) => { setGradeId(event.target.value); setSuggestGroups([]); setSelectedClassIds([]); }} className={inputClass}>
                  <option value="">选择年级</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>{grade.name}</option>
                  ))}
                </select>
                <button type="button" onClick={loadSuggestions} disabled={suggesting} className={`${smallButtonClass} shrink-0`}>
                  {suggesting ? '加载中…' : '建议平行班'}
                </button>
              </div>

              {suggestGroups.length > 0 && (
                <div className="max-h-56 space-y-3 overflow-auto rounded-lg border border-[#ded6c8] p-3 dark:border-neutral-800">
                  {suggestGroups.map((group) => (
                    <div key={group.major}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-[#7c4a34] dark:text-primary-300">{group.major}</p>
                        <button type="button" onClick={() => selectMajor(group)} className="text-xs text-[#7c4a34] hover:text-[#5f3827] dark:text-primary-400">全选该专业</button>
                      </div>
                      <div className="mt-1 space-y-1">
                        {group.classes.map((cls: any) => (
                          <label key={cls.id} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                            <input type="checkbox" checked={selectedClassIds.includes(cls.id)} onChange={() => toggleClass(cls.id)} />
                            <span>{cls.name}</span>
                            <span className="text-xs text-neutral-400">{cls.studentCount} 人</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-neutral-500">
                  名额 Q
                  <input type="number" min="0" step="1" value={quota} onChange={(event) => setQuota(event.target.value)} className={`${inputClass} mt-1`} />
                </label>
                <label className="text-xs text-neutral-500">
                  入池比例 p
                  <input type="number" min="0.01" max="1" step="0.01" value={poolRatio} onChange={(event) => setPoolRatio(event.target.value)} className={`${inputClass} mt-1`} />
                </label>
                <label className="text-xs text-neutral-500">
                  参数 w（按班授课学分占比）
                  <input type="number" min="0" step="0.05" value={paramW} onChange={(event) => setParamW(event.target.value)} className={`${inputClass} mt-1`} />
                </label>
                <label className="text-xs text-neutral-500">
                  参数 d（给分松紧最大差异）
                  <input type="number" min="0" step="0.1" value={paramD} onChange={(event) => setParamD(event.target.value)} className={`${inputClass} mt-1`} />
                </label>
              </div>
              <input value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} placeholder="备注（可选）" />
              <button type="button" onClick={createEvaluation} disabled={creating} className={`${primaryButtonClass} w-full`}>
                {creating ? '创建中…' : '创建评比单元'}
              </button>
            </div>
          </div>
        </DataPanel>

        {/* ② 详情：B 参数与计算 */}
        <DataPanel
          title="评比单元详情"
          description="B_解析 = w·d；B_经验 = 各平行班绩点分位差的中位数；B_最终 = 两者取小，用于稳健占优比较。"
          actions={detail ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={compute} disabled={computing} className={primaryButtonClass}>
                {computing ? '计算中…' : '计算/重算'}
              </button>
              <button type="button" onClick={exportTable} className={smallButtonClass}>导出候选人比较表</button>
            </div>
          ) : undefined}
        >
          {detailLoading ? <ScreenState label="评比单元详情加载中" /> : detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{detail.name}</p>
                <StatusChip label={statusLabel(detail.status)} tone={statusTone(detail.status)} />
                <span className="text-xs text-neutral-500">{detail.academicYearName}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(detail.unitClasses || []).map((cls: any) => (
                  <StatusChip key={cls.id} label={cls.name} tone="neutral" />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <MetricCard label="B_解析（w·d）" value={formatB(detail.analyticB)} />
                <MetricCard label="B_经验（分位差中位数）" value={formatB(detail.empiricalB)} />
                <MetricCard label="B_最终（取小）" value={formatB(detail.effectiveB)} highlight />
                <MetricCard label="名额 Q" value={String(detail.quota)} />
                <MetricCard label="入池比例 p" value={String(detail.poolRatio)} />
                <MetricCard label="w / d" value={`${detail.paramW} / ${detail.paramD}`} />
              </div>
              {detail.summary && (
                <p className="text-xs text-neutral-500">
                  单元学生 {detail.summary.studentCount} 人｜候选池 {detail.summary.poolCount} 人｜临界层 {detail.summary.criticalCount} 人｜
                  已入选 {detail.summary.selectedCount} 人（稳健层 {detail.summary.robustSelectedCount} 人）｜临界层剩余名额 {detail.summary.remainingCriticalQuota}
                </p>
              )}
              {detail.note && <p className="text-xs text-neutral-500">备注：{detail.note}</p>}
              {!candidates.length && (
                <p className="rounded-md border border-dashed border-[#d8c9b8] px-3 py-4 text-center text-xs text-neutral-500 dark:border-neutral-800">
                  尚未生成候选数据，点击"计算/重算"运行算法一（候选池）、算法二（上界 B）与算法三（稳健占优分层）
                </p>
              )}
            </div>
          ) : (
            <ScreenState label="从左侧选择或新建评比单元" />
          )}
        </DataPanel>
      </div>

      {detail && candidates.length > 0 && (
        <>
          {/* ③ 候选池表（算法一） */}
          <DataPanel title="候选池（算法一）" description="入池条件：班级推荐 L ∨ 专业绩点前 p（J）∨ 专业综测前 p（K）∨ 重大成果 M，四者取并集。">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
                  <tr>
                    <th className="px-3 py-2">班级</th>
                    <th className="px-3 py-2">学号</th>
                    <th className="px-3 py-2">姓名</th>
                    <th className="px-3 py-2">总绩点 g</th>
                    <th className="px-3 py-2">综测 z</th>
                    <th className="px-3 py-2">绩点名次</th>
                    <th className="px-3 py-2">综测名次</th>
                    <th className="px-3 py-2">入池来源</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {candidates.map((candidate) => (
                    <tr key={candidate.id} className={candidate.inPool ? '' : 'opacity-55'}>
                      <td className="px-3 py-2">{candidate.className}</td>
                      <td className="px-3 py-2">{candidate.studentNo}</td>
                      <td className="px-3 py-2">{candidate.name}</td>
                      <td className="px-3 py-2">{Number(candidate.gpa).toFixed(2)}</td>
                      <td className="px-3 py-2">{Number(candidate.totalScore).toFixed(1)}</td>
                      <td className="px-3 py-2">{candidate.gRank}</td>
                      <td className="px-3 py-2">{candidate.zRank}</td>
                      <td className="px-3 py-2">
                        {candidate.poolReasons?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {candidate.poolReasons.map((reason: string) => (
                              <StatusChip key={reason} label={reason} tone={reasonTone(reason)} />
                            ))}
                          </div>
                        ) : (
                          <StatusChip label="未入池" tone="neutral" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataPanel>

          {/* ④ 分层比较表（表 A-1，算法三） */}
          <DataPanel
            title="分层比较表（表 A-1，算法三）"
            description={`稳健占优：绩点差超过 B=${formatB(detail.effectiveB)} 且综测不低者居前；互不占优者进入临界层。勾选"班级推荐/重大成果"后需点击"计算/重算"重新生效。`}
          >
            {poolCandidates.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
                    <tr>
                      <th className="px-3 py-2">稳健层名次</th>
                      <th className="px-3 py-2">班级</th>
                      <th className="px-3 py-2">学号</th>
                      <th className="px-3 py-2">姓名</th>
                      <th className="px-3 py-2">总绩点 g</th>
                      <th className="px-3 py-2">综测 z</th>
                      <th className="px-3 py-2">被几人占优</th>
                      <th className="px-3 py-2">临界层</th>
                      <th className="px-3 py-2">班级推荐 L</th>
                      <th className="px-3 py-2">重大成果 M</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {poolCandidates.map((candidate) => (
                      <tr key={candidate.id} className={candidate.isCritical ? 'bg-amber-50/60 dark:bg-amber-950/30' : ''}>
                        <td className="px-3 py-2 font-medium">{candidate.robustRank ?? '-'}</td>
                        <td className="px-3 py-2">{candidate.className}</td>
                        <td className="px-3 py-2">{candidate.studentNo}</td>
                        <td className="px-3 py-2">{candidate.name}</td>
                        <td className="px-3 py-2">{Number(candidate.gpa).toFixed(2)}</td>
                        <td className="px-3 py-2">{Number(candidate.totalScore).toFixed(1)}</td>
                        <td className="px-3 py-2">{candidate.dominatedByCount}</td>
                        <td className="px-3 py-2">
                          {candidate.isCritical ? <StatusChip label="临界层" tone="warning" /> : <span className="text-xs text-neutral-400">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={!!candidate.isClassRecommended} onChange={() => toggleFlag(candidate, 'isClassRecommended')} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={!!candidate.hasMajorAchievement} onChange={() => toggleFlag(candidate, 'hasMajorAchievement')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ScreenState label="候选池为空，请检查综测数据后重算" />
            )}
          </DataPanel>

          {/* ⑤ 临界层结构化评议（算法四） */}
          <DataPanel
            title="临界层结构化评议（算法四）"
            description={`临界层剩余名额 = max(0, Q − 稳健层已入选) = ${detail.summary?.remainingCriticalQuota ?? '-'}。`}
          >
            <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
              不设兑换率：临界层候选人之间不做绩点与综测的分数换算，须凭书面理由记录取舍依据，全程留痕备查。
            </div>
            {criticalCandidates.length ? (
              <div className="space-y-4">
                {criticalCandidates.map((candidate) => {
                  const draft = reviewDrafts[candidate.id] || { achievements: '', reviewNote: '', finalRank: '', selected: false };
                  return (
                    <div key={candidate.id} className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-white">{candidate.name}</span>
                        <span className="text-xs text-neutral-500">{candidate.className}｜{candidate.studentNo}</span>
                        <StatusChip label={`g ${Number(candidate.gpa).toFixed(2)}`} tone="info" />
                        <StatusChip label={`z ${Number(candidate.totalScore).toFixed(1)}`} tone="info" />
                        {candidate.selected && <StatusChip label="已入选" tone="success" />}
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <label className="text-xs text-neutral-500">
                          主要成果清单
                          <textarea
                            value={draft.achievements}
                            onChange={(event) => updateDraft(candidate.id, { achievements: event.target.value })}
                            rows={3}
                            className={`${inputClass} mt-1`}
                            placeholder="科研、竞赛、社会服务等主要成果"
                          />
                        </label>
                        <label className="text-xs text-neutral-500">
                          书面理由 / 临界比较记录
                          <textarea
                            value={draft.reviewNote}
                            onChange={(event) => updateDraft(candidate.id, { reviewNote: event.target.value })}
                            rows={3}
                            className={`${inputClass} mt-1`}
                            placeholder="评审组对该候选人取舍的书面理由"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap items-end gap-4">
                        <label className="text-xs text-neutral-500">
                          最终次序
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={draft.finalRank}
                            onChange={(event) => updateDraft(candidate.id, { finalRank: event.target.value })}
                            className={`${inputClass} mt-1 w-28`}
                          />
                        </label>
                        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            onChange={(event) => updateDraft(candidate.id, { selected: event.target.checked })}
                          />
                          入选推荐名单
                        </label>
                        <button
                          type="button"
                          onClick={() => saveReview(candidate)}
                          disabled={savingReviewId === candidate.id}
                          className={primaryButtonClass}
                        >
                          {savingReviewId === candidate.id ? '保存中…' : '保存评议'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-[#d8c9b8] px-3 py-4 text-center text-xs text-neutral-500 dark:border-neutral-800">
                当前没有临界层候选人：稳健占优关系已能完全区分候选人次序
              </p>
            )}
          </DataPanel>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight
      ? 'border-[#9a5b3d] bg-[#f6ede2] dark:border-primary-400 dark:bg-neutral-800'
      : 'border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}
    >
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-neutral-900 dark:text-white">{value}</p>
    </div>
  );
}

function formatB(value: number | null | undefined): string {
  if (value == null) return '—';
  return String(Math.round(Number(value) * 10000) / 10000);
}

function reasonTone(reason: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (reason === '班级推荐') return 'info';
  if (reason === '重大成果') return 'warning';
  return 'success';
}

function statusLabel(status: string) {
  return { draft: '草稿', computed: '已计算', finalized: '已定案' }[status] || status;
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'computed') return 'info';
  if (status === 'finalized') return 'success';
  return 'neutral';
}
