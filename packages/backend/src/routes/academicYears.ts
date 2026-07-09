import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import * as academicYearService from '../services/academicYearService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  try {
    const years = await academicYearService.listAcademicYears();
    res.json(years);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', adminOnly, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const year = await academicYearService.createAcademicYear(name);
    res.json(year);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/activate', adminOnly, async (req: Request, res: Response) => {
  try {
    const year = await academicYearService.activateAcademicYear(parseInt(req.params.id as string));
    res.json(year);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
