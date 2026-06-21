import { Router, Request, Response } from 'express';
import { authMiddleware, monitorClassCheck } from '../middleware/auth.js';
import * as scoreReviewGroupService from '../services/scoreReviewGroupService.js';
import * as academicYearService from '../services/academicYearService.js';

const router = Router();
router.use(authMiddleware);

async function resolveYearId(value?: unknown) {
  if (value) return parseInt(String(value));
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('未设置当前学年');
  return current.id;
}

router.get('/:classId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await scoreReviewGroupService.getOrCreateScoreReviewRecord({
      academicYearId: await resolveYearId(req.query.academicYearId),
      classId: parseInt(req.params.classId as string),
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:classId/members', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await scoreReviewGroupService.saveScoreReviewMembers({
      academicYearId: await resolveYearId(req.body.academicYearId),
      classId: parseInt(req.params.classId as string),
      members: req.body.members || [],
      actorId: req.user!.userId,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:classId/signatures', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await scoreReviewGroupService.signScoreReviewMember({
      recordId: parseInt(req.body.recordId),
      memberId: parseInt(req.body.memberId),
      signatureFileId: parseInt(req.body.signatureFileId),
      actorId: req.user!.userId,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:classId/status', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await scoreReviewGroupService.getScoreReviewStatus(await resolveYearId(req.query.academicYearId), parseInt(req.params.classId as string)));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
