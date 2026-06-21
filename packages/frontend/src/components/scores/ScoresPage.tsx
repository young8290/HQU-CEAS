import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import ScoreEditor from './ScoreEditor';

interface Grade {
  id: number;
  name: string;
}

interface ClassItem {
  id: number;
  name: string;
  _count?: { students: number };
}

export default function ScoresPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const user = getUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    try {
      const data = await api.get('/grades');
      setGrades(data);
      // If monitor, pre-select their grade
      if (!isAdmin && user?.gradeId) {
        setSelectedGrade(user.gradeId);
        loadClasses(user.gradeId);
      } else if (data.length > 0) {
        setSelectedGrade(data[0].id);
        loadClasses(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load grades:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async (gradeId: number) => {
    try {
      const data = await api.get(`/grades/${gradeId}/classes`);
      setClasses(data);
      // If monitor, pre-select their class
      if (!isAdmin && user?.classId) {
        setSelectedClass(user.classId);
      }
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  const handleGradeChange = (gradeId: number) => {
    setSelectedGrade(gradeId);
    setSelectedClass(null);
    setClasses([]);
    loadClasses(gradeId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">加载中...</div>
      </div>
    );
  }

  if (selectedClass) {
    return <ScoreEditor classId={selectedClass} onBack={() => setSelectedClass(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-950 dark:text-white font-headings">分数填写</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">请选择年级和班级进入分数编辑</p>
      </div>

      {/* Grade Selection */}
      {isAdmin && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-3">选择年级</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grades.map((grade) => (
              <button
                key={grade.id}
                onClick={() => handleGradeChange(grade.id)}
                className={`rounded-lg border p-4 text-left transition-colors duration-200 ${
                  selectedGrade === grade.id
                    ? 'border-[#9a5b3d] bg-[#fffaf2] text-[#7c4a34] dark:border-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                    : 'border-[#ded6c8] bg-white text-neutral-600 hover:border-[#9a5b3d] hover:bg-[#fffaf2] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-primary-700'
                }`}
              >
                <span className="font-medium text-neutral-950 dark:text-white">{grade.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Class Selection */}
      {selectedGrade && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-3">选择班级</h2>
          {classes.length === 0 ? (
            <div className="text-neutral-400">该年级暂无班级</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  disabled={!isAdmin && cls.id !== user?.classId}
                  className={`rounded-lg border p-5 text-left transition-colors duration-200 ${
                    !isAdmin && cls.id !== user?.classId
                      ? 'cursor-not-allowed border-[#ded6c8] opacity-50 dark:border-neutral-800'
                      : 'cursor-pointer border-[#ded6c8] bg-white hover:border-[#9a5b3d] hover:bg-[#fffaf2] dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-950 dark:text-white">{cls.name}</span>
                    <span className="text-sm text-neutral-400">{cls._count?.students || 0} 名学生</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
