import { useEffect, useMemo, useState } from 'react';
import DataPanel from '../../components/ui/DataPanel';
import StatusChip from '../../components/ui/StatusChip';
import ScreenState from '../../components/ui/ScreenState';
import Checklist from './Checklist';
import SignaturePad from '../../components/ui/SignaturePad';
import SignatureUpload from '../../components/ui/SignatureUpload';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { checklistItems } from './Checklist';

interface Candidate {
  studentId: number;
  studentNo: string;
  name: string;
  className: string;
  eligible: boolean;
  academicRank: number;
  totalRank: number;
  totalScore: number;
  moralScore: number;
  sportsBaseScore: number;
  communityScore: number;
  blockedReasons: string[];
  tags: string[];
}

export default function AwardsPage() {
  const user = getUser();
  const classId = user?.classId;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [allocation, setAllocation] = useState<any>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [signatureFile, setSignatureFile] = useState<any>(null);
  const [declaration, setDeclaration] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) {
      setLoading(false);
      return;
    }
    Promise.all([
      api.get(`/declaration/awards/candidates/${classId}`),
      api.get(`/declaration/awards/allocation/${classId}`),
      api.get(`/declaration/award-declarations/class/${classId}`),
    ])
      .then(([candidateData, allocationData, declarationData]) => {
        setCandidates(candidateData);
        setAllocation(allocationData);
        setDeclaration(declarationData);
        const initial: Record<number, boolean> = {};
        allocationData?.students?.forEach((item: Candidate) => {
          initial[item.studentId] = true;
        });
        setSelected(initial);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [classId]);

  const selectedRows = useMemo(() => candidates.filter((item) => selected[item.studentId]), [candidates, selected]);
  const allocationByStudent = useMemo(() => {
    const map = new Map<number, any>();
    allocation?.students?.forEach((item: any) => map.set(item.studentId, item));
    return map;
  }, [allocation]);
  const submitIssues = useMemo(() => {
    const issues: string[] = [];
    if (!classId) issues.push('账号未绑定班级');
    if (selectedRows.length === 0) issues.push('至少选择 1 名符合条件的学生');
    const missingChecklist = checklistItems('award')
      .filter(([code]) => !checklist[code])
      .map(([, label]) => label);
    if (missingChecklist.length > 0) {
      issues.push(`确认项未完成：${missingChecklist.join('、')}`);
    }
    if (!signatureFile?.id) issues.push('班长确认协议签名尚未保存');
    if (allocation?.validation && !allocation.validation.valid) {
      issues.push(`院奖分配未通过：${(allocation.validation.issues || []).join('、') || '名额、金额或等级人数需核对'}`);
    }
    return issues;
  }, [allocation, checklist, classId, selectedRows.length, signatureFile]);

  async function submitDeclaration() {
    if (!classId) return;
    if (submitIssues.length > 0) {
      setMessage(submitIssues[0]);
      return;
    }
    try {
      await api.post('/declaration/award-declarations', {
        classId,
        studentSelections: selectedRows.map((item) => ({
          studentId: item.studentId,
          itemLevel: allocationByStudent.get(item.studentId)?.itemLevel || 'third',
          amount: allocationByStudent.get(item.studentId)?.amount ?? 600,
        })),
        checklist,
        signatureFileId: signatureFile?.id,
      });
      setMessage('奖学金申报已提交');
      setDeclaration(await api.get(`/declaration/award-declarations/class/${classId}`, { forceRefresh: true }));
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function saveSignature(imageData: string, method: 'draw' | 'upload') {
    try {
      const saved = await api.post('/platform/signatures', {
        signerName: user?.displayName || user?.username || '班长',
        method,
        purpose: 'monitor_agreement',
        imageData,
      });
      setSignatureFile(saved);
      setMessage('签名已保存');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  if (loading) return <ScreenState label="奖学金候选加载中" />;

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {message}
        </div>
      )}

      <DataPanel
        title="院奖分配预览"
        description="按综测总分排序，核对名额、金额和等级人数。"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="名额" value={allocation?.quota?.quotaCount ?? '-'} />
          <Metric label="可支配金额" value={allocation?.quota?.availableAmount ?? '-'} />
          <Metric label="推荐人数" value={allocation?.summary?.totalCount ?? 0} />
          <Metric label="推荐金额" value={allocation?.summary?.totalAmount ?? 0} />
        </div>
        <div className="mt-4">
          <StatusChip
            label={allocation?.validation?.valid ? '分配通过' : '分配未通过'}
            tone={allocation?.validation?.valid ? 'success' : 'danger'}
          />
        </div>
      </DataPanel>

      <DataPanel title="候选名单" description="未通过条件的学生会显示原因。">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2">选择</th>
                <th className="px-3 py-2">学生</th>
                <th className="px-3 py-2">学习排名</th>
                <th className="px-3 py-2">综测排名</th>
                <th className="px-3 py-2">德育</th>
                <th className="px-3 py-2">体育基础分</th>
                <th className="px-3 py-2">社区</th>
                <th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {candidates.map((item) => (
                <tr key={item.studentId}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selected[item.studentId]}
                      disabled={!item.eligible}
                      onChange={(event) => setSelected({ ...selected, [item.studentId]: event.target.checked })}
                      className="h-4 w-4 accent-primary-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-900 dark:text-white">{item.name}</div>
                    <div className="text-xs text-neutral-500">{item.studentNo}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{item.academicRank}</td>
                  <td className="px-3 py-2 tabular-nums">{item.totalRank}</td>
                  <td className="px-3 py-2 tabular-nums">{item.moralScore}</td>
                  <td className="px-3 py-2 tabular-nums">{item.sportsBaseScore}</td>
                  <td className="px-3 py-2 tabular-nums">{item.communityScore}</td>
                  <td className="px-3 py-2">
                    <StatusChip label={item.eligible ? '可申报' : item.blockedReasons[0] || '未通过'} tone={item.eligible ? 'success' : 'danger'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataPanel>

      <DataPanel
        title="班长确认项"
        description="勾选全部确认项后提交。"
        actions={
          <button
            type="button"
            onClick={submitDeclaration}
            disabled={submitIssues.length > 0}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
          >
            提交申报
          </button>
        }
      >
        <SubmitGate issues={submitIssues} />
        <Checklist type="award" value={checklist} onChange={setChecklist} />
      </DataPanel>

      <DataPanel title="班长确认协议" description="签名后生成确认协议 PDF。">
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <SignaturePad
            signerName={user?.displayName || user?.username || '班长'}
            purpose="奖学金班长确认协议"
            onSaved={(imageData) => saveSignature(imageData, 'draw')}
          />
          <div className="space-y-3">
            <SignatureUpload onLoaded={(imageData) => saveSignature(imageData, 'upload')} />
            <StatusChip
              label={signatureFile ? '签名已保存' : '等待签名'}
              tone={signatureFile ? 'success' : 'warning'}
            />
            <PdfState declaration={declaration} />
          </div>
        </div>
      </DataPanel>
    </div>
  );
}

function SubmitGate({ issues }: { issues: string[] }) {
  if (issues.length === 0) {
    return (
      <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        申报材料已就绪。
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
      <p className="font-medium">待完成事项</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ol>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function PdfState({ declaration }: { declaration: any }) {
  const pdf = declaration?.agreementSignatures?.[0]?.pdfFile;
  if (!pdf) {
    return <p className="text-sm text-neutral-500">确认协议 PDF 未生成</p>;
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <p className="font-medium text-neutral-900 dark:text-white">确认协议 PDF 已保存</p>
      <button
        type="button"
        onClick={() => api.download(`/platform/pdf-materials/${pdf.id}/download`, `奖学金确认协议-${pdf.id}.pdf`)}
        className="mt-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        下载 PDF
      </button>
    </div>
  );
}
