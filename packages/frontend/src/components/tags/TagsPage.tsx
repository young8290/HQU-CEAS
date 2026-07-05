import { useEffect, useState } from 'react';
import DataPanel from '../common/DataPanel';
import StatusChip from '../common/StatusChip';
import { api } from '../../lib/api';

type ViewMode = 'all' | 'class' | 'award';

export default function TagsPage() {
  const [tags, setTags] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ classes: any[]; awards: any[] }>({ classes: [], awards: [] });
  const [mode, setMode] = useState<ViewMode>('all');
  const [classId, setClassId] = useState('');
  const [tagName, setTagName] = useState('');
  const [message, setMessage] = useState('');

  async function load(nextMode = mode, nextClassId = classId, nextTagName = tagName) {
    const query = new URLSearchParams();
    query.set('pageSize', '100');
    if (nextMode === 'class' && nextClassId) query.set('classId', nextClassId);
    if (nextMode === 'award' && nextTagName) query.set('tagName', nextTagName);
    api.get(`/tags?${query.toString()}`, { forceRefresh: true })
      .then((data) => {
        setTags(data.data || []);
        setSummary(data.summary || { classes: [], awards: [] });
      })
      .catch((error) => setMessage(error.message));
  }

  useEffect(() => {
    load();
  }, []);

  function changeMode(nextMode: ViewMode) {
    setMode(nextMode);
    if (nextMode === 'all') {
      setClassId('');
      setTagName('');
      load('all', '', '');
      return;
    }
    load(nextMode, classId, tagName);
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{message}</div>}

      <DataPanel title="查看方式" description="按标签、班级或奖项查看。">
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: '全部' },
            { value: 'class', label: '按班级' },
            { value: 'award', label: '按奖项' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => changeMode(item.value as ViewMode)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                mode === item.value
                  ? 'border-[#9a5b3d] bg-[#fffaf2] text-[#7c4a34]'
                  : 'border-[#ded6c8] bg-white text-neutral-600 hover:border-[#9a5b3d] hover:bg-[#fffaf2] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === 'class' && (
          <div className="mt-4 max-w-sm">
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">班级</label>
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                load('class', event.target.value, tagName);
              }}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
            >
              <option value="">全部班级</option>
              {summary.classes.map((item) => (
                <option key={item.classId} value={item.classId}>{item.className}（{item.count}）</option>
              ))}
            </select>
          </div>
        )}

        {mode === 'award' && (
          <div className="mt-4 max-w-sm">
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">奖项或标签</label>
            <select
              value={tagName}
              onChange={(event) => {
                setTagName(event.target.value);
                load('award', classId, event.target.value);
              }}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
            >
              <option value="">全部奖项</option>
              {summary.awards.map((item) => (
                <option key={item.tagName} value={item.tagName}>{tagLabel(item.tagName)}（{item.count}）</option>
              ))}
            </select>
          </div>
        )}
      </DataPanel>

      <DataPanel title="标签列表">
        {tags.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">暂无标签。</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tags.map((tag) => (
              <div key={tag.id} className="rounded-lg border border-[#ded6c8] bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <StatusChip label={tagLabel(tag.tagName)} tone={tagTone(tag.tagName)} />
                  <span className="text-xs text-neutral-500">{tagTypeLabel(tag.tagType)}</span>
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{tag.student?.name || tag.class?.name || '-'}</p>
                <p className="text-xs text-neutral-500">
                  {tag.student?.studentNo || '-'} · {tag.class?.grade?.name || ''}{tag.class?.name || ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function tagLabel(tagName: string) {
  const labels: Record<string, string> = {
    national_scholarship: '国家奖学金',
    national_inspirational_scholarship: '国家励志奖学金',
    school_scholarship: '校级奖学金',
    award_approved: '奖学金已通过',
    honor_approved: '荣誉称号已通过',
  };
  return labels[tagName] || tagName;
}

function tagTypeLabel(tagType: string) {
  const labels: Record<string, string> = {
    external_award: '外部奖项',
    declaration: '申报状态',
  };
  return labels[tagType] || tagType;
}

function tagTone(tagName: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (tagName.includes('approved')) return 'success';
  if (tagName.includes('national')) return 'warning';
  if (tagName.includes('school')) return 'info';
  return 'neutral';
}
