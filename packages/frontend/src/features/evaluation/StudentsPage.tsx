import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

interface Grade {
  id: number;
  name: string;
}

interface ClassItem {
  id: number;
  name: string;
  gradeId: number;
}

interface Student {
  id: number;
  studentNo: string;
  name: string;
  classId: number;
  class?: { name: string; grade?: { name: string } };
}

export default function StudentsPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showGlobalImportModal, setShowGlobalImportModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [newStudentNo, setNewStudentNo] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newGradeName, setNewGradeName] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [globalImportFile, setGlobalImportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const user = getUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    try {
      const data = await api.get('/platform/grades');
      setGrades(data);
      if (data.length > 0) {
        const gradeId = isAdmin ? data[0].id : (user?.gradeId || data[0].id);
        setSelectedGrade(gradeId);
        await loadClasses(gradeId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async (gradeId: number) => {
    try {
      const data = await api.get(`/platform/grades/${gradeId}/classes`);
      setClasses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStudents = async (classId: number) => {
    try {
      const data = await api.get(`/platform/students?classId=${classId}`);
      setStudents(data.students || data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGradeChange = async (gradeId: number) => {
    setSelectedGrade(gradeId);
    setSelectedClass(null);
    setStudents([]);
    await loadClasses(gradeId);
  };

  const handleClassSelect = async (classId: number) => {
    setSelectedClass(classId);
    await loadStudents(classId);
  };

  const handleAddStudent = async () => {
    if (!selectedClass) return;
    setError('');
    try {
      await api.post('/platform/students', { classId: selectedClass, studentNo: newStudentNo, name: newStudentName });
      setShowAddModal(false);
      setNewStudentNo('');
      setNewStudentName('');
      setSuccessMsg('学生添加成功');
      await loadStudents(selectedClass);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '添加失败');
    }
  };

  const handleDeleteStudent = async (studentId: number, name: string) => {
    if (!confirm(`确定要删除学生 ${name} 吗？相关成绩也会被删除。`)) return;
    try {
      await api.delete(`/platform/students/${studentId}`);
      setSuccessMsg('学生已删除');
      if (selectedClass) await loadStudents(selectedClass);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const handleBatchUpload = async () => {
    if (!batchFile || !selectedClass) return;
    setUploading(true);
    setError('');
    try {
      const result = await api.upload(`/platform/students/batch/${selectedClass}`, batchFile);
      setShowBatchModal(false);
      setBatchFile(null);
      setSuccessMsg(`批量导入完成：新增 ${result.added} 人，跳过 ${result.skipped} 人`);
      await loadStudents(selectedClass);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setUploading(false);
    }
  };

  const handleGlobalImport = async () => {
    if (!globalImportFile) return;
    setUploading(true);
    setError('');
    try {
      const result = await api.upload('/platform/students/batch', globalImportFile);
      setShowGlobalImportModal(false);
      setGlobalImportFile(null);
      setSuccessMsg(`导入完成：新增 ${result.added} 人，跳过 ${result.skipped} 人${result.failed ? `，失败 ${result.failed} 人` : ''}`);
      // Reload grades since new grades/classes may have been created
      await loadGrades();
      setTimeout(() => setSuccessMsg(''), 8000);
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await api.download('/platform/students/template/download', '学生导入模板.xlsx');
    } catch (err: any) {
      setError(err.message || '下载模板失败');
    }
  };

  const handleAddGrade = async () => {
    if (!newGradeName.trim()) return;
    setError('');
    try {
      await api.post('/platform/grades', { name: newGradeName });
      setShowGradeModal(false);
      setNewGradeName('');
      setSuccessMsg('年级创建成功');
      await loadGrades();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '创建失败');
    }
  };

  const handleAddClass = async () => {
    if (!newClassName.trim() || !selectedGrade) return;
    setError('');
    try {
      await api.post(`/platform/grades/${selectedGrade}/classes`, { name: newClassName });
      setShowClassModal(false);
      setNewClassName('');
      setSuccessMsg('班级创建成功');
      await loadClasses(selectedGrade);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '创建失败');
    }
  };

  const handleDeleteGrade = async (gradeId: number, name: string) => {
    if (!confirm(`确定要删除年级 ${name} 吗？该年级下的所有班级、学生和成绩都会被删除！`)) return;
    try {
      await api.delete(`/platform/grades/${gradeId}`);
      setSuccessMsg('年级已删除');
      await loadGrades();
      setSelectedClass(null);
      setStudents([]);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const handleDeleteClass = async (classId: number, name: string) => {
    if (!confirm(`确定要删除班级 ${name} 吗？该班级下的所有学生和成绩都会被删除！`)) return;
    try {
      await api.delete(`/platform/grades/${selectedGrade}/classes/${classId}`);
      setSuccessMsg('班级已删除');
      if (selectedGrade) await loadClasses(selectedGrade);
      if (selectedClass === classId) {
        setSelectedClass(null);
        setStudents([]);
      }
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-neutral-400">加载中</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-950 dark:text-white font-headings">学生管理</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">年级、班级和学生信息。</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              下载模板
            </button>
            <button
              onClick={() => setShowGlobalImportModal(true)}
              className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white transition-colors hover:bg-[#7c4a34]"
            >
              导入学生名单
            </button>
          </div>
        )}
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

      {/* Grade tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {grades.map((grade) => (
          <div key={grade.id} className="group relative">
            <button
              onClick={() => handleGradeChange(grade.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                selectedGrade === grade.id
                  ? 'bg-[#9a5b3d] text-white'
                  : 'border border-[#d8c9b8] bg-white text-neutral-600 hover:border-[#9a5b3d] hover:bg-[#fffaf2] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
              }`}
            >
              {grade.name}
            </button>
            {isAdmin && (
              <button
                onClick={() => handleDeleteGrade(grade.id, grade.name)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="删除年级"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {isAdmin && (
          <button
            onClick={() => setShowGradeModal(true)}
            className="rounded-md border border-dashed border-[#d8c9b8] px-4 py-2 text-sm font-medium text-neutral-500 transition-colors hover:border-[#9a5b3d] hover:text-[#7c4a34] dark:border-neutral-600 dark:hover:border-primary-400 dark:hover:text-primary-300"
          >
            + 新建年级
          </button>
        )}
      </div>

      {/* Class list + actions */}
      {selectedGrade && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {classes.map((cls) => (
              <div key={cls.id} className="group relative">
                <button
                  onClick={() => handleClassSelect(cls.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedClass === cls.id
                      ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {cls.name}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteClass(cls.id, cls.name)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    title="删除班级"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {isAdmin && (
              <button
                onClick={() => setShowClassModal(true)}
                className="px-3 py-1.5 rounded-lg text-sm border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-500 hover:border-primary-400 hover:text-primary-500 transition-colors"
              >
                + 新建班级
              </button>
            )}
          </div>
        </div>
      )}

      {/* Student table */}
      {selectedClass && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings">
              学生列表 ({students.length}人)
            </h2>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadTemplate}
                  className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-[#f6f1e8] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  下载模板
                </button>
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="rounded-md border border-[#d8c9b8] bg-white px-3 py-1.5 text-sm text-[#7c4a34] transition-colors hover:bg-[#f6f1e8] dark:border-primary-800 dark:bg-neutral-900 dark:text-primary-300 dark:hover:bg-primary-500/10"
                >
                  批量导入
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="rounded-md bg-[#9a5b3d] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[#7c4a34]"
                >
                  添加学生
                </button>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-[#ded6c8] bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">序号</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">学号</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">姓名</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-300">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student.id} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="px-4 py-3 text-neutral-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-400">{student.studentNo}</td>
                    <td className="px-4 py-3 font-medium text-neutral-950 dark:text-white">{student.name}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          删除
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 && (
              <div className="text-center py-12 text-neutral-400">暂无学生</div>
            )}
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <Modal title="添加学生" onClose={() => setShowAddModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">学号</label>
              <input
                type="text"
                value={newStudentNo}
                onChange={(e) => setNewStudentNo(e.target.value)}
                className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                placeholder="学号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">姓名</label>
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                placeholder="姓名"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">取消</button>
              <button onClick={handleAddStudent} className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white hover:bg-[#7c4a34]">添加</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Batch Import Modal */}
      {showBatchModal && (
        <Modal title="批量导入学生" onClose={() => setShowBatchModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              上传 .xlsx 文件：A 列学号，B 列姓名。
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setBatchFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:rounded-md file:border file:border-[#d8c9b8] file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#7c4a34] hover:file:bg-[#f6f1e8] dark:file:border-neutral-800 dark:file:bg-neutral-950 dark:file:text-primary-300"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBatchModal(false)} className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">取消</button>
              <button
                onClick={handleBatchUpload}
                disabled={!batchFile || uploading}
                className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white hover:bg-[#7c4a34] disabled:opacity-50"
              >
                {uploading ? '上传中' : '导入'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Grade Modal */}
      {showGradeModal && (
        <Modal title="新建年级" onClose={() => setShowGradeModal(false)}>
          <div className="space-y-4">
            <input
              type="text"
              value={newGradeName}
              onChange={(e) => setNewGradeName(e.target.value)}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              placeholder="年级名称，如：2023级"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowGradeModal(false)} className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">取消</button>
              <button onClick={handleAddGrade} className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white hover:bg-[#7c4a34]">创建</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Class Modal */}
      {showClassModal && (
        <Modal title="新建班级" onClose={() => setShowClassModal(false)}>
          <div className="space-y-4">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="w-full rounded-md border border-[#d8c9b8] bg-white px-3 py-2 text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#ead9c7] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              placeholder="班级名称，如：计算机科学与技术1班"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowClassModal(false)} className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">取消</button>
              <button onClick={handleAddClass} className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white hover:bg-[#7c4a34]">创建</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Global Import Modal */}
      {showGlobalImportModal && (
        <Modal title="导入学生名单" onClose={() => setShowGlobalImportModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              上传 .xlsx 文件：A 列学号、B 列姓名、C 列年级、D 列班级。缺失年级和班级将补建。
            </p>
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
              可先下载模板。
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setGlobalImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:rounded-md file:border file:border-[#d8c9b8] file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#7c4a34] hover:file:bg-[#f6f1e8] dark:file:border-neutral-800 dark:file:bg-neutral-950 dark:file:text-primary-300"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowGlobalImportModal(false)} className="rounded-md border border-[#d8c9b8] bg-white px-4 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">取消</button>
              <button
                onClick={handleGlobalImport}
                disabled={!globalImportFile || uploading}
                className="rounded-md bg-[#9a5b3d] px-4 py-2 text-sm text-white hover:bg-[#7c4a34] disabled:opacity-50"
              >
                {uploading ? '导入中' : '导入'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
