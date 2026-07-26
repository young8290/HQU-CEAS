import { Router, Request, Response } from 'express';
import { authMiddleware, monitorClassCheck } from '../../../core/middleware/auth.js';
import * as awardDeclarationService from '../services/awardDeclarationService.js';
import * as academicYearService from '../../platform/services/academicYearService.js';

const router = Router();
router.use(authMiddleware);

async function resolveYearId(value?: unknown) {
  if (value) return parseInt(String(value));
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('未设置当前学年');
  return current.id;
}

router.get('/class/:classId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await awardDeclarationService.getAwardDeclarationForClass({
      academicYearId: await resolveYearId(req.query.academicYearId),
      classId: parseInt(req.params.classId as string),
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await awardDeclarationService.submitAwardDeclaration({
      academicYearId: await resolveYearId(req.body.academicYearId),
      classId: parseInt(req.body.classId),
      studentSelections: req.body.studentSelections || [],
      checklist: req.body.checklist || {},
      signatureFileId: req.body.signatureFileId,
      actorId: req.user!.userId,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
