// Score validation rules matching the backend
// editableBy: 'all' = everyone can edit, 'admin' = admin only, 'none' = computed/readonly
export const SCORE_RULES: Record<string, { label: string; max: number | null; editable: boolean; editableBy: 'all' | 'admin' | 'none'; step: number }> = {
  moral: { label: '德育测评', max: 100, editable: true, editableBy: 'all', step: 1 },
  academic: { label: '学业学术素质', max: 60, editable: true, editableBy: 'admin', step: 0.01 },
  innovation: { label: '创新与实践能力', max: 13, editable: true, editableBy: 'all', step: 0.1 },
  physical_test: { label: '体测成绩', max: 100, editable: true, editableBy: 'admin', step: 0.01 },
  pe_course: { label: '体育课成绩', max: 100, editable: true, editableBy: 'admin', step: 0.01 },
  sports_base: { label: '体育基础分', max: null, editable: true, editableBy: 'admin', step: 0.01 },
  sports_reward: { label: '体育奖励分', max: 3, editable: true, editableBy: 'all', step: 0.01 },
  sports_total: { label: '体育总分', max: 7, editable: false, editableBy: 'none', step: 0.01 },
  aesthetics: { label: '美育', max: 6, editable: true, editableBy: 'all', step: 0.25 },
  labor: { label: '劳动教育', max: 4, editable: true, editableBy: 'all', step: 1 },
  public_service: { label: '公益服务与社会工作', max: 10, editable: true, editableBy: 'all', step: 0.1 },
  community: { label: '社区表现分', max: 100, editable: true, editableBy: 'admin', step: 0.01 },
  bonus: { label: '附加分', max: 5, editable: true, editableBy: 'all', step: 0.5 },
  total: { label: '总分', max: null, editable: false, editableBy: 'none', step: 0.01 },
};

// Check if a category is editable for a given role
export function isCategoryEditable(category: string, role: string): boolean {
  const rule = SCORE_RULES[category];
  if (!rule) return false;
  if (rule.editableBy === 'none') return false;
  if (rule.editableBy === 'admin') return role === 'admin';
  return true; // 'all'
}

export const SCORE_CATEGORIES_ORDER = [
  'moral', 'academic', 'innovation', 'physical_test', 'pe_course', 'sports_base', 'sports_reward',
  'sports_total', 'aesthetics', 'labor', 'public_service', 'community', 'bonus', 'total',
];

export function validateScore(category: string, value: number): string | null {
  const rule = SCORE_RULES[category];
  if (!rule) return '未知分数类别';
  if (isNaN(value)) return `${rule.label}必须为有效数字`;
  if (value < 0) return `${rule.label}不能为负数`;
  if (rule.max !== null && value > rule.max) return `${rule.label}不能超过${rule.max}`;
  const step = rule.step;
  if (step && step > 0) {
    const remainder = Math.round((value % step) * 10000) / 10000;
    if (remainder !== 0 && Math.abs(remainder - step) > 0.0001) {
      return `${rule.label}最小单位为${step}`;
    }
  }
  return null;
}
