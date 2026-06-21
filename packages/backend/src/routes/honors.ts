import { Router, Request, Response } from 'express';
import { authMiddleware, monitorClassCheck } from '../middleware/auth.js';
import * as honorService from '../services/honorService.js';
import * as academicYearService from '../services/academicYearService.js';

const router = Router();
router.use(authMiddleware);

async function resolveYearId(value?: unknown) {
  if (value) return parseInt(String(value));
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('未设置当前学年');
  return current.id;
}

router.get('/candidates/:classId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await honorService.getHonorCandidates({
      academicYearId: await resolveYearId(req.query.academicYearId),
      classId: parseInt(req.params.classId as string),
      honorType: req.query.honorType as any,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
