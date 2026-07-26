import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../../../core/middleware/auth.js';
import * as nationalScholarshipService from '../services/nationalScholarshipService.js';
import * as academicYearService from '../../platform/services/academicYearService.js';

const router = Router();

router.use(authMiddleware, adminOnly);

async function resolveAcademicYearId(input?: unknown) {
  if (input) return parseInt(String(input));
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('未设置当前学年');
  return current.id;
}

// 评比单元列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const academicYearId = await resolveAcademicYearId(req.query.academicYearId);
    res.json(await nationalScholarshipService.listEvaluations(academicYearId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 建议平行班分组（同年级、按专业名合组）
router.get('/suggest-classes', async (req: Request, res: Response) => {
  try {
    const gradeId = parseInt(String(req.query.gradeId));
    if (!Number.isFinite(gradeId) || gradeId <= 0) {
      res.status(400).json({ error: '请选择年级' });
      return;
    }
    const academicYearId = await resolveAcademicYearId(req.query.academicYearId);
    res.json(await nationalScholarshipService.suggestClasses(academicYearId, gradeId));
  } catch (err: any) {
    const status = err.message === '年级不存在' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

// 新建评比单元
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, academicYearId, classIds, quota, poolRatio, paramW, paramD, note } = req.body;
    const evaluation = await nationalScholarshipService.createEvaluation({
      academicYearId: await resolveAcademicYearId(academicYearId),
      name,
      classIds,
      quota,
      poolRatio,
      paramW,
      paramD,
      note,
      createdBy: req.user!.userId,
    });
    res.json(evaluation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 评比单元详情（含表 A-1 比较表）
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }
    const evaluation = await nationalScholarshipService.getEvaluation(id);
    const comparisonTable = await nationalScholarshipService.getComparisonTable(id);
    res.json({ ...evaluation, comparisonTable });
  } catch (err: any) {
    const status = err.message === '评比单元不存在' ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// 计算/重算（算法一、二、三）
router.post('/:id/compute', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }
    res.json(await nationalScholarshipService.computeEvaluation(id, req.user!.userId));
  } catch (err: any) {
    const status = err.message === '评比单元不存在' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

// 人工标记：班级推荐 / 重大成果 / 成果清单（需重算后生效）
router.put('/:id/candidates/:candidateId/flags', async (req: Request, res: Response) => {
  try {
    const candidateId = parseInt(req.params.candidateId as string);
    if (!Number.isFinite(candidateId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }
    const { isClassRecommended, hasMajorAchievement, achievements } = req.body;
    res.json(await nationalScholarshipService.updateCandidateFlags(candidateId, {
      isClassRecommended,
      hasMajorAchievement,
      achievements,
    }, req.user!.userId));
  } catch (err: any) {
    const status = err.message === '候选人不存在' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

// 临界层结构化评议：书面理由 / 最终次序 / 是否入选
router.put('/:id/candidates/:candidateId/review', async (req: Request, res: Response) => {
  try {
    const candidateId = parseInt(req.params.candidateId as string);
    if (!Number.isFinite(candidateId)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }
    const { reviewNote, finalRank, selected } = req.body;
    res.json(await nationalScholarshipService.updateCandidateReview(candidateId, {
      reviewNote,
      finalRank,
      selected,
    }, req.user!.userId));
  } catch (err: any) {
    const status = err.message === '候选人不存在' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

// 导出候选人比较表（表 A-1）
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: '参数无效' });
      return;
    }
    const evaluation = await nationalScholarshipService.getEvaluation(id);
    const buffer = await nationalScholarshipService.exportEvaluationTable(id);
    const fileName = `${evaluation.name}候选人比较表.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (err: any) {
    const status = err.message === '评比单元不存在' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

export default router;
