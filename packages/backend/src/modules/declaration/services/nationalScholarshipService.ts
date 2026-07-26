import ExcelJS from 'exceljs';
import prisma from '../../../core/db.js';
import { recordAuditLog } from '../../platform/services/auditService.js';
import {
  analyticB,
  computeCandidatePool,
  computeDominanceTiering,
  empiricalB,
  remainingCriticalQuota,
  resolveB,
  type NsStudentInput,
} from '../rules/nationalScholarshipRules.js';
import { deriveMajorName } from '../../../core/utils/major.js';

export interface UnitStudent {
  studentId: number;
  studentNo: string;
  name: string;
  classId: number;
  className: string;
  gradeName: string;
  gpa: number; // g
  totalScore: number; // z
}

// 总绩点 g = academic/8 − 2.5（与附件导出口径一致，四舍五入到两位）
export function gpaFromAcademic(academic: number): number {
  return Math.round((academic / 8 - 2.5) * 100) / 100;
}

function parseNumberArray(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [];
  } catch {
    return [];
  }
}

function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

// 加载评比单元（若干平行班合组）内全部学生及其 g/z
export async function loadUnitStudents(academicYearId: number, classIds: number[]): Promise<UnitStudent[]> {
  const students: UnitStudent[] = [];
  for (const classId of classIds) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        grade: true,
        students: {
          include: { scores: { where: { academicYearId } } },
          orderBy: { studentNo: 'asc' },
        },
      },
    });
    if (!cls) throw new Error(`班级 ${classId} 不存在`);
    for (const student of cls.students) {
      const scores: Record<string, number> = {};
      for (const score of student.scores) scores[score.category] = score.value;
      students.push({
        studentId: student.id,
        studentNo: student.studentNo,
        name: student.name,
        classId: cls.id,
        className: cls.name,
        gradeName: cls.grade.name,
        gpa: gpaFromAcademic(scores.academic ?? 0),
        totalScore: scores.total ?? 0,
      });
    }
  }
  return students;
}

export async function createEvaluation(data: {
  academicYearId: number;
  name: string;
  classIds: number[];
  quota: number;
  poolRatio?: number;
  paramW?: number;
  paramD?: number;
  note?: string;
  createdBy?: number;
}) {
  const name = (data.name || '').trim();
  if (!name) throw new Error('请填写评比单元名称');

  const classIds = Array.from(new Set((data.classIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)));
  if (!classIds.length) throw new Error('请至少选择一个班级');

  const quota = Math.floor(Number(data.quota));
  if (!Number.isFinite(quota) || quota < 0) throw new Error('名额必须为不小于 0 的整数');

  const poolRatio = data.poolRatio === undefined ? 0.1 : Number(data.poolRatio);
  if (!Number.isFinite(poolRatio) || poolRatio <= 0 || poolRatio > 1) throw new Error('入池比例 p 必须在 (0, 1] 之间');

  const paramW = data.paramW === undefined ? 0.5 : Number(data.paramW);
  if (!Number.isFinite(paramW) || paramW < 0) throw new Error('参数 w 必须为不小于 0 的数值');

  const paramD = data.paramD === undefined ? 1.0 : Number(data.paramD);
  if (!Number.isFinite(paramD) || paramD < 0) throw new Error('参数 d 必须为不小于 0 的数值');

  const year = await prisma.academicYear.findUnique({ where: { id: data.academicYearId } });
  if (!year) throw new Error('学年不存在');

  const classes = await prisma.class.findMany({ where: { id: { in: classIds } } });
  if (classes.length !== classIds.length) throw new Error('存在无效的班级，请重新选择');

  const evaluation = await prisma.nationalScholarshipEvaluation.create({
    data: {
      academicYearId: data.academicYearId,
      name,
      classIdsJson: JSON.stringify(classIds),
      quota,
      poolRatio,
      paramW,
      paramD,
      note: data.note?.trim() || null,
      createdBy: data.createdBy ?? null,
    },
  });

  await recordAuditLog({
    module: 'national_scholarship',
    action: 'create_evaluation',
    academicYearId: data.academicYearId,
    actorId: data.createdBy ?? null,
    targetType: 'NationalScholarshipEvaluation',
    targetId: evaluation.id,
    after: { name, classIds, quota, poolRatio, paramW, paramD },
  });

  return { ...evaluation, classIds };
}

