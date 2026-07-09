export function rankLimitForHonor(classSize: number, percentage: number) {
  return Math.max(1, Math.ceil(classSize * percentage));
}
