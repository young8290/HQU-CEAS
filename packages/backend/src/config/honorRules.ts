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
  physicalTestScore: number;
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
      check('physical_test', '体测成绩', input.physicalTestScore >= 80, input.physicalTestScore, '不低于 80 分'),
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
