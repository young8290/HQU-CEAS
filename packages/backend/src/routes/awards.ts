import { Router, Request, Response } from 'express';
import { authMiddleware, monitorClassCheck } from '../middleware/auth.js';
import * as awardService from '../services/awardService.js';
import * as awardAllocationService from '../services/awardAllocationService.js';
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
    res.json(await awardService.getAwardCandidates({
      academicYearId: await resolveYearId(req.query.academicYearId),
      classId: parseInt(req.params.classId as string),
      awardType: req.query.awardType as any,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/allocation/:classId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await awardAllocationService.getAwardAllocation({
      academicYearId: await resolveYearId(req.query.academicYearId),
      classId: parseInt(req.params.classId as string),
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/allocation/preview', async (req: Request, res: Response) => {
  try {
    res.json(await awardAllocationService.getAwardAllocation({
      academicYearId: await resolveYearId(req.body.academicYearId),
      classId: parseInt(req.body.classId),
      firstCount: parseInt(req.body.firstCount),
      secondCount: parseInt(req.body.secondCount),
      thirdCount: parseInt(req.body.thirdCount),
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
