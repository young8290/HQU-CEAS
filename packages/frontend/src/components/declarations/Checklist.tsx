const AWARD_ITEMS = [
  ['no_violation', '当学年无违法违规违纪行为'],
  ['no_failed_course', '无不及格课程'],
  ['no_academic_misconduct', '无学术不端行为'],
  ['honest_and_healthy', '诚实守信，道德品质优良，身心健康'],
  ['public_activity', '积极参加社会实践、志愿服务和公益活动'],
  ['collective_honor', '关心集体，积极参加集体活动，维护集体荣誉'],
];

const HONOR_ITEMS = [
  ...AWARD_ITEMS.filter(([code]) => code !== 'no_failed_course'),
  ['student_willing', '学生本人具有申报意愿'],
  ['cadre_info_valid', '干部任职信息真实有效'],
  ['activity_info_valid', '组织活动或受表彰情况真实有效'],
];

export function checklistItems(type: 'award' | 'honor') {
  return type === 'honor' ? HONOR_ITEMS : AWARD_ITEMS;
}

export default function Checklist({
  type,
  value,
  onChange,
}: {
  type: 'award' | 'honor';
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {checklistItems(type).map(([code, label]) => (
        <label key={code} className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          <input
            type="checkbox"
            checked={!!value[code]}
            onChange={(event) => onChange({ ...value, [code]: event.target.checked })}
            className="mt-1 h-4 w-4 accent-primary-600"
          />
          <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
        </label>
      ))}
    </div>
  );
}
