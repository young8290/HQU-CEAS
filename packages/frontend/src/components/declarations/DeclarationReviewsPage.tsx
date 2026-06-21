import { useEffect, useState } from 'react';
import DataPanel from '../common/DataPanel';
import StatusChip from '../common/StatusChip';
import ScreenState from '../common/ScreenState';
import { api } from '../../lib/api';

export default function DeclarationReviewsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [opinion, setOpinion] = useState('');
  const [studentLevels, setStudentLevels] = useState<Record<number, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/declaration-reviews');
      setItems(data.data || []);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openDetail(id: number) {
    const detail = await api.get(`/declaration-reviews/${id}`);
    setSelected(detail);
    const nextLevels: Record<number, string> = {};
    detail.students?.forEach((item: any) => {
      nextLevels[item.id] = item.itemLevel || '院级';
    });
    setStudentLevels(nextLevels);
  }

  async function review(action: 'return' | 'approve') {
    if (!selected) return;
    try {
      await api.post(`/declaration-reviews/${selected.id}/${action}`, {
        opinion,
        studentLevels: Object.entries(studentLevels).map(([declarationStudentId, itemLevel]) => ({
          declarationStudentId: Number(declarationStudentId),
          itemLevel,
        })),
      });
      setMessage(action === 'approve' ? '申报已通过' : '申报已退回');
      setSelected(null);
      setOpinion('');
      load();
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{message}</div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <DataPanel title="审核列表">
          {loading ? <ScreenState label="审核列表加载中..." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950">
                  <tr>
                    <th className="px-3 py-2">班级</th>
                    <th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">学生数</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.class?.grade?.name}{item.class?.name}</td>
                      <td className="px-3 py-2">{item.declarationType === 'award' ? '奖学金' : '荣誉称号'}</td>
                      <td className="px-3 py-2">{item.students?.length || 0}</td>
                      <td className="px-3 py-2"><StatusChip label={statusLabel(item.status)} tone={statusTone(item.status)} /></td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => openDetail(item.id)} className="text-[#7c4a34] hover:text-[#5f3827] dark:text-primary-400">查看</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataPanel>
        <DataPanel title="审核详情" description="审核意见会写入申报批次记录。">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{selected.class?.grade?.name}{selected.class?.name}</p>
                <p className="text-xs text-neutral-500">提交人：{selected.submittedByUser?.displayName || selected.submittedByUser?.username || '-'}</p>
              </div>
              <AgreementPdf declaration={selected} />
              <div className="max-h-64 overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                {selected.students?.map((item: any) => (
                  <div key={item.id} className="border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 dark:border-neutral-800">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <span className="font-medium text-neutral-900 dark:text-white">{item.student?.name}</span>
                        <span className="ml-2 text-xs text-neutral-500">{item.itemType}</span>
                      </div>
                      {selected.declarationType === 'honor' && (
                        <select
                          value={studentLevels[item.id] || item.itemLevel || '院级'}
                          onChange={(event) => setStudentLevels({ ...studentLevels, [item.id]: event.target.value })}
                          className="w-28 rounded-md border border-[#d8c9b8] bg-white px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                        >
                          <option value="院级">院级</option>
                          <option value="校级">校级</option>
                        </select>
                      )}
                    </div>
                    <MaterialPreview value={item.materialJson} />
                  </div>
                ))}
              </div>
              <textarea
                value={opinion}
                onChange={(event) => setOpinion(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                placeholder="填写审核意见"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => review('return')} className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300">退回修改</button>
                <button type="button" onClick={() => review('approve')} className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm font-medium text-white hover:bg-[#7c4a34]">确认通过</button>
              </div>
            </div>
          ) : (
            <ScreenState label="请选择一条申报记录" />
          )}
        </DataPanel>
      </div>
    </div>
  );
}

function AgreementPdf({ declaration }: { declaration: any }) {
  const pdf = declaration?.agreementSignatures?.[0]?.pdfFile;
  if (!pdf) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        班长确认协议 PDF 未生成
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-neutral-900 dark:text-white">班长确认协议 PDF</p>
          <p className="text-xs text-neutral-500">审核前请核对协议签名与申报批次。</p>
        </div>
        <button
          type="button"
          onClick={() => api.download(`/pdf-materials/${pdf.id}/download`, `班长确认协议-${pdf.id}.pdf`)}
          className="w-fit rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-[#f6f1e8] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
        >
          下载 PDF
        </button>
      </div>
    </div>
  );
}

function MaterialPreview({ value }: { value?: string }) {
  if (!value || value === '{}') return null;
  try {
    const parsed = JSON.parse(value);
    const rows = [
      ['推荐来源', parsed.recommendationSource],
      ['申报级别', parsed.recommendationLevel],
      ['任职情况', parsed.positionInfo],
      ['竞赛活动', parsed.competitionActivity],
      ['备注', parsed.remark],
    ].filter(([, detail]) => detail);
    if (!rows.length) return null;
    return (
      <div className="mt-2 space-y-1 text-xs text-neutral-500">
        {rows.map(([label, detail]) => (
          <p key={label}><span className="text-neutral-700 dark:text-neutral-300">{label}：</span>{detail}</p>
        ))}
      </div>
    );
  } catch {
    return <p className="mt-2 text-xs text-neutral-500">{value}</p>;
  }
}

function statusLabel(status: string) {
  return { draft: '草稿', submitted: '待审核', returned: '已退回', approved: '已通过' }[status] || status;
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'approved') return 'success';
  if (status === 'returned') return 'warning';
  if (status === 'submitted') return 'info';
  return 'neutral';
}
