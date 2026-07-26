// 国家奖学金评定算法（《关于国家奖学金评定办法的完善方案》附录 A）
// 本模块只包含无 I/O 纯函数：候选池（算法一）、绩点比较上界 B（算法二）、
// 稳健占优分层（算法三）、临界层名额校验（算法四）。

export interface NsStudentInput {
  studentId: number;
  classId: number;
  g: number; // 总绩点（academic/8 − 2.5）
  z: number; // 综测总分
  isClassRecommended: boolean; // L_i 班级推荐
  hasMajorAchievement: boolean; // M_i 重大成果
}

export interface NsPoolRow {
  studentId: number;
  gRank: number;
  zRank: number;
  topByG: boolean;
  topByZ: boolean;
  inPool: boolean;
  reasons: string[];
}

export interface NsTierRow {
  studentId: number;
  dominatedByCount: number;
  dominatesCount: number;
  robustRank: number;
  isCritical: boolean;
}

// 默认经验分位点 q = 0.1, 0.2, ..., 0.9
export const DEFAULT_QUANTILES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const;

// 专业名次（RANK.EQ 并列同名次）：rank(v) = 1 + |{x : x > v}|，值越大越优，1 为最好。
export function competitionRank(value: number, values: number[]): number {
  let greater = 0;
  for (const x of values) {
    if (x > value) greater += 1;
  }
  return 1 + greater;
}

export function professionalRanks(values: number[]): number[] {
  return values.map((value) => competitionRank(value, values));
}

// 算法一：候选池构建。
// k = ceil(N*p)；J_i = (gRank_i <= k)，K_i = (zRank_i <= k)；inPool = L ∨ J ∨ K ∨ M。
export function computeCandidatePool(students: NsStudentInput[], poolRatio: number): NsPoolRow[] {
  const n = students.length;
  const k = Math.ceil(n * poolRatio);
  const percent = Math.round(poolRatio * 100);
  const gRanks = professionalRanks(students.map((s) => s.g));
  const zRanks = professionalRanks(students.map((s) => s.z));

  return students.map((student, index) => {
    const gRank = gRanks[index];
    const zRank = zRanks[index];
    const topByG = gRank <= k;
    const topByZ = zRank <= k;
    const reasons: string[] = [];
    if (student.isClassRecommended) reasons.push('班级推荐');
    if (topByG) reasons.push(`专业绩点前${percent}%`);
    if (topByZ) reasons.push(`专业综测前${percent}%`);
    if (student.hasMajorAchievement) reasons.push('重大成果');
    return {
      studentId: student.studentId,
      gRank,
      zRank,
      topByG,
      topByZ,
      inPool: reasons.length > 0,
      reasons,
    };
  });
}

// 算法二：解析上界 B_解析 = w · d。
export function analyticB(w: number, d: number): number {
  return w * d;
}

// 班内百分位曲线上取 ghat(q)：数据点 (q_r, g_r)，q_r = (r-0.5)/n（r 从 1，g 按降序），
// 相邻点之间线性插值，越界处取端点值。
function interpolateAtQuantile(sortedDescG: number[], q: number): number {
  const n = sortedDescG.length;
  const quantileOf = (index: number) => (index + 0.5) / n; // index 从 0
  if (q <= quantileOf(0)) return sortedDescG[0];
  if (q >= quantileOf(n - 1)) return sortedDescG[n - 1];
  for (let i = 0; i < n - 1; i += 1) {
    const left = quantileOf(i);
    const right = quantileOf(i + 1);
    if (q >= left && q <= right) {
      const t = (q - left) / (right - left);
      return sortedDescG[i] + t * (sortedDescG[i + 1] - sortedDescG[i]);
    }
  }
  return sortedDescG[n - 1];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// 算法二：经验上界 B_经验。
// 入参为每班按 g 降序的数组；对每一对班、每个标准分位点 q 取 |ghat_A(q) − ghat_B(q)|，
// B_经验 = 所有样本的中位数。班数 < 2 或无数据 → null。
export function empiricalB(classSortedG: number[][], quantiles?: number[]): number | null {
  const points = quantiles && quantiles.length ? quantiles : [...DEFAULT_QUANTILES];
  const classes = classSortedG
    .filter((list) => list.length > 0)
    .map((list) => [...list].sort((a, b) => b - a));
  if (classes.length < 2) return null;

  const samples: number[] = [];
  for (let i = 0; i < classes.length; i += 1) {
    for (let j = i + 1; j < classes.length; j += 1) {
      for (const q of points) {
        samples.push(Math.abs(interpolateAtQuantile(classes[i], q) - interpolateAtQuantile(classes[j], q)));
      }
    }
  }
  if (!samples.length) return null;
  return median(samples);
}

// 算法二：B = 经验值存在时取 min(B_解析, B_经验)，否则取 B_解析。
export function resolveB(analytic: number, empirical: number | null): number {
  return empirical != null ? Math.min(analytic, empirical) : analytic;
}

// 算法三：稳健占优分层。i ≻ j ⟺ (g_i − g_j > B) ∧ (z_i ≥ z_j)。
// dominatedByCount_i = |{j : g_j − g_i > B ∧ z_j ≥ z_i}|；robustRank = dominatedByCount + 1；
// isCritical ⟺ dominatedByCount == 0 ∧ dominatesCount == 0（与所有人互不占优）。
export function computeDominanceTiering(students: NsStudentInput[], B: number): NsTierRow[] {
  return students.map((student, index) => {
    let dominatedByCount = 0;
    let dominatesCount = 0;
    students.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      if (other.g - student.g > B && other.z >= student.z) dominatedByCount += 1;
      if (student.g - other.g > B && student.z >= other.z) dominatesCount += 1;
    });
    return {
      studentId: student.studentId,
      dominatedByCount,
      dominatesCount,
      robustRank: dominatedByCount + 1,
      isCritical: dominatedByCount === 0 && dominatesCount === 0,
    };
  });
}

// 算法四：临界层剩余名额 = max(0, Q − 稳健层已入选人数)。不设兑换率，凭书面理由取舍。
export function remainingCriticalQuota(quota: number, robustSelectedCount: number): number {
  return Math.max(0, quota - robustSelectedCount);
}