export async function listEvaluations(academicYearId: number) {
  const evaluations = await prisma.nationalScholarshipEvaluation.findMany({
    where: { academicYearId },
    include: { _count: { select: { candidates: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return evaluations.map((evaluation) => ({
    ...evaluation,
    classIds: parseNumberArray(evaluation.classIdsJson),
    candidateCount: evaluation._count.candidates,
  }));
}

type CandidateRecord = {
  id: number;
  studentId: number;
  classId: number;
  gpa: number;
  totalScore: number;
  gRank: number;
  zRank: number;
  isClassRecommended: boolean;
  hasMajorAchievement: boolean;
  inPool: boolean;
  poolReasonsJson: string;
  dominatedByCount: number;
  robustRank: number | null;
  isCritical: boolean;
  achievements: string | null;
  reviewNote: string | null;
  finalRank: number | null;
  selected: boolean;
  student: {
    studentNo: string;
    name: string;
    class: { name: string; grade: { name: string } };
  };
};

function mapCandidate(candidate: CandidateRecord) {
  return {
    id: candidate.id,
    studentId: candidate.studentId,
    classId: candidate.classId,
    studentNo: candidate.student.studentNo,
    name: candidate.student.name,
    className: `${candidate.student.class.grade.name}${candidate.student.class.name}`,
    gpa: candidate.gpa,
    totalScore: candidate.totalScore,
    gRank: candidate.gRank,
    zRank: candidate.zRank,
    isClassRecommended: candidate.isClassRecommended,
    hasMajorAchievement: candidate.hasMajorAchievement,
    inPool: candidate.inPool,
    poolReasons: parseStringArray(candidate.poolReasonsJson),
    dominatedByCount: candidate.dominatedByCount,
    robustRank: candidate.robustRank,
    isCritical: candidate.isCritical,
    achievements: candidate.achievements,
    reviewNote: candidate.reviewNote,
    finalRank: candidate.finalRank,
    selected: candidate.selected,
  };
}

type MappedCandidate = ReturnType<typeof mapCandidate>;

function sortCandidates(candidates: MappedCandidate[]) {
  return [...candidates].sort((a, b) => {
    const rankA = a.robustRank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.robustRank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    if (a.gRank !== b.gRank) return a.gRank - b.gRank;
    return a.studentNo.localeCompare(b.studentNo);
  });
}

export async function getEvaluation(id: number) {
  const evaluation = await prisma.nationalScholarshipEvaluation.findUnique({
    where: { id },
    include: {
      academicYear: true,
      candidates: {
        include: { student: { include: { class: { include: { grade: true } } } } },
      },
    },
  });
  if (!evaluation) throw new Error('评比单元不存在');

  const classIds = parseNumberArray(evaluation.classIdsJson);
  const classes = classIds.length
    ? await prisma.class.findMany({ where: { id: { in: classIds } }, include: { grade: true } })
    : [];
  const candidates = sortCandidates(evaluation.candidates.map((candidate) => mapCandidate(candidate as CandidateRecord)));

  const poolCandidates = candidates.filter((candidate) => candidate.inPool);
  const robustSelectedCount = poolCandidates.filter((candidate) => !candidate.isCritical && candidate.selected).length;
  const summary = {
    studentCount: candidates.length,
    poolCount: poolCandidates.length,
    criticalCount: poolCandidates.filter((candidate) => candidate.isCritical).length,
    selectedCount: poolCandidates.filter((candidate) => candidate.selected).length,
    robustSelectedCount,
    remainingCriticalQuota: remainingCriticalQuota(evaluation.quota, robustSelectedCount),
  };

  return {
    id: evaluation.id,
    academicYearId: evaluation.academicYearId,
    academicYearName: evaluation.academicYear.name,
    name: evaluation.name,
    classIds,
    unitClasses: classes.map((cls) => ({ id: cls.id, name: `${cls.grade.name}${cls.name}` })),
    quota: evaluation.quota,
    poolRatio: evaluation.poolRatio,
    paramW: evaluation.paramW,
    paramD: evaluation.paramD,
    analyticB: evaluation.analyticB,
    empiricalB: evaluation.empiricalB,
    effectiveB: evaluation.effectiveB,
    status: evaluation.status,
    note: evaluation.note,
    createdAt: evaluation.createdAt,
    updatedAt: evaluation.updatedAt,
    candidates,
    summary,
  };
}

// 计算（可反复执行，幂等）：算法一入池 → 算法二定 B → 算法三分层，
// 重建 candidates 时按 studentId 保留人工字段。
export async function computeEvaluation(id: number, actorId?: number) {
  const evaluation = await prisma.nationalScholarshipEvaluation.findUnique({ where: { id } });
  if (!evaluation) throw new Error('评比单元不存在');

  const classIds = parseNumberArray(evaluation.classIdsJson);
  if (!classIds.length) throw new Error('评比单元未包含任何班级，请先编辑评比单元');

  const students = await loadUnitStudents(evaluation.academicYearId, classIds);
  if (!students.length) throw new Error('评比单元内没有学生，请先导入学生与综测数据');

  // 保留人工录入字段（班级推荐/重大成果/成果清单/评议）
  const existing = await prisma.nationalScholarshipCandidate.findMany({ where: { evaluationId: id } });
  const manualByStudentId = new Map(existing.map((candidate) => [candidate.studentId, candidate]));

  const inputs: NsStudentInput[] = students.map((student) => ({
    studentId: student.studentId,
    classId: student.classId,
    g: student.gpa,
    z: student.totalScore,
    isClassRecommended: manualByStudentId.get(student.studentId)?.isClassRecommended ?? false,
    hasMajorAchievement: manualByStudentId.get(student.studentId)?.hasMajorAchievement ?? false,
  }));

  // 算法一：候选池
  const poolRows = computeCandidatePool(inputs, evaluation.poolRatio);
  const poolByStudentId = new Map(poolRows.map((row) => [row.studentId, row]));

  // 算法二：B = min(B_解析, B_经验)
  const analytic = analyticB(evaluation.paramW, evaluation.paramD);
  const classSortedG = classIds.map((classId) => inputs
    .filter((input) => input.classId === classId)
    .map((input) => input.g)
    .sort((a, b) => b - a));
  const empirical = empiricalB(classSortedG);
  const effective = resolveB(analytic, empirical);

  // 算法三：仅对入池候选人做稳健占优分层
  const poolInputs = inputs.filter((input) => poolByStudentId.get(input.studentId)?.inPool);
  const tierRows = computeDominanceTiering(poolInputs, effective);
  const tierByStudentId = new Map(tierRows.map((row) => [row.studentId, row]));

  await prisma.nationalScholarshipCandidate.deleteMany({ where: { evaluationId: id } });
  await prisma.nationalScholarshipCandidate.createMany({
    data: students.map((student) => {
      const pool = poolByStudentId.get(student.studentId)!;
      const tier = tierByStudentId.get(student.studentId);
      const manual = manualByStudentId.get(student.studentId);
      return {
        evaluationId: id,
        studentId: student.studentId,
        classId: student.classId,
        gpa: student.gpa,
        totalScore: student.totalScore,
        gRank: pool.gRank,
        zRank: pool.zRank,
        isClassRecommended: manual?.isClassRecommended ?? false,
        hasMajorAchievement: manual?.hasMajorAchievement ?? false,
        inPool: pool.inPool,
        poolReasonsJson: JSON.stringify(pool.reasons),
        dominatedByCount: tier?.dominatedByCount ?? 0,
        robustRank: tier ? tier.robustRank : null,
        isCritical: tier?.isCritical ?? false,
        achievements: manual?.achievements ?? null,
        reviewNote: manual?.reviewNote ?? null,
        finalRank: manual?.finalRank ?? null,
        selected: manual?.selected ?? false,
      };
    }),
  });

  const updated = await prisma.nationalScholarshipEvaluation.update({
    where: { id },
    data: {
      analyticB: analytic,
      empiricalB: empirical,
      effectiveB: effective,
      status: 'computed',
    },
  });

  await recordAuditLog({
    module: 'national_scholarship',
    action: 'compute',
    academicYearId: evaluation.academicYearId,
    actorId: actorId ?? null,
    targetType: 'NationalScholarshipEvaluation',
    targetId: id,
    after: {
      analyticB: analytic,
      empiricalB: empirical,
      effectiveB: effective,
      studentCount: students.length,
      poolCount: poolRows.filter((row) => row.inPool).length,
      criticalCount: tierRows.filter((row) => row.isCritical).length,
    },
  });

  return {
    evaluation: updated,
    analyticB: analytic,
    empiricalB: empirical,
    effectiveB: effective,
    candidateCount: students.length,
    poolCount: poolRows.filter((row) => row.inPool).length,
    criticalCount: tierRows.filter((row) => row.isCritical).length,
  };
}

// 人工标记（班级推荐 L / 重大成果 M / 成果清单）。改动后需重新计算才会生效。
export async function updateCandidateFlags(candidateId: number, data: {
  isClassRecommended?: boolean;
  hasMajorAchievement?: boolean;
  achievements?: string | null;
}, actorId?: number) {
  const candidate = await prisma.nationalScholarshipCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error('候选人不存在');

  const updated = await prisma.nationalScholarshipCandidate.update({
    where: { id: candidateId },
    data: {
      ...(data.isClassRecommended === undefined ? {} : { isClassRecommended: Boolean(data.isClassRecommended) }),
      ...(data.hasMajorAchievement === undefined ? {} : { hasMajorAchievement: Boolean(data.hasMajorAchievement) }),
      ...(data.achievements === undefined ? {} : { achievements: data.achievements?.trim() || null }),
    },
  });

  await recordAuditLog({
    module: 'national_scholarship',
    action: 'update_candidate_flags',
    actorId: actorId ?? null,
    targetType: 'NationalScholarshipCandidate',
    targetId: candidateId,
    before: {
      isClassRecommended: candidate.isClassRecommended,
      hasMajorAchievement: candidate.hasMajorAchievement,
      achievements: candidate.achievements,
    },
    after: {
      isClassRecommended: updated.isClassRecommended,
      hasMajorAchievement: updated.hasMajorAchievement,
      achievements: updated.achievements,
    },
  });

  return {
    candidate: updated,
    needsRecompute: true,
    message: '标记已更新，需点击"计算/重算"后重新入池与分层',
  };
}

// 临界层结构化评议留痕（算法四人工环节）：书面理由 / 最终次序 / 是否入选
export async function updateCandidateReview(candidateId: number, data: {
  reviewNote?: string | null;
  finalRank?: number | null;
  selected?: boolean;
}, actorId?: number) {
  const candidate = await prisma.nationalScholarshipCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error('候选人不存在');

  let finalRank: number | null | undefined;
  if (data.finalRank !== undefined) {
    const raw = data.finalRank as unknown;
    if (raw === null || raw === '') {
      finalRank = null;
    } else {
      const parsed = Math.floor(Number(raw));
      if (!Number.isFinite(parsed) || parsed < 1) throw new Error('最终次序必须为不小于 1 的整数');
      finalRank = parsed;
    }
  }

  const updated = await prisma.nationalScholarshipCandidate.update({
    where: { id: candidateId },
    data: {
      ...(data.reviewNote === undefined ? {} : { reviewNote: data.reviewNote?.trim() || null }),
      ...(finalRank === undefined ? {} : { finalRank }),
      ...(data.selected === undefined ? {} : { selected: Boolean(data.selected) }),
    },
  });

  await recordAuditLog({
    module: 'national_scholarship',
    action: 'update_candidate_review',
    actorId: actorId ?? null,
    targetType: 'NationalScholarshipCandidate',
    targetId: candidateId,
    before: { reviewNote: candidate.reviewNote, finalRank: candidate.finalRank, selected: candidate.selected },
    after: { reviewNote: updated.reviewNote, finalRank: updated.finalRank, selected: updated.selected },
  });

  return { candidate: updated };
}

function buildComparisonRows(candidates: MappedCandidate[]) {
  return sortCandidates(candidates.filter((candidate) => candidate.inPool)).map((candidate) => ({
    className: candidate.className,
    studentNo: candidate.studentNo,
    name: candidate.name,
    gpa: candidate.gpa,
    totalScore: candidate.totalScore,
    gRank: candidate.gRank,
    zRank: candidate.zRank,
    poolReasons: candidate.poolReasons,
    robustRank: candidate.robustRank,
    dominatedByCount: candidate.dominatedByCount,
    isCritical: candidate.isCritical,
    achievements: candidate.achievements,
    reviewNote: candidate.reviewNote,
    finalRank: candidate.finalRank,
    selected: candidate.selected,
  }));
}

// 表 A-1：候选人比较表行
export async function getComparisonTable(id: number) {
  const evaluation = await getEvaluation(id);
  return buildComparisonRows(evaluation.candidates);
}

// 导出候选人比较表（表 A-1）xlsx
export async function exportEvaluationTable(id: number): Promise<Buffer> {
  const evaluation = await getEvaluation(id);
  const rows = buildComparisonRows(evaluation.candidates);
  if (evaluation.status === 'draft' || !evaluation.candidates.length) {
    throw new Error('评比单元尚未计算，请先执行"计算/重算"后再导出');
  }

  const formatB = (value: number | null) => (value == null ? '—' : String(Math.round(value * 10000) / 10000));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('候选人比较表');

  sheet.addRow([`${evaluation.name}｜国家奖学金候选人比较表（表A-1）`]);
  sheet.addRow([
    `学年：${evaluation.academicYearName}`,
    `名额Q：${evaluation.quota}`,
    `入池比例p：${evaluation.poolRatio}`,
    `w：${evaluation.paramW}`,
    `d：${evaluation.paramD}`,
    `B解析：${formatB(evaluation.analyticB)}`,
    `B经验：${formatB(evaluation.empiricalB)}`,
    `B最终：${formatB(evaluation.effectiveB)}`,
  ]);
  const headerRow = sheet.addRow([
    '班级', '学号', '姓名', '总绩点g', '综测z', '绩点名次', '综测名次', '入池来源',
    '稳健层名次', '被几人占优', '是否临界层', '主要成果', '评议理由/临界比较记录', '最终次序', '是否入选',
  ]);
  headerRow.font = { bold: true };

  for (const row of rows) {
    sheet.addRow([
      row.className,
      row.studentNo,
      row.name,
      row.gpa,
      row.totalScore,
      row.gRank,
      row.zRank,
      row.poolReasons.join('、'),
      row.robustRank ?? '',
      row.dominatedByCount,
      row.isCritical ? '是' : '否',
      row.achievements || '',
      row.reviewNote || '',
      row.finalRank ?? '',
      row.selected ? '是' : '否',
    ]);
  }

  const widths = [16, 14, 10, 10, 10, 10, 10, 26, 12, 12, 12, 28, 28, 10, 10];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// 建议平行班：同年级下按"去掉尾部 N班 后的专业名"分组
export async function suggestClasses(academicYearId: number, gradeId: number) {
  void academicYearId; // 预留参数：班级不随学年变化，仅为接口对齐
  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
  if (!grade) throw new Error('年级不存在');

  const classes = await prisma.class.findMany({
    where: { gradeId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { students: true } } },
  });

  const groups = new Map<string, Array<{ id: number; name: string; studentCount: number }>>();
  for (const cls of classes) {
    const major = deriveMajorName(cls.name) || cls.name;
    if (!groups.has(major)) groups.set(major, []);
    groups.get(major)!.push({ id: cls.id, name: cls.name, studentCount: cls._count.students });
  }

  return Array.from(groups.entries()).map(([major, list]) => ({
    major,
    gradeName: grade.name,
    classes: list,
  }));
}
