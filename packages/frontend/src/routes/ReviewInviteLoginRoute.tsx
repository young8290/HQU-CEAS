import { useEffect, useState } from 'react';
import ScreenState from '../components/common/ScreenState';
import { api } from '../lib/api';
import { navigateTo } from '../lib/router';
import { setReviewAuth } from '../lib/auth';

function getReviewDeviceId() {
  const existing = localStorage.getItem('reviewDeviceId');
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem('reviewDeviceId', next);
  return next;
}

export default function ReviewInviteLoginRoute() {
  const [message, setMessage] = useState('正在校验评审链接...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setMessage('评审链接缺少认证信息');
      return;
    }
    api.post('/score-review-invites/login', {
      token,
      deviceId: getReviewDeviceId(),
    })
      .then((result) => {
        setReviewAuth(result.token, result.user);
        navigateTo('/review/scores', { replace: true });
      })
      .catch((error) => {
        setMessage(error.message || '评审链接校验失败');
      });
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f3eb] px-4 py-12 dark:bg-neutral-950">
      <div className="mx-auto max-w-xl rounded-lg border border-[#ded6c8] bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <ScreenState label={message} />
      </div>
    </main>
  );
}
