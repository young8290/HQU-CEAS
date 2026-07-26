import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticB,
  competitionRank,
  computeCandidatePool,
  computeDominanceTiering,
  empiricalB,
  professionalRanks,
  remainingCriticalQuota,
  resolveB,
  type NsStudentInput,
} from './nationalScholarshipRules.js';

function studentInput(partial: Partial<NsStudentInput> & { studentId: number }): NsStudentInput {
  return {
    classId: 1,
    g: 0,
    z: 0,
    isClassRecommended: false,
    hasMajorAchievement: false,
    ...partial,
  };
}

test('competitionRank 采用 RANK.EQ 并列同名次', () => {
  assert.deepEqual(professionalRanks([5, 5, 4]), [1, 1, 3]);
  assert.equal(competitionRank(5, [5, 5, 4]), 1);
  assert.equal(competitionRank(4, [5, 5, 4]), 3);
});

test('computeCandidatePool 按 L/J/K/M 四条通道入池并给出中文来源', () => {
  // N=5、p=0.2 → k=ceil(1)=1：仅绩点第 1、综测第 1 触发 J/K
  const students: NsStudentInput[] = [
    studentInput({ studentId: 1, g: 4.8, z: 80 }), // J：绩点第 1
    studentInput({ studentId: 2, g: 4.0, z: 95 }), // K：综测第 1
    studentInput({ studentId: 3, g: 3.0, z: 70, isClassRecommended: true }), // L
    studentInput({ studentId: 4, g: 2.5, z: 60, hasMajorAchievement: true }), // M
    studentInput({ studentId: 5, g: 3.5, z: 75 }), // 不入池
  ];
  const rows = computeCandidatePool(students, 0.2);

  assert.deepEqual(rows[0].reasons, ['专业绩点前20%']);
  assert.equal(rows[0].topByG, true);
  assert.equal(rows[0].gRank, 1);
  assert.deepEqual(rows[1].reasons, ['专业综测前20%']);
  assert.equal(rows[1].zRank, 1);
  assert.deepEqual(rows[2].reasons, ['班级推荐']);
  assert.deepEqual(rows[3].reasons, ['重大成果']);
  assert.deepEqual(rows[4].reasons, []);
  assert.deepEqual(rows.map((row) => row.inPool), [true, true, true, true, false]);
  assert.equal(rows[4].gRank, 3);
  assert.equal(rows[4].zRank, 3);
});

test('analyticB 为 PDF 算例 w·d：analyticB(0.5, 1.0) === 0.5', () => {
  assert.equal(analyticB(0.5, 1.0), 0.5);
});

// PDF 算例 fixture：构造两班，使九个标准百分位的 |Δ| 恰为
// {0.06, 0.11, 0.08, 0.14, 0.09, 0.12, 0.07, 0.10, 0.13}（中位数 0.10）。
// 两班各 10 人：q_r=(r-0.5)/10，标准分位点 0.1k 恰在相邻数据点正中，
// 故 ghat(0.1k) = (g_k+g_{k+1})/2，|Δ_k| = (e_k+e_{k+1})/2，e = A、B 班同名次差。
const CLASS_B_G = [4.5, 4.2, 3.9, 3.6, 3.3, 3.0, 2.7, 2.4, 2.1, 1.8];
const RANK_GAPS = [0.06, 0.06, 0.08, 0.08, 0.1, 0.1, 0.12, 0.12, 0.14, 0.14];
const CLASS_A_G = CLASS_B_G.map((value, index) => value + RANK_GAPS[index]);

test('empiricalB 对 PDF 算例返回九个百分位差的中位数 ≈ 0.10', () => {
  const result = empiricalB([CLASS_A_G, CLASS_B_G]);
  assert.ok(result !== null);
  assert.ok(Math.abs(result - 0.1) < 1e-9, `期望 ≈0.10，实际 ${result}`);

  // 抽查单个分位点的线性插值（|Δ| 多重集为 {0.06,...,0.14}）
  const at10 = empiricalB([CLASS_A_G, CLASS_B_G], [0.1]);
  const at50 = empiricalB([CLASS_A_G, CLASS_B_G], [0.5]);
  const at90 = empiricalB([CLASS_A_G, CLASS_B_G], [0.9]);
  assert.ok(at10 !== null && Math.abs(at10 - 0.06) < 1e-9);
  assert.ok(at50 !== null && Math.abs(at50 - 0.1) < 1e-9);
  assert.ok(at90 !== null && Math.abs(at90 - 0.14) < 1e-9);
});

test('empiricalB 班数不足或无数据时返回 null', () => {
  assert.equal(empiricalB([CLASS_A_G]), null);
  assert.equal(empiricalB([[], []]), null);
  assert.equal(empiricalB([]), null);
  assert.equal(empiricalB([CLASS_A_G, []]), null);
});

test('resolveB 有经验值取 min，无经验值取解析值', () => {
  assert.equal(resolveB(0.5, 0.1), 0.1);
  assert.equal(resolveB(0.08, 0.1), 0.08);
  assert.equal(resolveB(0.5, null), 0.5);
});

test('computeDominanceTiering 依 (g 差 > B) ∧ (z 不低) 判占优并标记临界层', () => {
  const B = 0.5;
  const students: NsStudentInput[] = [
    studentInput({ studentId: 1, g: 4.0, z: 90 }), // 占优 2 号（差 0.6 > B 且 z 90 ≥ 85）
    studentInput({ studentId: 2, g: 3.4, z: 85 }),
    studentInput({ studentId: 3, g: 3.6, z: 99 }), // 与所有人互不占优 → 临界层
  ];
  const rows = computeDominanceTiering(students, B);

  assert.deepEqual(rows[0], { studentId: 1, dominatedByCount: 0, dominatesCount: 1, robustRank: 1, isCritical: false });
  assert.deepEqual(rows[1], { studentId: 2, dominatedByCount: 1, dominatesCount: 0, robustRank: 2, isCritical: false });
  assert.deepEqual(rows[2], { studentId: 3, dominatedByCount: 0, dominatesCount: 0, robustRank: 1, isCritical: true });
});

test('computeDominanceTiering 反例：g 差不超过 B 或 z 更低都不构成占优', () => {
  // g 差 0.7 > B 但 z 更低 → 不占优；双方互不占优 → 均为临界层
  const zLower = computeDominanceTiering([
    studentInput({ studentId: 1, g: 4.0, z: 90 }),
    studentInput({ studentId: 2, g: 3.3, z: 95 }),
  ], 0.5);
  assert.equal(zLower[0].dominatesCount, 0);
  assert.equal(zLower[1].dominatedByCount, 0);
  assert.deepEqual(zLower.map((row) => row.isCritical), [true, true]);

  // g 差 0.4 ≤ B → 不占优
  const gapTooSmall = computeDominanceTiering([
    studentInput({ studentId: 1, g: 4.0, z: 90 }),
    studentInput({ studentId: 2, g: 3.6, z: 60 }),
  ], 0.5);
  assert.equal(gapTooSmall[0].dominatesCount, 0);
  assert.equal(gapTooSmall[1].dominatedByCount, 0);
});

test('remainingCriticalQuota 为 max(0, Q − 稳健层已入选人数)', () => {
  assert.equal(remainingCriticalQuota(3, 1), 2);
  assert.equal(remainingCriticalQuota(1, 2), 0);
  assert.equal(remainingCriticalQuota(0, 0), 0);
});
