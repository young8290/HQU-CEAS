/**
 * 从班级名称派生专业名：去掉结尾的「数字+班」后缀并去除首尾空白。
 *
 * 例：'软件工程2班' -> '软件工程'；'计算机科学与技术12班' -> '计算机科学与技术'。
 * 若名称不含「数字+班」后缀（如 '智能班'），仅做 trim 原样返回；
 * 若整个名称就是「数字+班」（如 '3班'），返回空字符串——调用方
 * （如 nationalScholarshipService.suggestClasses）自行决定是否回退为原班级名。
 *
 * @param className 班级名称（如 '软件工程2班'）
 * @returns 去掉班号后缀的专业名
 */
export function deriveMajorName(className: string): string {
  return className.replace(/\d+班$/, '').trim();
}
