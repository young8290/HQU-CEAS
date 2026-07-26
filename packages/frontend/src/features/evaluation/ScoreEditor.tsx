import { memo, useCallback, useEffect, useState } from 'react';
import { useScores, type StudentScore } from './useScores';
import Modal from '../../components/ui/Modal';
import {
  EVALUATION_SCORE_CATEGORIES_ORDER,
  SCORE_RULES,
  isCategoryEditable,
  supportsScoreDetails,
  validateScore,
} from '../../lib/validation';
import { getUser } from '../../lib/auth';
import { api } from '../../lib/api';
import { AppLink } from '../../lib/router';

interface Props {
  classId: number;
  onBack?: () => void;
}

const NO_EDIT_CATEGORIES = new Set(['sports_base', 'sports_total', 'total']);

// 行内错误按学生分组存放（studentId → category → message），
// 让未变化行的 errors prop 保持引用稳定，配合 React.memo 跳过重渲染。
type RowErrors = Map<string, string>;

interface ScoreRowProps {
  student: StudentScore;
  role: string;
  allowAdminEditing: boolean;
  rowErrors?: RowErrors;
  zebra: boolean;
  onScoreChange: (studentId: number, category: string, rawValue: string) => void;
  onOpenRemark: (studentId: number, category: string, currentRemark: string | null) => void;
}

// 分数编辑网格重行 memo：只有该行 student/错误/斑马纹变化时才重渲染（§5.9）。
const ScoreRow = memo(function ScoreRow({
  student,
  role,
  allowAdminEditing,
  rowErrors,
  zebra,
  onScoreChange,
  onOpenRemark,
}: ScoreRowProps) {
  return (
    <tr className={`${zebra ? 'bg-neutral-50/50 dark:bg-neutral-900/30' : ''} border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-primary-50/30 dark:hover:bg-primary-500/5`}>
      <td className="sticky left-0 z-10 min-w-[112px] border-r border-neutral-100 bg-white px-3 py-2 font-mono text-xs text-neutral-600 whitespace-nowrap dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {student.studentNo}
      </td>
      <td className="sticky left-[112px] z-10 min-w-[128px] border-r border-neutral-100 bg-white px-3 py-2 font-medium text-neutral-950 whitespace-nowrap shadow-[6px_0_8px_-8px_rgba(0,0,0,0.25)] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
        {student.name}
      </td>
      {EVALUATION_SCORE_CATEGORIES_ORDER.map((cat) => {
        const score = student.scores[cat];
        const value = score?.value ?? 0;
        const remark = score?.remark;
        const rule = SCORE_RULES[cat];
        const error = rowErrors?.get(cat);
        const editable = isCategoryEditable(cat, role, allowAdminEditing) && !NO_EDIT_CATEGORIES.has(cat);
        const detailItems = student.details?.[cat] || [];
        const hasDetails = detailItems.length > 0 || Boolean(remark);

        if (!editable) {
          return (
            <td key={cat} className="px-3 py-2 text-center whitespace-nowrap text-neutral-400 dark:text-neutral-500">
              <span className={cat === 'total' ? 'text-base font-bold text-neutral-950 dark:text-white' : ''}>{value.toFixed(2)}</span>
            </td>
          );
        }

        return (
          <td key={cat} className="relative px-2 py-2 text-center">
            <div className="relative inline-block">
              <input
                type="number"
                step={rule.step}
                min="0"
                max={rule.max ?? undefined}
                value={value || ''}
                onChange={(e) => onScoreChange(student.id, cat, e.target.value)}
                className={`w-20 rounded-md border px-2 py-1 text-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30 ${
                  error ? 'border-red-300 bg-red-50 text-red-600' : 'border-neutral-200 bg-white text-neutral-950 hover:border-primary-300 focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white'
                }`}
                title={error ? error : `${rule.label}: 最大 ${rule.max ?? '-'}`}
              />
              {supportsScoreDetails(cat) && (
                <button
                  type="button"
                  className={`absolute -top-2 -right-2 h-5 w-5 rounded-full text-[10px] font-semibold text-white shadow-sm ${
                    hasDetails ? 'bg-primary-500' : 'bg-neutral-400 hover:bg-primary-500'
                  }`}
                  title={hasDetails ? `查看${cat === 'moral' ? '减分' : '加分'}明细，${detailItems.length || 1} 条` : `填写${cat === 'moral' ? '减分' : '加分'}明细`}
                  onClick={() => { onOpenRemark(student.id, cat, remark ?? null); }}
                >
                  明
                </button>
              )}
            </div>
            {error && <div className="mt-0.5 text-xs text-red-500">{error}</div>}
          </td>
        );
      })}
    </tr>
  );
});

