/**
 * 按分值从高到低生成逐班名次表（1 为最高名次）。
 *
 * 与原 awardService.rankStudents / honorService.rank / exportService.rankByScore
 * 逐字等价的公共实现：
 * - 不修改入参数组（先浅拷贝再排序）；
 * - 不处理并列：分值相同的学生按输入数组顺序（稳定排序）获得相邻的不同名次。
 *
 * @param items 每个学生的 id 与用于排名的分值
 * @returns studentId -> 名次（从 1 开始）的映射
 */
export function rankByScoreDesc(items: Array<{ studentId: number; value: number }>): Record<number, number> {
  return [...items]
    .sort((a, b) => b.value - a.value)
    .reduce<Record<number, number>>((acc, item, index) => {
      acc[item.studentId] = index + 1;
      return acc;
    }, {});
}
