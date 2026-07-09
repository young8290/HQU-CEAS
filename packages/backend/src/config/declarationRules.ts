export const SCHOLARSHIP_CHECKLIST_ITEMS = [
  { code: 'no_violation', label: '当学年无违法违规违纪行为' },
  { code: 'no_failed_course', label: '无不及格课程' },
  { code: 'no_academic_misconduct', label: '无学术不端行为' },
  { code: 'honest_and_healthy', label: '诚实守信，道德品质优良，身心健康' },
  { code: 'public_activity', label: '积极参加社会实践、志愿服务和公益活动' },
  { code: 'collective_honor', label: '关心集体，积极参加集体活动，维护集体荣誉' },
];

export const HONOR_CHECKLIST_ITEMS = [
  ...SCHOLARSHIP_CHECKLIST_ITEMS.filter((item) => item.code !== 'no_failed_course'),
  { code: 'student_willing', label: '学生本人具有申报意愿' },
  { code: 'cadre_info_valid', label: '干部任职信息真实有效' },
  { code: 'activity_info_valid', label: '组织活动或受表彰情况真实有效' },
];

export function checklistForDeclaration(type: string) {
  return type === 'honor' ? HONOR_CHECKLIST_ITEMS : SCHOLARSHIP_CHECKLIST_ITEMS;
}

export function requireAgreementSignatureFileId(value: unknown) {
  const signatureFileId = Number(value);
  if (!Number.isInteger(signatureFileId) || signatureFileId <= 0) {
    throw new Error('班长确认协议签名未完成');
  }
  return signatureFileId;
}