export default function ScoreEditor({ classId, onBack }: Props) {
  const { students, loading, saveStatus, saveError, lastSaved, updateScore, loadScores, loadScoreDetails, saveScoreDetails } = useScores(classId);
  const [editingRemark, setEditingRemark] = useState<{ studentId: number; category: string } | null>(null);
  const [remarkRows, setRemarkRows] = useState<Array<{ itemName: string; itemScore: string }>>([{ itemName: '', itemScore: '' }]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [errors, setErrors] = useState<Map<number, RowErrors>>(new Map());
  const [sortBy, setSortBy] = useState<string>('studentNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  // 系统设置「允许管理员修改分数」开关，默认 true；仅对 admin 生效，monitor 不受影响。
  const [allowAdminEditing, setAllowAdminEditing] = useState(true);

  const user = getUser();
  const role = user?.role || 'monitor';
  const visibleCategories = EVALUATION_SCORE_CATEGORIES_ORDER;

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let cancelled = false;
    api.get('/platform/system/entry-status')
      .then((data) => {
        if (!cancelled) setAllowAdminEditing(data.entryStatus?.allowAdminScoreEditing === true);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedStudents = [...students]
    .filter((student) => !searchQuery || student.name.includes(searchQuery) || student.studentNo.includes(searchQuery))
    .sort((a, b) => {
      let compare = 0;
      if (sortBy === 'studentNo') compare = a.studentNo.localeCompare(b.studentNo);
      else if (sortBy === 'name') compare = a.name.localeCompare(b.name);
      else compare = (a.scores[sortBy]?.value || 0) - (b.scores[sortBy]?.value || 0);
      return sortDir === 'asc' ? compare : -compare;
    });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(column);
    setSortDir('asc');
  };

  const handleScoreChange = useCallback((studentId: number, category: string, rawValue: string) => {
    const value = rawValue === '' ? 0 : parseFloat(rawValue);
    if (Number.isNaN(value)) return;
    const error = validateScore(category, value);
    setErrors((prev) => {
      const rowErrors = prev.get(studentId);
      if (error) {
        const nextRow = new Map(rowErrors ?? []);
        nextRow.set(category, error);
        return new Map(prev).set(studentId, nextRow);
      }
      if (!rowErrors?.has(category)) return prev;
      const nextRow = new Map(rowErrors);
      nextRow.delete(category);
      const next = new Map(prev);
      if (nextRow.size === 0) {
        next.delete(studentId);
      } else {
        next.set(studentId, nextRow);
      }
      return next;
    });
    if (error) return;
    updateScore(studentId, category, value);
  }, [updateScore]);

  const handleRemarkSave = async (studentId: number, category: string) => {
    // 德育测评（moral）明细为扣分项：最终得分 = 100 − 扣分合计；其余类别仍为加分求和。
    const isMoral = category === 'moral';
    const detailNoun = isMoral ? '减分' : '加分';
    const items = remarkRows
      .map((row) => ({ itemName: row.itemName.trim(), itemScore: row.itemScore.trim() }))
      .filter((row) => row.itemName || row.itemScore);
    for (const item of items) {
      if (!item.itemName) {
        setDetailError(`${detailNoun}事项不能为空`);
        return;
      }
      if (!item.itemScore) {
        setDetailError(`${detailNoun}分数不能为空`);
        return;
      }
      const value = Number.parseFloat(item.itemScore);
      if (Number.isNaN(value)) {
        setDetailError(`${detailNoun}分数必须为有效数字`);
        return;
      }
      const error = validateScore(category, value);
      if (error) {
        setDetailError(error);
        return;
      }
    }
    const total = items.reduce((sum, item) => sum + Number.parseFloat(item.itemScore), 0);
    if (isMoral) {
      if (total > 100) {
        setDetailError('德育测评扣分合计不能超过100');
        return;
      }
    } else {
      const totalError = validateScore(category, total);
      if (totalError) {
        setDetailError(totalError);
        return;
      }
    }
    setDetailError('');
    setDetailLoading(true);
    try {
      await saveScoreDetails(
        studentId,
        category,
        items.map((row, index) => ({
          itemName: row.itemName,
          itemScore: Number.parseFloat(row.itemScore || '0'),
          sortOrder: index,
        })),
      );
      setEditingRemark(null);
      setRemarkRows([{ itemName: '', itemScore: '' }]);
    } catch (error: any) {
      setDetailError(error.message || '保存失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const openRemark = useCallback(async (studentId: number, category: string, currentRemark: string | null) => {
    setEditingRemark({ studentId, category });
    setDetailError('');
    setDetailLoading(true);
    try {
      const details = await loadScoreDetails(studentId, category);
      const rows = details.map((item) => ({
        itemName: item.itemName,
        itemScore: String(item.itemScore),
      }));
      if (rows.length === 0 && currentRemark) {
        const fallbackRows = currentRemark.split('\n').map((line) => {
          const [itemName, itemScore] = line.split('：');
          return { itemName: itemName || '', itemScore: itemScore || '' };
        });
        setRemarkRows(fallbackRows.length > 0 ? [...fallbackRows, { itemName: '', itemScore: '' }].slice(0, 15) : [{ itemName: '', itemScore: '' }]);
      } else {
        setRemarkRows(rows.length > 0 ? [...rows, { itemName: '', itemScore: '' }].slice(0, 15) : [{ itemName: '', itemScore: '' }]);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [loadScoreDetails]);

  const getSortIndicator = (column: string) => (sortBy === column ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');
  const detailTotal = remarkRows.reduce((sum, row) => {
    const value = Number.parseFloat(row.itemScore);
    return Number.isNaN(value) ? sum : sum + value;
  }, 0);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-neutral-400">分数加载中</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onBack?.()}
            className="text-sm text-neutral-500 transition-colors hover:text-primary-600"
          >
            ← 返回选择
          </button>
          <h1 className="text-xl font-bold text-neutral-950 dark:text-white">分数编辑</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-neutral-400">状态</span>
            <span className="ml-2 text-neutral-700 dark:text-neutral-200">
              {saveStatus === 'saved' ? `已保存 ${lastSaved}` : saveStatus === 'saving' ? '保存中' : saveStatus === 'error' ? '保存失败' : '就绪'}
            </span>
            {saveStatus === 'error' && saveError && (
              <span className="ml-2 text-red-600 dark:text-red-300">{saveError}</span>
            )}
          </div>
          <input
            type="text"
            placeholder="搜索学生"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-sm text-neutral-950 focus:border-[#9a5b3d] focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
          <button
            type="button"
            onClick={() => loadScores()}
            className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          >
            刷新
          </button>
        </div>
      </div>

      {user?.role === 'admin' && !allowAdminEditing && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          管理员修改分数功能已关闭（防误改），当前为只读模式；如需修改请在「系统设置」中开启「允许管理员修改分数」。
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="min-w-max text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <th
                className="sticky left-0 z-20 min-w-[112px] border-r border-neutral-200 bg-neutral-50 px-3 py-3 text-left font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300"
                onClick={() => handleSort('studentNo')}
              >
                学号{getSortIndicator('studentNo')}
              </th>
              <th
                className="sticky left-[112px] z-20 min-w-[128px] border-r border-neutral-200 bg-neutral-50 px-3 py-3 text-left font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300"
                onClick={() => handleSort('name')}
              >
                姓名{getSortIndicator('name')}
              </th>
              {visibleCategories.map((cat) => (
                <th key={cat} className={`px-3 py-3 text-center font-medium whitespace-nowrap ${isCategoryEditable(cat, role, allowAdminEditing) ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500'}`} onClick={() => handleSort(cat)}>
                  <div className="flex flex-col items-center">
                    <span className="text-xs">{SCORE_RULES[cat].label}{getSortIndicator(cat)}</span>
                    {SCORE_RULES[cat].max !== null && <span className="text-xs text-neutral-400">满 {SCORE_RULES[cat].max}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((student, idx) => (
              <ScoreRow
                key={student.id}
                student={student}
                role={role}
                allowAdminEditing={allowAdminEditing}
                rowErrors={errors.get(student.id)}
                zebra={idx % 2 !== 0}
                onScoreChange={handleScoreChange}
                onOpenRemark={openRemark}
              />
            ))}
          </tbody>
        </table>

        {students.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">本班还没有学生数据</p>
            {user?.role === 'admin' ? (
              <>
                <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                  下一步：先到「学生管理」导入本班学生名单，再到「数据导入」导入学业与体育成绩，之后回到本页填写分数。
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <AppLink to="/evaluation/students" className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34]">
                    前往学生管理
                  </AppLink>
                  <AppLink to="/evaluation/import" className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-[#7c4a34] transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-primary-300">
                    前往数据导入
                  </AppLink>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                下一步：请联系管理员在「学生管理」导入本班学生名单，导入完成后刷新本页即可开始填写分数。
              </p>
            )}
          </div>
        )}
      </div>

      <div className="text-sm text-neutral-400">
        共 {students.length} 名学生{searchQuery && ` (搜索结果: ${sortedStudents.length} 名)`}
      </div>

      {editingRemark && (
        <Modal
          onClose={() => setEditingRemark(null)}
          widthClass="w-[720px] max-w-[92vw]"
          title={`${editingRemark.category === 'moral' ? '减分明细' : '加分明细'} - ${SCORE_RULES[editingRemark.category as keyof typeof SCORE_RULES]?.label || editingRemark.category}`}
        >
            <div className="overflow-hidden rounded-md border border-[#d8c9b8] bg-white dark:border-neutral-700 dark:bg-neutral-950">
              <div className="grid grid-cols-[1fr_150px_72px] border-b border-[#d8c9b8] bg-[#f7f2ea] text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                <div className="px-3 py-2">{editingRemark.category === 'moral' ? '减分事项' : '加分事项'}</div>
                <div className="px-3 py-2 text-center">{editingRemark.category === 'moral' ? '减分分数' : '加分分数'}</div>
                <div className="px-3 py-2 text-center">操作</div>
              </div>
              <div className="max-h-[58vh] overflow-y-auto">
                {remarkRows.map((row, index) => (
                  <div key={`${index}-${row.itemName}`} className="grid grid-cols-[1fr_150px_72px] border-b border-[#eee4d8] last:border-b-0">
                    <input
                      value={row.itemName}
                      onChange={(event) => {
                        const next = [...remarkRows];
                        next[index] = { ...next[index], itemName: event.target.value };
                        setRemarkRows(next);
                      }}
                      placeholder={editingRemark.category === 'moral' ? '减分事项' : '加分事项'}
                      className="border-0 border-r border-[#eee4d8] bg-white px-3 py-2 text-sm text-neutral-950 outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                    <input
                      value={row.itemScore}
                      onChange={(event) => {
                        const next = [...remarkRows];
                        next[index] = { ...next[index], itemScore: event.target.value };
                        setRemarkRows(next);
                      }}
                      placeholder={editingRemark.category === 'moral' ? '减分分数' : '加分分数'}
                      className="border-0 bg-white px-3 py-2 text-sm text-neutral-950 outline-none dark:bg-neutral-950 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setRemarkRows((prev) => prev.length > 1 ? prev.filter((_, itemIndex) => itemIndex !== index) : [{ itemName: '', itemScore: '' }])}
                      className="bg-white px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:bg-neutral-950 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#eee4d8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
              <span className="text-neutral-500 dark:text-neutral-400">
                {editingRemark.category === 'moral' ? (
                  <>
                    扣分合计：<strong className="text-neutral-900 dark:text-white">{detailTotal.toFixed(2)}</strong>
                    ，最终得分：<strong className="text-neutral-900 dark:text-white">{(100 - detailTotal).toFixed(2)}</strong>
                    <span>（= 100 − 扣分合计，满分 100）</span>
                  </>
                ) : (
                  <>
                    合计：<strong className="text-neutral-900 dark:text-white">{detailTotal.toFixed(2)}</strong>
                    {SCORE_RULES[editingRemark.category as keyof typeof SCORE_RULES]?.max !== null && (
                      <span>，满分 {SCORE_RULES[editingRemark.category as keyof typeof SCORE_RULES]?.max}</span>
                    )}
                  </>
                )}
              </span>
              {detailError && <span className="text-red-600 dark:text-red-300">{detailError}</span>}
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setRemarkRows((prev) => [...prev, { itemName: '', itemScore: '' }].slice(0, 15))}
                className="rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              >
                新增
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRemark(null)}
                  className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => { void handleRemarkSave(editingRemark.studentId, editingRemark.category); }}
                  disabled={detailLoading}
                  className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white hover:bg-[#7c4a34]"
                >
                  {detailLoading ? '保存中' : '保存'}
                </button>
              </div>
            </div>
            {detailLoading && <p className="mt-3 text-xs text-neutral-500">明细处理中</p>}
        </Modal>
      )}
    </div>
  );
}
