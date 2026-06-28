import { useState, useEffect, useCallback, useRef } from 'react';
import { wsClient } from '../lib/ws';
import { api } from '../lib/api';
import { validateScore } from '../lib/validation';

interface ScoreData {
  value: number;
  remark: string | null;
}

export interface ScoreDetailData {
  id?: number;
  itemName: string;
  itemScore: number;
  sortOrder?: number;
}

interface StudentScore {
  id: number;
  studentNo: string;
  name: string;
  scores: Record<string, ScoreData>;
  details?: Record<string, ScoreDetailData[]>;
}

export function useScores(classId: number | null) {
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string>('');
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load scores
  const loadScores = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setSaveError(null);
    try {
      const data = await api.get(`/scores/class/${classId}`);
      setStudents(data);
    } catch (err) {
      console.error('Failed to load scores:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  // WebSocket handlers
  useEffect(() => {
    if (!classId) return;

    wsClient.connect();
    wsClient.joinClass(classId);

    const handleUpdated = (data: any) => {
      setSaveStatus('saved');
      setSaveError(null);
      setLastSaved(new Date().toLocaleTimeString());
      // Update local state with new scores
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === data.studentId) {
            return {
              ...s,
              scores: { ...s.scores, ...data.scores },
              details: data.details ? { ...s.details, [data.category]: data.details } : s.details,
            };
          }
          return s;
        })
      );
    };

    const handleSync = (data: any) => {
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === data.studentId) {
            return {
              ...s,
              scores: { ...s.scores, ...data.scores },
              details: data.details ? { ...s.details, [data.category]: data.details } : s.details,
            };
          }
          return s;
        })
      );
    };

    const handleError = (data: any) => {
      setSaveStatus('error');
      setSaveError(data.error || '保存失败');
      console.error('Score save error:', data.error);
    };

    wsClient.on('score:updated', handleUpdated);
    wsClient.on('score:sync', handleSync);
    wsClient.on('score:error', handleError);

    return () => {
      wsClient.off('score:updated', handleUpdated);
      wsClient.off('score:sync', handleSync);
      wsClient.off('score:error', handleError);
      wsClient.disconnect();
    };
  }, [classId]);

  // Update a score with debounce
  const updateScore = useCallback(
    (studentId: number, category: string, value: number, remark?: string) => {
      const error = validateScore(category, value);
      if (error) {
        setSaveStatus('error');
        setSaveError(error);
        return error;
      }
      setSaveError(null);

      // Optimistic update
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === studentId) {
            const newScores = {
              ...s.scores,
              [category]: { value, remark: remark ?? s.scores[category]?.remark ?? null },
            };
            return { ...s, scores: newScores };
          }
          return s;
        })
      );

      // Debounce the actual save
      const key = `${studentId}:${category}`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.current.set(
        key,
        setTimeout(async () => {
          setSaveStatus('saving');
          try {
            const sent = wsClient.updateScore(studentId, category, value, remark);
            if (!sent) {
              const data = await api.put('/scores', { studentId, category, value, remark });
              setStudents((prev) =>
                prev.map((s) => (
                  s.id === studentId
                    ? { ...s, scores: { ...s.scores, ...data } }
                    : s
                ))
              );
              setSaveStatus('saved');
              setSaveError(null);
              setLastSaved(new Date().toLocaleTimeString());
            }
          } catch (error: any) {
            setSaveStatus('error');
            setSaveError(error.message || '保存失败');
          } finally {
            debounceTimers.current.delete(key);
          }
        }, 300)
      );

      return null;
    },
    []
  );

  const updateRemark = useCallback(
    (studentId: number, category: string, remark: string) => {
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === studentId) {
            const existing = s.scores[category] || { value: 0, remark: null };
            return {
              ...s,
              scores: { ...s.scores, [category]: { ...existing, remark } },
            };
          }
          return s;
        })
      );

      const key = `${studentId}:${category}:remark`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.current.set(
        key,
        setTimeout(() => {
          const student = students.find((s) => s.id === studentId);
          const value = student?.scores[category]?.value || 0;
          setSaveStatus('saving');
          wsClient.updateScore(studentId, category, value, remark);
          debounceTimers.current.delete(key);
        }, 500)
      );
    },
    [students]
  );

  const loadScoreDetails = useCallback(async (studentId: number, category: string) => {
    if (!classId) return [];
    const data = await api.get<{ details: ScoreDetailData[] }>(`/scores/student/${studentId}/${category}/details`);
    return data.details || [];
  }, [classId]);

  const saveScoreDetails = useCallback(async (studentId: number, category: string, items: ScoreDetailData[]) => {
    if (!classId) return null;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const data = await api.put(`/scores/student/${studentId}/${category}/details`, { items });
      setSaveStatus('saved');
      setLastSaved(new Date().toLocaleTimeString());
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id === studentId) {
            return {
              ...s,
              scores: { ...s.scores, ...data.scores },
              details: { ...s.details, [category]: data.details },
            };
          }
          return s;
        })
      );
      return data;
    } catch (error: any) {
      setSaveStatus('error');
      setSaveError(error.message || '保存失败');
      throw error;
    }
  }, [classId]);

  return {
    students,
    loading,
    saveStatus,
    saveError,
    lastSaved,
    updateScore,
    updateRemark,
    loadScoreDetails,
    saveScoreDetails,
    loadScores,
  };
}
