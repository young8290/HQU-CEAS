// Score category rules: limits and editability
// editableBy: 'all' = everyone can edit, 'admin' = admin only, 'none' = computed/readonly
export const SCORE_CATEGORIES = {
  moral: { label: '德育测评', maxValue: 100, editable: true, editableBy: 'all' as const, step: 1 },
  academic: { label: '学业学术素质', maxValue: 60, editable: true, editableBy: 'admin' as const, step: 0.01 },
  innovation: { label: '创新与实践能力', maxValue: 13, editable: true, editableBy: 'all' as const, step: 0.1 },
  physical_test: { label: '体测成绩', maxValue: 100, editable: false, editableBy: 'none' as const, step: 0.01 },
  pe_course: { label: '体育课成绩', maxValue: 100, editable: false, editableBy: 'none' as const, step: 0.01 },
  sports_base: { label: '体育基础分', maxValue: null, editable: true, editableBy: 'admin' as const, step: 0.01 },
  sports_reward: { label: '体育奖励分', maxValue: 3, editable: true, editableBy: 'all' as const, step: 0.01 },
  sports_total: { label: '体育总分', maxValue: 7, editable: false, editableBy: 'none' as const, step: 0.01 },
  aesthetics: { label: '美育', maxValue: 6, editable: true, editableBy: 'all' as const, step: 0.25 },
  labor: { label: '劳动教育', maxValue: 4, editable: true, editableBy: 'all' as const, step: 1 },
  public_service: { label: '公益服务与社会工作', maxValue: 10, editable: true, editableBy: 'all' as const, step: 0.1 },
  community: { label: '社区表现分', maxValue: 100, editable: true, editableBy: 'admin' as const, step: 0.01 },
  bonus: { label: '附加分', maxValue: 5, editable: true, editableBy: 'all' as const, step: 0.5 },
  total: { label: '总分', maxValue: null, editable: false, editableBy: 'none' as const, step: 0.01 },
} as const;

export type ScoreCategory = keyof typeof SCORE_CATEGORIES;

export const EVALUATION_SCORE_CATEGORIES_ORDER = [
  'moral',
  'academic',
  'innovation',
  'sports_base',
  'sports_reward',
  'sports_total',
  'aesthetics',
  'labor',
  'public_service',
  'bonus',
  'total',
] as const satisfies ReadonlyArray<ScoreCategory>;

export const DECLARATION_SCORE_CATEGORIES_ORDER = [
  'academic',
  'sports_base',
  'community',
  'total',
] as const satisfies ReadonlyArray<ScoreCategory>;

export const PERSONAL_FORM_DETAIL_CATEGORIES = [
  'moral',
  'innovation',
  'sports_reward',
  'aesthetics',
  'labor',
  'public_service',
  'bonus',
] as const satisfies ReadonlyArray<ScoreCategory>;

export const EDITABLE_CATEGORIES: ScoreCategory[] = Object.entries(SCORE_CATEGORIES)
  .filter(([, v]) => v.editable)
  .map(([k]) => k as ScoreCategory);

export const ALL_CATEGORIES: ScoreCategory[] = Object.keys(SCORE_CATEGORIES) as ScoreCategory[];
export const SCORE_CATEGORIES_ORDER: ScoreCategory[] = [...EVALUATION_SCORE_CATEGORIES_ORDER];

/**
 * 校验某分类的单项分数：必须是有效数字、非负、不超过该分类上限
 * （maxValue 为 null 表示不设上限）、且为该分类最小步长（step）的整数倍。
 *
 * @param category 分数分类（SCORE_CATEGORIES 的键）
 * @param value 待校验的分数
 * @returns 不合法时返回中文错误信息，合法时返回 null
 */
export function validateScoreValue(category: ScoreCategory, value: number): string | null {
  if (isNaN(value)) return `${SCORE_CATEGORIES[category].label}必须为有效数字`;
  if (value < 0) return `${SCORE_CATEGORIES[category].label}不能为负数`;
  const max = SCORE_CATEGORIES[category].maxValue;
  if (max !== null && value > max) {
    return `${SCORE_CATEGORIES[category].label}不能超过${max}`;
  }
  const step = SCORE_CATEGORIES[category].step;
  if (step && step > 0) {
    const remainder = Math.round((value % step) * 10000) / 10000;
    if (remainder !== 0 && Math.abs(remainder - step) > 0.0001) {
      return `${SCORE_CATEGORIES[category].label}最小单位为${step}`;
    }
  }
  return null;
}

/**
 * 计算体育总分 = 体育基础分 + 体育奖励分（四舍五入保留两位小数）。
 *
 * @param sportsBase 体育基础分（sports_base）
 * @param sportsReward 体育奖励分（sports_reward）
 * @returns 体育总分（sports_total）
 */
export function calculateSportsTotal(sportsBase: number, sportsReward: number): number {
  return Math.round((sportsBase + sportsReward) * 100) / 100;
}

/**
 * 计算综合测评总分（四舍五入保留两位小数）。
 *
 * @param scores 分类 -> 分数 的映射（缺失分类按 0 计）
 * @returns 综测总分（total）
 */
export function calculateTotal(scores: Record<string, number>): number {
  // 总分 = 学业学术素质 + 创新与实践能力 + 体育总分 + 美育 + 劳动教育
  //        + 公益服务与社会工作 + 附加分（德育测评、社区表现分等不计入）
  const total = (scores.academic || 0)
    + (scores.innovation || 0)
    + (scores.sports_total || 0)
    + (scores.aesthetics || 0)
    + (scores.labor || 0)
    + (scores.public_service || 0)
    + (scores.bonus || 0)
    ;
  return Math.round(total * 100) / 100;
}
