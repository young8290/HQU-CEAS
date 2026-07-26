import { rankLimitForHonor } from './honorRulesInternal.js';

export type HonorType =
  | 'excellent_student'
  | 'excellent_cadre';

export interface HonorCandidateInput {
  studentId: number;
  classSize: number;
  isComputerCategory: boolean;
  academicRank: number;
  totalRank: number;
  moralScore: number;
  sportsBaseScore: number;
  communityScore: number;
  tags: string[];
  hasClassHonorQuotaBonus?: boolean;
}

export interface HonorCandidateEvaluation {
  eligible: boolean;
  conditionResults: Array<{
    code: string;
    label: string;
    passed: boolean;
    actual?: number | string;
    required: string;
  }>;
  materialRequirements: string[];
  blockedReasons: string[];
}

function check(code: string, label: string, passed: boolean, actual: number | string, required: string) {
  return { code, label, passed, actual, required };
}

/**
 * 按荣誉类型对单个学生逐条执行硬性条件检查（依据《华侨大学学生荣誉
 * 称号授予办法》，见 docs/reference/附件4）。
 *
 * 共同条件：德育分、社区表现分需达到各自分数线；
 * 优秀学生（excellent_student）：另要求持有奖学金标签、综测排名比例线
 * 与体育基础分线；
 * 优秀学生干部（excellent_cadre）：另要求综测排名比例线（非计算机类再
 * 加学业排名比例线），并附申报材料要求（materialRequirements）。
 * 计算机类与非计算机类班级使用不同的排名比例，具体数值以实现为准。
 *
 * @param input 学生的分数、排名、班级规模与标签信息
 * @param honorType 荣誉类型（优秀学生/优秀学生干部）
 * @returns 是否具备资格、逐条检查结果、材料要求与未通过原因列表
 */
export function evaluateHonorCandidate(
  input: HonorCandidateInput,
  honorType: HonorType,
): HonorCandidateEvaluation {
  const conditionResults = [
    check('moral_score', '德育分', input.moralScore >= 90, input.moralScore, '不低于 90 分'),
    check('community_score', '社区表现分', input.communityScore >= 98, input.communityScore, '不低于 98 分'),
  ];
  const materialRequirements: string[] = [];

  if (honorType === 'excellent_student') {
    const totalLimit = rankLimitForHonor(input.classSize, input.isComputerCategory ? 0.3 : 0.1);
    conditionResults.push(
      check('scholarship_tag', '奖学金标签', input.tags.some((tag) => tag.includes('scholarship')), input.tags.join('、') || '无', '获得指定奖学金'),
      check('total_rank', '综测排名', input.totalRank <= totalLimit, input.totalRank, `班级前 ${totalLimit} 名`),
      check('sports_base', '体育基础分', input.sportsBaseScore >= 80, input.sportsBaseScore, '不低于 80 分'),
    );
  }

  if (honorType === 'excellent_cadre') {
    const totalLimit = rankLimitForHonor(input.classSize, input.isComputerCategory ? 0.5 : 0.3);
    conditionResults.push(
      check('total_rank', '综测排名', input.totalRank <= totalLimit, input.totalRank, `班级前 ${totalLimit} 名`),
    );
    if (!input.isComputerCategory) {
      const academicLimit = rankLimitForHonor(input.classSize, 0.3);
      conditionResults.push(check('academic_rank', '学习成绩排名', input.academicRank <= academicLimit, input.academicRank, `班级前 ${academicLimit} 名`));
    }
    materialRequirements.push('学生本人申报意愿', '干部任职说明', '任期满一年说明', '考核良好及以上说明', '活动组织或表彰说明');
  }

  const blockedReasons = conditionResults
    .filter((item) => !item.passed)
    .map((item) => `${item.label}未通过，要求${item.required}，当前为${item.actual}`);

  return {
    eligible: blockedReasons.length === 0,
    conditionResults,
    materialRequirements,
    blockedReasons,
  };
}
