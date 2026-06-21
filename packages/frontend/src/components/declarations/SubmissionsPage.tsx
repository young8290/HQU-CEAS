import { useEffect, useState } from 'react';
import DataPanel from '../common/DataPanel';
import StatusChip from '../common/StatusChip';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function SubmissionsPage() {
  const user = getUser();
  const [award, setAward] = useState<any>(null);
  const [honor, setHonor] = useState<any>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user?.classId) return;
    Promise.all([
      api.get(`/award-declarations/class/${user.classId}`),
      api.get(`/honor-declarations/class/${user.classId}`),
    ])
      .then(([awardData, honorData]) => {
        setAward(awardData);
        setHonor(honorData);
      })
      .catch((error) => setMessage(error.message));
  }, [user?.classId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-950 dark:text-white">提交记录</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">查看本班奖学金和荣誉称号申报状态、退回意见和学生明细。</p>
      </header>
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{message}</div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <SubmissionCard title="奖学金申报" data={award} />
        <SubmissionCard title="荣誉称号申报" data={honor} />
      </div>
    </div>
  );
}

function SubmissionCard({ title, data }: { title: string; data: any }) {
  return (
    <DataPanel title={title}>
      {data ? (
        <div className="space-y-3">
          <StatusChip label={data.status} tone={data.status === 'approved' ? 'success' : data.status === 'returned' ? 'warning' : 'info'} />
          <p className="text-sm text-neutral-500">学生数：{data.students?.length || 0}</p>
          {data.reviewOpinion && <p className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">{data.reviewOpinion}</p>}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">暂无提交记录。</p>
      )}
    </DataPanel>
  );
}
