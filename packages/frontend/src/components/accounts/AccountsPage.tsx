import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface UserAccount {
  id: number;
  username: string;
  displayName: string;
  role: string;
  email?: string | null;
  grade?: { name: string } | null;
  class?: { name: string } | null;
  createdAt: string;
}

interface Grade {
  id: number;
  name: string;
}

interface GenerateResultItem {
  gradeName: string;
  className: string;
  username: string;
  password: string;
  displayName: string;
  status: string;
}

export default function AccountsPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number>(0);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResultItem[] | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // Admin creation form
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [emailDrafts, setEmailDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    loadUsers();
    loadGrades();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.get('/users');
      setUsers(data);
      const drafts: Record<number, string> = {};
      data.forEach((user: UserAccount) => {
        drafts[user.id] = user.email || '';
      });
      setEmailDrafts(drafts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadGrades = async () => {
    try {
      const data = await api.get('/grades');
      setGrades(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const url = selectedGrade > 0 ? `/users/generate-monitors/${selectedGrade}` : '/users/generate-monitors';
      const result = await api.post(url, {});
      setGenerateResult(result);
      setShowGenerate(false);
      const created = Array.isArray(result) ? result.filter((r: any) => r.status !== '跳过').length : 0;
      setSuccessMsg(`班长账号处理完成：共 ${Array.isArray(result) ? result.length : 0} 个，新建/重置 ${created} 个`);
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 8000);
    } catch (err: any) {
      setError(err.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!adminUsername || !adminPassword) {
      setError('用户名和密码不能为空');
      return;
    }
    setCreatingAdmin(true);
    setError('');
    try {
      await api.post('/users', {
        username: adminUsername,
        password: adminPassword,
        role: 'admin',
        displayName: adminDisplayName || adminUsername,
      });
      setSuccessMsg('管理员账号创建成功');
      setShowCreateAdmin(false);
      setAdminUsername('');
      setAdminPassword('');
      setAdminDisplayName('');
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleResetPassword = async (userId: number, username: string) => {
    if (!confirm(`确定要重置 ${username} 的密码吗？`)) return;
    try {
      const result = await api.post(`/users/${userId}/reset-password`, {});
      setSuccessMsg(`新密码：${result.newPassword}`);
      setTimeout(() => setSuccessMsg(''), 10000);
    } catch (err: any) {
      setError(err.message || '重置失败');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`确定要删除用户 ${username} 吗？`)) return;
    try {
      await api.delete(`/users/${userId}`);
      setSuccessMsg('用户已删除');
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const handleExportAccounts = async () => {
    try {
      await api.download('/export/accounts', '账号列表.xlsx');
      setSuccessMsg('已导出');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '导出失败');
    }
  };

  const handleExportGenerateResult = async () => {
    if (!generateResult) return;
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/users/export-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ accounts: generateResult }),
      });
      if (!resp.ok) throw new Error('导出失败');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `班长账号_含密码_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMsg('已导出含密码账号');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '导出失败');
    }
  };

  const handleSaveEmail = async (userId: number) => {
    try {
      await api.put(`/users/${userId}/email`, { email: emailDrafts[userId] || null });
      setSuccessMsg('班长邮箱已保存');
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '邮箱保存失败');
    }
  };

  const handleSendMonitorAccounts = async () => {
    if (!generateResult?.length) {
      setError('先生成班长账号，再发送账号邮件');
      return;
    }

    try {
      const result = await api.post('/mail/send-monitor-accounts', {
        accounts: generateResult.filter((item) => item.password && !item.password.includes('*')),
        systemLink: window.location.origin,
      });
      const sentCount = Array.isArray(result) ? result.filter((item: any) => item.status === 'sent').length : 0;
      const failedCount = Array.isArray(result) ? result.filter((item: any) => item.status === 'failed').length : 0;
      const totalCount = Array.isArray(result) ? result.length : 0;
      setSuccessMsg(`账号邮件：共 ${totalCount} 条，成功 ${sentCount} 条，失败 ${failedCount} 条`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message || '账号邮件发送失败');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-neutral-400">加载中</div></div>;
  }

  const admins = users.filter((u) => u.role === 'admin');
  const monitors = users.filter((u) => u.role === 'monitor');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-950 dark:text-white font-headings">账号管理</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">管理员与班长账号。</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportAccounts}
            className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            导出账号
          </button>
          <button
            onClick={() => setShowCreateAdmin(true)}
            className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-[#7c4a34] transition-colors hover:bg-[#f6f1e8] dark:border-primary-700 dark:bg-neutral-900 dark:text-primary-300 dark:hover:bg-primary-900/30"
          >
            新增管理员
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white transition-colors hover:bg-[#7c4a34]"
          >
            批量生成班长账号
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Generate Result - Show passwords */}
      {generateResult && generateResult.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings">生成结果（含密码）</h2>
            <div className="flex gap-2">
              <button
                onClick={handleSendMonitorAccounts}
                className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-[#7c4a34] transition-colors hover:bg-[#f6f1e8] dark:border-primary-800 dark:bg-neutral-900 dark:text-primary-300 dark:hover:bg-primary-900/20"
              >
                发送账号邮件
              </button>
              <button
                onClick={handleExportGenerateResult}
                className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white transition-colors hover:bg-[#7c4a34]"
              >
                导出 Excel（含密码）
              </button>
              <button
                onClick={() => setGenerateResult(null)}
                className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                关闭
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950">
            <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">
              关闭后不再显示密码
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">年级</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">班级</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">用户名</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">密码</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">显示名</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">状态</th>
                </tr>
              </thead>
              <tbody>
                {generateResult.map((r, i) => (
                  <tr key={i} className="border-b border-amber-100 dark:border-amber-800/30">
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{r.gradeName}</td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{r.className}</td>
                    <td className="px-4 py-2 font-mono text-neutral-700 dark:text-neutral-300">{r.username}</td>
                    <td className="px-4 py-2 font-mono font-bold text-red-600 dark:text-red-400">{r.password}</td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{r.displayName}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        r.status === '新建' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                        r.status === '已重置' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                        'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin accounts */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-3">管理员账号 ({admins.length})</h2>
        <div className="overflow-hidden rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">用户名</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">显示名</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">创建时间</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100 dark:border-neutral-800/50">
                  <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-400">{u.username}</td>
                  <td className="px-4 py-3 text-neutral-950 dark:text-white">{u.displayName}</td>
                  <td className="px-4 py-3 text-neutral-400 text-xs">{new Date(u.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleResetPassword(u.id, u.username)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                      >
                        重置密码
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monitor accounts */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-3">班长账号 ({monitors.length})</h2>
        <div className="overflow-hidden rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">用户名</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">显示名</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">年级</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">班级</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">邮箱</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((u) => (
                <tr key={u.id} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                  <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-400">{u.username}</td>
                  <td className="px-4 py-3 text-neutral-950 dark:text-white">{u.displayName}</td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{(u as any).class?.grade?.name || '-'}</td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{(u.class as any)?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <input
                      value={emailDrafts[u.id] || ''}
                      onChange={(event) => setEmailDrafts({ ...emailDrafts, [u.id]: event.target.value })}
                      placeholder="班长邮箱"
                      className="w-56 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleSaveEmail(u.id)}
                        className="text-xs text-green-600 dark:text-green-400 hover:text-green-700"
                      >
                        保存邮箱
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id, u.username)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
                      >
                        重置密码
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {monitors.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-neutral-400">暂无班长账号</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowGenerate(false)}>
          <div className="w-96 rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-4">批量生成班长账号</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              为每个班级生成一个班长账号，用户名格式：monitor_年级_班级名。
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">选择年级</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(Number(e.target.value))}
                className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              >
                <option value={0}>全部年级</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowGenerate(false)} className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">取消</button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white hover:bg-[#7c4a34] disabled:opacity-50"
              >
                {generating ? '生成中' : '生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreateAdmin(false)}>
          <div className="w-96 rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-4">新增管理员账号</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">用户名 *</label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="用户名"
                  className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">密码 *</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="密码"
                  className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">显示名称</label>
                <input
                  type="text"
                  value={adminDisplayName}
                  onChange={(e) => setAdminDisplayName(e.target.value)}
                  placeholder="可选，默认为用户名"
                  className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateAdmin(false)} className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">取消</button>
              <button
                onClick={handleCreateAdmin}
                disabled={creatingAdmin || !adminUsername || !adminPassword}
                className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white hover:bg-[#7c4a34] disabled:opacity-50"
              >
                {creatingAdmin ? '创建中' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
