import { type ScoreCategory, calculateSportsTotal, calculateTotal } from '../../modules/evaluation/rules/scoreRules.js';

export type GradeStage = 'freshman' | 'sophomore' | 'junior';

export interface SportsBaseInput {
  gradeStage: GradeStage;
  physicalTestScore: number;
  peCourseScore?: number | null;
}

export function calculateAcademicScore(gpa: number): number {
  return Math.round((gpa + 2.5) * 8 * 100) / 100;
}

export function calculateSportsBaseScore(input: SportsBaseInput): number {
  if (Number.isNaN(input.physicalTestScore)) {
    throw new Error('体测成绩必须为有效数字');
  }

  if (input.gradeStage === 'junior') {
    return Math.round(input.physicalTestScore * 100) / 100;
  }

  if (input.peCourseScore === undefined || input.peCourseScore === null || Number.isNaN(input.peCourseScore)) {
    throw new Error('大一和大二学生必须提供体育课成绩');
  }

  return Math.round((input.physicalTestScore * 0.7 + input.peCourseScore * 0.3) * 100) / 100;
}

export function recalculateDerived(scores: Record<string, number>): Record<string, number> {
  const result = { ...scores };
  result.sports_total = calculateSportsTotal(result.sports_base || 0, result.sports_reward || 0);
  result.total = calculateTotal(result);
  return result;
}
