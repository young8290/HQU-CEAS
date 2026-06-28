import { useEffect, useMemo, useState } from 'react';
import DataPanel from '../common/DataPanel';
import StatusChip from '../common/StatusChip';
import ScreenState from '../common/ScreenState';
import Checklist from '../declarations/Checklist';
import SignaturePad from '../signature/SignaturePad';
import SignatureUpload from '../signature/SignatureUpload';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import { checklistItems } from '../declarations/Checklist';

const HONOR_TYPES = [
  { value: 'excellent_student', label: '优秀学生' },
  { value: 'excellent_cadre', label: '优秀学生干部' },
] as const;

type HonorType = typeof HONOR_TYPES[number]['value'];

interface Candidate {
  studentId: number;
  studentNo: string;
  name: string;
  eligible: boolean;
  academicRank: number;
  totalRank: number;
  moralScore: number;
  sportsBaseScore: number;
  communityScore: number;
  recommendationLevel?: string;
  recommendationSource?: string;
  intent?: boolean | null;
  positionInfo?: string;
  competitionActivity?: string;
  disciplinaryAction?: string;
  remark?: string;
  classHonorQuota?: number;
  materialRequirements?: string[];
  blockedReasons?: string[];
}

export default function HonorsPage() {
  const user = getUser();
  const classId = user?.classId;
  const [honorType, setHonorType] = useState<HonorType>('excellent_student');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [levels, setLevels] = useState<Record<number, string>>({});
  const [sources, setSources] = useState<Record<number, string>>({});
  const [materials, setMaterials] = useState<Record<number, {
    positionInfo: string;
    competitionActivity: string;
    remark: string;
  }>>({});
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
    setLoading(true);
    api.get<Candidate[]>(`/honors/candidates/${classId}?honorType=${honorType}`, { forceRefresh: true })
      .then((data) => {
        setCandidates(data);
        const nextSelected: Record<number, boolean> = {};
        const nextLevels: Record<number, string> = {};
        const nextSources: Record<number, string> = {};
        const nextMaterials: Record<number, { positionInfo: string; competitionActivity: string; remark: string }> = {};
        data.forEach((item) => {
          nextSelected[item.studentId] = item.eligible && item.intent !== false;
          nextLevels[item.studentId] = item.recommendationLevel || '院级';
          nextSources[item.studentId] = item.recommendationSource || '班级推荐';
          nextMaterials[item.studentId] = {
            positionInfo: item.positionInfo || '',
            competitionActivity: item.competitionActivity || '',
            remark: item.remark || '',
          };
        });
        setSelected(nextSelected);
        setLevels(nextLevels);
        setSources(nextSources);
        setMaterials(nextMaterials);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
    api.get(`/honor-declarations/class/${classId}`, { forceRefresh: true })
      .then(setDeclaration)
      .catch(() => setDeclaration(null));
  }, [classId, honorType]);

  const selectedRows = useMemo(() => candidates.filter((item) => selected[item.studentId]), [candidates, selected]);
  const classRecommendedCadres = selectedRows.filter((item) => (sources[item.studentId] || '班级推荐') !== '学生会推荐').length;
  const cadreQuota = candidates[0]?.classHonorQuota || 1;
  const submitIssues = useMemo(() => {
    const issues: string[] = [];
    if (!classId) issues.push('当前账号未绑定班级');
    if (selectedRows.length === 0) issues.push('至少选择 1 名符合条件的学生');
    const missingChecklist = checklistItems('honor')
      .filter(([code]) => !checklist[code])
      .map(([, label]) => label);
    if (missingChecklist.length > 0) {
      issues.push(`确认项未完成：${missingChecklist.join('、')}`);
    }
    if (!signatureFile?.id) issues.push('班长确认协议签名尚未保存');
    if (honorType === 'excellent_cadre' && classRecommendedCadres > cadreQuota) {
      issues.push(`班级推荐优秀学生干部人数 ${classRecommendedCadres} 超过名额 ${cadreQuota}`);
    }
    if (honorType === 'excellent_cadre') {
      const missingCadreMaterial = selectedRows.filter((item) => {
        const material = materials[item.studentId];
        return !material?.positionInfo?.trim() || !material?.competitionActivity?.trim();
      });
      if (missingCadreMaterial.length > 0) {
        issues.push(`优秀学生干部材料未补全：${missingCadreMaterial.map((item) => item.name).join('、')}`);
      }
    }
    return issues;
  }, [cadreQuota, checklist, classId, classRecommendedCadres, honorType, materials, selectedRows, signatureFile]);

  async function submitDeclaration() {
    if (!classId) return;
    if (submitIssues.length > 0) {
      setMessage(submitIssues[0]);
      return;
    }
    try {
      await api.post('/honor-declarations', {
        classId,
        honorType,
        studentSelections: selectedRows.map((item) => ({
          studentId: item.studentId,
          itemLevel: levels[item.studentId] || '院级',
          recommendationSource: sources[item.studentId] || '班级推荐',
          material: {
            recommendationLevel: levels[item.studentId] || '院级',
            recommendationSource: sources[item.studentId] || '班级推荐',
            disciplinaryAction: item.disciplinaryAction || '无',
            positionInfo: materials[item.studentId]?.positionInfo || '',
            competitionActivity: materials[item.studentId]?.competitionActivity || '',
            remark: materials[item.studentId]?.remark || '',
          },
        })),
        checklist,
        signatureFileId: signatureFile?.id,
      });
      setMessage('荣誉称号申报已提交');
      setDeclaration(await api.get(`/honor-declarations/class/${classId}`, { forceRefresh: true }));
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function saveSignature(imageData: string, method: 'draw' | 'upload') {
    try {
      const saved = await api.post('/signatures', {
        signerName: user?.displayName || user?.username || '班长',
        method,
        purpose: 'monitor_agreement',
        imageData,
      });
      setSignatureFile(saved);
      setMessage('班长确认协议签名已保存');
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  function patchMaterial(studentId: number, key: 'positionInfo' | 'competitionActivity' | 'remark', value: string) {
    setMaterials({
      ...materials,
      [studentId]: {
        positionInfo: materials[studentId]?.positionInfo || '',
        competitionActivity: materials[studentId]?.competitionActivity || '',
        remark: materials[studentId]?.remark || '',
        [key]: value,
      },
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {message}
        </div>
      )}

      <DataPanel title="申报类型" description="优秀学生按条件申报，无名额限制；优秀学生干部区分班级推荐和学生会推荐。">
        <div className="flex flex-wrap gap-2">
          {HONOR_TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setHonorType(item.value)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                honorType === item.value
                  ? 'border-[#9a5b3d] bg-[#fffaf2] text-[#7c4a34]'
                  : 'border-[#ded6c8] bg-white text-neutral-600 hover:border-[#9a5b3d] hover:bg-[#fffaf2]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {honorType === 'excellent_cadre' && (
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
            当前班级推荐名额 {cadreQuota} 人，已选择班级推荐 {classRecommendedCadres} 人；学生会推荐不占用班级名额。
          </p>
        )}
      </DataPanel>

      <DataPanel title="候选名单" description="申报级别为班级填报意见，管理员审核通过时确认最终获奖级别。">
        {loading ? (
          <ScreenState label="候选名单加载中..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2">选择</th>
                  <th className="px-3 py-2">学生</th>
                  <th className="px-3 py-2">学习排名</th>
                  <th className="px-3 py-2">综测排名</th>
                  <th className="px-3 py-2">社区</th>
                  <th className="px-3 py-2">体育基础分</th>
                  <th className="px-3 py-2">申报级别</th>
                  {honorType === 'excellent_cadre' && <th className="px-3 py-2">推荐来源</th>}
                  {honorType === 'excellent_cadre' && <th className="px-3 py-2">任职情况</th>}
                  <th className="px-3 py-2">竞赛活动</th>
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
                        className="h-4 w-4 accent-[#9a5b3d]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-neutral-900 dark:text-white">{item.name}</div>
                      <div className="text-xs text-neutral-500">{item.studentNo}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{item.academicRank}</td>
                    <td className="px-3 py-2 tabular-nums">{item.totalRank}</td>
                    <td className="px-3 py-2 tabular-nums">{item.communityScore}</td>
                    <td className="px-3 py-2 tabular-nums">{item.sportsBaseScore}</td>
                    <td className="px-3 py-2">
                      <select
                        value={levels[item.studentId] || '院级'}
                        onChange={(event) => setLevels({ ...levels, [item.studentId]: event.target.value })}
                        className="w-24 rounded-md border border-[#d8c9b8] bg-white px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      >
                        <option value="院级">院级</option>
                        <option value="校级">校级</option>
                      </select>
                    </td>
                    {honorType === 'excellent_cadre' && (
                      <td className="px-3 py-2">
                        <select
                          value={sources[item.studentId] || '班级推荐'}
                          onChange={(event) => setSources({ ...sources, [item.studentId]: event.target.value })}
                          className="w-28 rounded-md border border-[#d8c9b8] bg-white px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                        >
                          <option value="班级推荐">班级推荐</option>
                          <option value="学生会推荐">学生会推荐</option>
                        </select>
                      </td>
                    )}
                    {honorType === 'excellent_cadre' && (
                      <td className="px-3 py-2">
                        <textarea
                          value={materials[item.studentId]?.positionInfo || ''}
                          onChange={(event) => patchMaterial(item.studentId, 'positionInfo', event.target.value)}
                          rows={2}
                          className="w-64 rounded-md border border-[#d8c9b8] bg-white px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <textarea
                        value={materials[item.studentId]?.competitionActivity || ''}
                        onChange={(event) => patchMaterial(item.studentId, 'competitionActivity', event.target.value)}
                        rows={2}
                        className="w-64 rounded-md border border-[#d8c9b8] bg-white px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <StatusChip label={item.eligible ? '可申报' : item.blockedReasons?.[0] || '未通过'} tone={item.eligible ? 'success' : 'danger'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      <DataPanel
        title="班长确认项"
        description="荣誉称号申报需要确认学生本人意愿和相关材料真实性。"
        actions={
          <button
            type="button"
            onClick={submitDeclaration}
            disabled={submitIssues.length > 0}
            className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#7c4a34] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
          >
            提交申报
          </button>
        }
      >
        <SubmitGate issues={submitIssues} />
        <Checklist type="honor" value={checklist} onChange={setChecklist} />
      </DataPanel>

      <DataPanel title="班长确认协议" description="签名保存后，提交申报时生成并归档荣誉称号确认协议 PDF。">
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <SignaturePad
            signerName={user?.displayName || user?.username || '班长'}
            purpose="荣誉称号班长确认协议"
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
        提交前检查已通过，可以提交班级荣誉称号申报。
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
      <p className="font-medium">提交前还需完成以下事项</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ol>
    </div>
  );
}

function PdfState({ declaration }: { declaration: any }) {
  const pdf = declaration?.agreementSignatures?.[0]?.pdfFile;
  if (!pdf) {
    return <p className="text-sm text-neutral-500">确认协议 PDF：未生成</p>;
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <p className="font-medium text-neutral-900 dark:text-white">确认协议 PDF 已归档</p>
      <button
        type="button"
        onClick={() => api.download(`/pdf-materials/${pdf.id}/download`, `荣誉称号确认协议-${pdf.id}.pdf`)}
        className="mt-2 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        下载 PDF
      </button>
    </div>
  );
}
