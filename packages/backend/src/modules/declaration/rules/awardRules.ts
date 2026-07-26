export type AwardType = 'school_scholarship' | 'college_scholarship';

export interface AwardCandidateInput {
  studentId: number;
  classSize: number;
  isComputerCategory: boolean;
  academicRank: number;
  totalRank: number;
  moralScore: number;
  sportsBaseScore: number;
  communityScore: number;
  tags: string[];
}

export interface RuleCheckResult {
  code: string;
  label: string;
  passed: boolean;
  actual?: number | string;
  required: string;
}

export interface AwardCandidateEvaluation {
  eligible: boolean;
  conditionResults: RuleCheckResult[];
  blockedReasons: string[];
}

export interface AwardAllocationInput {
  quotaCount: number;
  availableAmount: number;
  firstCount: number;
  secondCount: number;
  thirdCount: number;
}

export const COLLEGE_AWARD_AMOUNTS = {
  first: 1000,
  second: 800,
  third: 600,
} as const;

export const ALLOWED_EXTERNAL_AWARD_TYPES = [
  'national_scholarship',
  'national_inspirational_scholarship',
  'school_scholarship',
] as const;

export const AWARD_SELECTION_ORDER = [
  'national_scholarship',
  'national_inspirational_scholarship',
  'school_scholarship',
  'college_scholarship',
  'honor_declaration',
] as const;

export const COLLEGE_AWARD_EXCLUSION_TAGS = [
  'national_scholarship',
  'national_inspirational_scholarship',
  'school_scholarship',
];

/**
 * 校验外部奖项类型是否在允许导入的白名单（ALLOWED_EXTERNAL_AWARD_TYPES）内。
 *
 * @param awardType 外部奖项类型标识
 * @throws 类型不在白名单内时抛出中文错误
 */
export function assertExternalAwardType(awardType: string) {
  if (!ALLOWED_EXTERNAL_AWARD_TYPES.includes(awardType as any)) {
    throw new Error('外部奖项仅支持导入国家奖学金、国家励志奖学金和校级奖学金');
  }
}

function rankLimit(classSize: number, percentage: number) {
  return Math.max(1, Math.ceil(classSize * percentage));
}

function makeCheck(
  code: string,
  label: string,
  passed: boolean,
  actual: number | string,
  required: string,
): RuleCheckResult {
  return { code, label, passed, actual, required };
}

/**
 * 按奖学金类型对单个学生逐条执行硬性条件检查（依据《华侨大学本科学生
 * 奖学金实施办法》，见 docs/reference/附件3）。
 *
 * 共同条件：德育分、体育基础分、社区表现分需达到各自分数线；
 * 校奖（school_scholarship）：另检查学业排名与综测排名的班级比例线；
 * 院奖（college_scholarship）：另检查学业排名比例线（计算机类再加综测
 * 排名比例线），且不得已获国奖/国励志/校奖（互斥标签）。
 * 计算机类与非计算机类班级使用不同的排名比例，具体数值以实现为准。
 *
 * @param input 学生的分数、排名、班级规模与标签信息
 * @param awardType 奖学金类型（校奖/院奖）
 * @returns 是否具备资格、逐条检查结果以及未通过原因列表
 */
export function evaluateAwardCandidate(
  input: AwardCandidateInput,
  awardType: AwardType,
): AwardCandidateEvaluation {
  const checks: RuleCheckResult[] = [
    makeCheck('moral_score', '德育分', input.moralScore >= 90, input.moralScore, '不低于 90 分'),
    makeCheck('sports_base', '体育基础分', input.sportsBaseScore >= 60, input.sportsBaseScore, '不低于 60 分'),
    makeCheck('community_score', '社区表现分', input.communityScore >= 98, input.communityScore, '不低于 98 分'),
  ];

  if (awardType === 'school_scholarship') {
    const academicLimit = input.isComputerCategory
      ? rankLimit(input.classSize, 0.45)
      : rankLimit(input.classSize, 0.25);
    const totalLimit = input.isComputerCategory
      ? rankLimit(input.classSize, 0.5)
      : rankLimit(input.classSize, 0.3);

    checks.push(
      makeCheck('academic_rank', '学习成绩排名', input.academicRank <= academicLimit, input.academicRank, `班级前 ${academicLimit} 名`),
      makeCheck('total_rank', '综测排名', input.totalRank <= totalLimit, input.totalRank, `班级前 ${totalLimit} 名`),
    );
  } else {
    const academicLimit = input.isComputerCategory
      ? rankLimit(input.classSize, 0.25)
      : rankLimit(input.classSize, 0.6);

    checks.push(
      makeCheck('academic_rank', '学习成绩排名', input.academicRank <= academicLimit, input.academicRank, `班级前 ${academicLimit} 名`),
    );

    if (input.isComputerCategory) {
      const totalLimit = rankLimit(input.classSize, 0.3);
      checks.push(makeCheck('total_rank', '综测排名', input.totalRank <= totalLimit, input.totalRank, `班级前 ${totalLimit} 名`));
    }

    const exclusionTags = input.tags.filter((tag) => COLLEGE_AWARD_EXCLUSION_TAGS.includes(tag));
    checks.push(makeCheck(
      'mutual_exclusion',
      '奖学金互斥',
      exclusionTags.length === 0,
      exclusionTags.join('、') || '无',
      '未获得互斥奖项',
    ));
  }

  const blockedReasons = checks
    .filter((check) => !check.passed)
    .map((check) => `${check.label}未通过，要求${check.required}，当前为${check.actual}`);

  return {
    eligible: blockedReasons.length === 0,
    conditionResults: checks,
    blockedReasons,
  };
}

/**
 * 校验院奖名额分配方案：已选人数不超过名额、总金额不超过可支配金额，
 * 且一等奖人数 ≤ 二等奖人数 ≤ 三等奖人数（金额按 COLLEGE_AWARD_AMOUNTS 计）。
 *
 * @param input 名额数、可支配金额与一/二/三等奖人数
 * @returns valid 是否通过，issues 为所有未满足项的中文说明
 */
export function validateAwardAllocation(input: AwardAllocationInput) {
  const totalCount = input.firstCount + input.secondCount + input.thirdCount;
  const totalAmount = input.firstCount * COLLEGE_AWARD_AMOUNTS.first
    + input.secondCount * COLLEGE_AWARD_AMOUNTS.second
    + input.thirdCount * COLLEGE_AWARD_AMOUNTS.third;
  const issues: string[] = [];

  if (totalCount > input.quotaCount) {
    issues.push(`已选人数 ${totalCount} 超过名额 ${input.quotaCount}`);
  }
  if (totalAmount > input.availableAmount) {
    issues.push(`总金额 ${totalAmount} 超过可支配金额 ${input.availableAmount}`);
  }
  if (input.firstCount > input.secondCount) {
    issues.push('一等奖人数必须小于等于二等奖人数');
  }
  if (input.secondCount > input.thirdCount) {
    issues.push('二等奖人数必须小于等于三等奖人数');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
