import { Router, Request, Response } from 'express';
import { authMiddleware, monitorClassCheck } from '../../../core/middleware/auth.js';
import * as scoreService from '../services/scoreService.js';
import * as academicYearService from '../../platform/services/academicYearService.js';
import * as systemSettingService from '../../platform/services/systemSettingService.js';
import { SCORE_CATEGORIES, type ScoreCategory } from '../rules/scoreRules.js';

const router = Router();

router.use(authMiddleware);

// 管理员修改分数默认关闭（防误改），可在系统设置中开启；班长（monitor）不受影响。
// 注意：该闸只针对交互式入口，不进 scoreService，避免影响管理员批量导入。
const ADMIN_SCORE_EDITING_DISABLED_MSG = '管理员修改分数功能已关闭，请在系统设置中开启';

async function isAdminScoreEditingBlocked(role: string): Promise<boolean> {
  if (role !== 'admin') return false;
  const { allowAdminScoreEditing } = await systemSettingService.getEntryStatus();
  return allowAdminScoreEditing === false;
}

// Get scores by class
router.get('/class/:classId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    const classId = parseInt(req.params.classId as string);
    const yearId = parseInt(req.query.yearId as string) || 0;
    
    let academicYearId = yearId;
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) {
        res.status(400).json({ error: '未设置当前学年' });
        return;
      }
      academicYearId = current.id;
    }

    const scores = await scoreService.getScoresByClass(classId, academicYearId);
    res.json(scores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get scores by student
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'reviewer') {
      res.status(403).json({ error: 'permission_denied' });
      return;
    }
    const studentId = parseInt(req.params.studentId as string);
    if (req.user!.role === 'monitor') {
      if (!req.user!.classId) {
        res.status(403).json({ error: 'permission_denied' });
        return;
      }
      await scoreService.assertStudentInClass(studentId, req.user!.classId);
    }
    const yearId = parseInt(req.query.yearId as string) || 0;
    
    let academicYearId = yearId;
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) {
        res.status(400).json({ error: '未设置当前学年' });
        return;
      }
      academicYearId = current.id;
    }

    const scores = await scoreService.getScoresByStudent(studentId, academicYearId);
    res.json(scores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/student/:studentId/:category/details', async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'reviewer') {
      res.status(403).json({ error: 'permission_denied' });
      return;
    }
    const studentId = parseInt(req.params.studentId as string);
    const category = req.params.category as ScoreCategory;
    if (req.user!.role === 'monitor') {
      if (!req.user!.classId) {
        res.status(403).json({ error: 'permission_denied' });
        return;
      }
      await scoreService.assertStudentInClass(studentId, req.user!.classId);
    }
    let academicYearId = parseInt(req.query.yearId as string) || 0;
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) {
        res.status(400).json({ error: '未设置当前学年' });
        return;
      }
      academicYearId = current.id;
    }
    const details = await scoreService.getScoreBonusDetails({ studentId, academicYearId, category });
    res.json({ details });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update single score (REST fallback for WebSocket)
router.put('/', async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'reviewer') {
      res.status(403).json({ error: 'permission_denied' });
      return;
    }
    if (await isAdminScoreEditingBlocked(req.user!.role)) {
      res.status(403).json({ error: ADMIN_SCORE_EDITING_DISABLED_MSG });
      return;
    }
    const { studentId, category, value, remark, academicYearId } = req.body;

    // Role-based editability check
    const catRule = SCORE_CATEGORIES[category as ScoreCategory];
    if (catRule) {
      if (catRule.editableBy === 'none') {
        res.status(403).json({ error: `${catRule.label}为计算字段，不可手动修改` });
        return;
      }
      if (catRule.editableBy === 'admin' && req.user!.role !== 'admin') {
        res.status(403).json({ error: `${catRule.label}仅管理员可修改` });
        return;
      }
    }
    
    let yearId = academicYearId;
    if (!yearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) {
        res.status(400).json({ error: '未设置当前学年' });
        return;
      }
      yearId = current.id;
    }

    if (req.user!.role === 'monitor') {
      if (!req.user!.classId) {
        res.status(403).json({ error: 'permission_denied' });
        return;
      }
      await scoreService.assertStudentInClass(parseInt(studentId), req.user!.classId);
    }

    const scores = await scoreService.updateScore({
      studentId: parseInt(studentId),
      academicYearId: yearId,
      category,
      value: parseFloat(value),
      remark,
      updatedBy: req.user!.userId,
    });
    res.json(scores);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/student/:studentId/:category/details', async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'reviewer') {
      res.status(403).json({ error: 'permission_denied' });
      return;
    }
    if (await isAdminScoreEditingBlocked(req.user!.role)) {
      res.status(403).json({ error: ADMIN_SCORE_EDITING_DISABLED_MSG });
      return;
    }
    const studentId = parseInt(req.params.studentId as string);
    const category = req.params.category as ScoreCategory;
    if (req.user!.role === 'monitor') {
      if (!req.user!.classId) {
        res.status(403).json({ error: 'permission_denied' });
        return;
      }
      await scoreService.assertStudentInClass(studentId, req.user!.classId);
    }
    let academicYearId = parseInt(req.body.academicYearId) || 0;
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) {
        res.status(400).json({ error: '未设置当前学年' });
        return;
      }
      academicYearId = current.id;
    }
    const result = await scoreService.saveScoreBonusDetails({
      studentId,
      academicYearId,
      category,
      items: req.body.items || [],
      updatedBy: req.user!.userId,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Calculate total and sort
router.post('/calculate-total/:classId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    const classId = parseInt(req.params.classId as string);
    let academicYearId = parseInt(req.body.academicYearId) || 0;
    
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) {
        res.status(400).json({ error: '未设置当前学年' });
        return;
      }
      academicYearId = current.id;
    }

    const result = await scoreService.calculateAndSortClass(classId, academicYearId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validate scores
router.get('/validate/:classId', async (req: Request, res: Response) => {
  try {
    if (req.user!.role === 'reviewer') {
      res.status(403).json({ error: 'permission_denied' });
      return;
    }
    const classId = parseInt(req.params.classId as string);
    if (req.user!.role === 'monitor' && req.user!.classId !== classId) {
      res.status(403).json({ error: 'permission_denied' });
      return;
    }
    let academicYearId = parseInt(req.query.yearId as string) || 0;
    
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) {
        res.status(400).json({ error: '未设置当前学年' });
        return;
      }
      academicYearId = current.id;
    }

    const issues = await scoreService.validateClassScores(classId, academicYearId);
    res.json({ valid: issues.length === 0, issues });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
