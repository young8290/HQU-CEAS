import { useState } from 'react';
import { useScores } from '../../hooks/useScores';
import {
  EVALUATION_SCORE_CATEGORIES_ORDER,
  SCORE_RULES,
  isCategoryEditable,
  supportsScoreDetails,
  validateScore,
} from '../../lib/validation';
import { getUser } from '../../lib/auth';

interface Props {
  classId: number;
  onBack?: () => void;
}

const NO_EDIT_CATEGORIES = new Set(['sports_base', 'sports_total', 'total']);

export default function ScoreEditor({ classId, onBack }: Props) {
  const { students, loading, saveStatus, saveError, lastSaved, updateScore, loadScores, loadScoreDetails, saveScoreDetails } = useScores(classId);
  const [editingRemark, setEditingRemark] = useState<{ studentId: number; category: string } | null>(null);
  const [remarkRows, setRemarkRows] = useState<Array<{ itemName: string; itemScore: string }>>([{ itemName: '', itemScore: '' }]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [sortBy, setSortBy] = useState<string>('studentNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const user = getUser();
  const visibleCategories = EVALUATION_SCORE_CATEGORIES_ORDER;

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

  const handleScoreChange = (studentId: number, category: string, rawValue: string) => {
    const value = rawValue === '' ? 0 : parseFloat(rawValue);
    if (Number.isNaN(value)) return;
    const error = validateScore(category, value);
    const key = `${studentId}:${category}`;
    if (error) {
      setErrors((prev) => new Map(prev).set(key, error));
      return;
    }
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    updateScore(studentId, category, value);
  };

  const handleRemarkSave = async (studentId: number, category: string) => {
    const items = remarkRows
      .map((row) => ({ itemName: row.itemName.trim(), itemScore: row.itemScore.trim() }))
      .filter((row) => row.itemName || row.itemScore);
    for (const item of items) {
      if (!item.itemName) {
        setDetailError('加分事项不能为空');
        return;
      }
      if (!item.itemScore) {
        setDetailError('加分分数不能为空');
        return;
      }
      const value = Number.parseFloat(item.itemScore);
      if (Number.isNaN(value)) {
        setDetailError('加分分数必须为有效数字');
        return;
      }
      const error = validateScore(category, value);
      if (error) {
        setDetailError(error);
        return;
      }
    }
    const total = items.reduce((sum, item) => sum + Number.parseFloat(item.itemScore), 0);
    const totalError = validateScore(category, total);
    if (totalError) {
      setDetailError(totalError);
      return;
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

  const openRemark = async (studentId: number, category: string, currentRemark: string | null) => {
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
  };

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
                <th key={cat} className={`px-3 py-3 text-center font-medium whitespace-nowrap ${isCategoryEditable(cat, user?.role || 'monitor') ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500'}`} onClick={() => handleSort(cat)}>
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
              <tr key={student.id} className={`${idx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-900/30'} border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-primary-50/30 dark:hover:bg-primary-500/5`}>
                <td className="sticky left-0 z-10 min-w-[112px] border-r border-neutral-100 bg-white px-3 py-2 font-mono text-xs text-neutral-600 whitespace-nowrap dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                  {student.studentNo}
                </td>
                <td className="sticky left-[112px] z-10 min-w-[128px] border-r border-neutral-100 bg-white px-3 py-2 font-medium text-neutral-950 whitespace-nowrap shadow-[6px_0_8px_-8px_rgba(0,0,0,0.25)] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white">
                  {student.name}
                </td>
                {visibleCategories.map((cat) => {
                  const score = student.scores[cat];
                  const value = score?.value ?? 0;
                  const remark = score?.remark;
                  const rule = SCORE_RULES[cat];
                  const errorKey = `${student.id}:${cat}`;
                  const hasError = errors.has(errorKey);
                  const editable = isCategoryEditable(cat, user?.role || 'monitor') && !NO_EDIT_CATEGORIES.has(cat);
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
                          onChange={(e) => handleScoreChange(student.id, cat, e.target.value)}
                          className={`w-20 rounded-md border px-2 py-1 text-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30 ${
                            hasError ? 'border-red-300 bg-red-50 text-red-600' : 'border-neutral-200 bg-white text-neutral-950 hover:border-primary-300 focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white'
                          }`}
                          title={hasError ? errors.get(errorKey) : `${rule.label}: 最大 ${rule.max ?? '-'}`}
                        />
                        {supportsScoreDetails(cat) && (
                          <button
                            type="button"
                            className={`absolute -top-2 -right-2 h-5 w-5 rounded-full text-[10px] font-semibold text-white shadow-sm ${
                              hasDetails ? 'bg-primary-500' : 'bg-neutral-400 hover:bg-primary-500'
                            }`}
                            title={hasDetails ? `查看加分明细，${detailItems.length || 1} 条` : '填写加分明细'}
                            onClick={() => { void openRemark(student.id, cat, remark); }}
                          >
                            明
                          </button>
                        )}
                      </div>
                      {hasError && <div className="mt-0.5 text-xs text-red-500">{errors.get(errorKey)}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {students.length === 0 && <div className="py-12 text-center text-neutral-400">暂无学生数据</div>}
      </div>

      <div className="text-sm text-neutral-400">
        共 {students.length} 名学生{searchQuery && ` (搜索结果: ${sortedStudents.length} 名)`}
      </div>

      {editingRemark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setEditingRemark(null)}>
          <div className="w-[720px] max-w-[92vw] rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-3 text-lg font-semibold text-neutral-950 dark:text-white">
              加分明细 - {SCORE_RULES[editingRemark.category as keyof typeof SCORE_RULES]?.label || editingRemark.category}
            </h3>
            <div className="overflow-hidden rounded-md border border-[#d8c9b8] bg-white dark:border-neutral-700 dark:bg-neutral-950">
              <div className="grid grid-cols-[1fr_150px_72px] border-b border-[#d8c9b8] bg-[#f7f2ea] text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                <div className="px-3 py-2">加分事项</div>
                <div className="px-3 py-2 text-center">加分分数</div>
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
                      placeholder="加分事项"
                      className="border-0 border-r border-[#eee4d8] bg-white px-3 py-2 text-sm text-neutral-950 outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                    <input
                      value={row.itemScore}
                      onChange={(event) => {
                        const next = [...remarkRows];
                        next[index] = { ...next[index], itemScore: event.target.value };
                        setRemarkRows(next);
                      }}
                      placeholder="加分分数"
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
                合计：<strong className="text-neutral-900 dark:text-white">{detailTotal.toFixed(2)}</strong>
                {SCORE_RULES[editingRemark.category as keyof typeof SCORE_RULES]?.max !== null && (
                  <span>，满分 {SCORE_RULES[editingRemark.category as keyof typeof SCORE_RULES]?.max}</span>
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
          </div>
        </div>
      )}
    </div>
  );
}
