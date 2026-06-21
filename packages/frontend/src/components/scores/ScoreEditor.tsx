import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useScores } from '../../hooks/useScores';
import { SCORE_RULES, SCORE_CATEGORIES_ORDER, validateScore, isCategoryEditable } from '../../lib/validation';
import { getUser } from '../../lib/auth';

interface Props {
  classId: number;
  onBack?: () => void;
}

export default function ScoreEditor({ classId, onBack }: Props) {
  const { students, loading, saveStatus, lastSaved, updateScore, updateRemark, loadScores } = useScores(classId);
  const [editingRemark, setEditingRemark] = useState<{ studentId: number; category: string } | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [sortBy, setSortBy] = useState<string>('studentNo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const user = getUser();
  const isAdmin = user?.role === 'admin';

  const handleScoreChange = (studentId: number, category: string, rawValue: string) => {
    const value = rawValue === '' ? 0 : parseFloat(rawValue);
    if (isNaN(value)) return;

    const error = updateScore(studentId, category, value);
    const key = `${studentId}:${category}`;
    if (error) {
      setErrors((prev) => new Map(prev).set(key, error));
    } else {
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRemarkSave = (studentId: number, category: string) => {
    updateRemark(studentId, category, remarkText);
    setEditingRemark(null);
    setRemarkText('');
  };

  const openRemark = (studentId: number, category: string, currentRemark: string | null) => {
    setEditingRemark({ studentId, category });
    setRemarkText(currentRemark || '');
  };

  // Sort students
  const sortedStudents = [...students]
    .filter((s) => {
      if (!searchQuery) return true;
      return s.name.includes(searchQuery) || s.studentNo.includes(searchQuery);
    })
    .sort((a, b) => {
      let compare = 0;
      if (sortBy === 'studentNo') {
        compare = a.studentNo.localeCompare(b.studentNo);
      } else if (sortBy === 'name') {
        compare = a.name.localeCompare(b.name);
      } else if (sortBy === 'total') {
        compare = (a.scores.total?.value || 0) - (b.scores.total?.value || 0);
      } else {
        compare = (a.scores[sortBy]?.value || 0) - (b.scores[sortBy]?.value || 0);
      }
      return sortDir === 'asc' ? compare : -compare;
    });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const getSortIndicator = (column: string) => {
    if (sortBy !== column) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">加载分数数据中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onBack?.(); }}
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600 transition-colors"
          >
            ← 返回选择
          </a>
          <h1 className="text-xl font-bold text-neutral-950 dark:text-white font-headings">分数编辑</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status indicator */}
          <div className="flex items-center gap-2 text-sm">
            {saveStatus === 'saving' && (
              <span className="text-amber-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                保存中...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                已保存 {lastSaved}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                保存失败
              </span>
            )}
            {saveStatus === 'idle' && (
              <span className="text-neutral-400">就绪</span>
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="搜索学生..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-sm text-neutral-950 focus:border-[#9a5b3d] focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:border-primary-500"
          />

          <button
            onClick={() => loadScores()}
            className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            刷新
          </button>
        </div>
      </div>

      {/* Score table */}
      <div className="overflow-x-auto rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              <th
                className="sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300 cursor-pointer hover:text-primary-600 whitespace-nowrap"
                onClick={() => handleSort('studentNo')}
              >
                学号{getSortIndicator('studentNo')}
              </th>
              <th
                className="sticky left-[80px] z-10 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300 cursor-pointer hover:text-primary-600 whitespace-nowrap"
                onClick={() => handleSort('name')}
              >
                姓名{getSortIndicator('name')}
              </th>
              {SCORE_CATEGORIES_ORDER.map((cat) => (
                <th
                  key={cat}
                  className={`px-3 py-3 text-center font-medium whitespace-nowrap cursor-pointer hover:text-primary-600 ${
                    isCategoryEditable(cat, user?.role || 'monitor')
                      ? 'text-neutral-700 dark:text-neutral-200'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                  onClick={() => handleSort(cat)}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs">{SCORE_RULES[cat].label}{getSortIndicator(cat)}</span>
                    {SCORE_RULES[cat].max !== null && (
                      <span className="text-xs text-neutral-400">满{SCORE_RULES[cat].max}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((student, idx) => (
              <tr
                key={student.id}
                className={`border-b border-neutral-100 dark:border-neutral-800/50 ${
                  idx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-neutral-900/30'
                } hover:bg-primary-50/30 dark:hover:bg-primary-500/5 transition-colors`}
              >
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                  {student.studentNo}
                </td>
                <td className="sticky left-[80px] z-10 bg-inherit px-3 py-2 font-medium text-neutral-950 dark:text-white whitespace-nowrap">
                  {student.name}
                </td>
                {SCORE_CATEGORIES_ORDER.map((cat) => {
                  const score = student.scores[cat];
                  const value = score?.value ?? 0;
                  const remark = score?.remark;
                  const rule = SCORE_RULES[cat];
                  const errorKey = `${student.id}:${cat}`;
                  const hasError = errors.has(errorKey);
                  const isEditing = editingRemark?.studentId === student.id && editingRemark?.category === cat;

                  if (!isCategoryEditable(cat, user?.role || 'monitor')) {
                    return (
                      <td key={cat} className="px-3 py-2 text-center text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                        <span className={cat === 'total' ? 'font-bold text-neutral-950 dark:text-white text-base' : ''}>
                          {value.toFixed(2)}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td key={cat} className="px-1 py-1 text-center relative group">
                      <div className="relative">
                        <input
                          type="number"
                          step={rule.step}
                          min="0"
                          max={rule.max ?? undefined}
                          value={value || ''}
                          onChange={(e) => handleScoreChange(student.id, cat, e.target.value)}
                          className={`w-16 px-2 py-1 text-center text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30 ${
                            hasError
                              ? 'border-red-300 bg-red-50 dark:bg-red-500/10 text-red-600'
                              : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white hover:border-primary-300 focus:border-primary-500'
                          }`}
                          title={hasError ? errors.get(errorKey) : `${rule.label}: 最大${rule.max}`}
                        />
                        {/* Remark indicator */}
                        {remark && (
                          <div
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary-500 cursor-pointer"
                            title={remark}
                            onClick={() => openRemark(student.id, cat, remark)}
                          />
                        )}
                        {/* Remark button on hover */}
                        <button
                          onClick={() => openRemark(student.id, cat, remark || null)}
                          className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="编辑备注"
                        >
                          ✎
                        </button>
                      </div>
                      {hasError && (
                        <div className="text-xs text-red-500 mt-0.5">{errors.get(errorKey)}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {students.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            该班级暂无学生数据
          </div>
        )}
      </div>

      {/* Student count */}
      <div className="text-sm text-neutral-400">
        共 {students.length} 名学生
        {searchQuery && ` (搜索结果: ${sortedStudents.length} 名)`}
      </div>

      {/* Remark modal */}
      {editingRemark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setEditingRemark(null)}>
          <div className="w-96 rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-3">
              编辑备注 - {SCORE_RULES[editingRemark.category as keyof typeof SCORE_RULES]?.label || editingRemark.category}
            </h3>
            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              className="h-24 w-full resize-none rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:border-[#9a5b3d] focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-primary-500"
              placeholder="输入备注..."
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditingRemark(null)}
                className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                取消
              </button>
              <button
                onClick={() => handleRemarkSave(editingRemark.studentId, editingRemark.category)}
                className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white transition-colors hover:bg-[#7c4a34]"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
