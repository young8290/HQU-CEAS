import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../../../core/middleware/auth.js';
import * as systemSettingService from '../services/systemSettingService.js';
import * as academicYearService from '../services/academicYearService.js';

const router = Router();
router.use(authMiddleware);

router.get('/entry-status', async (req: Request, res: Response) => {
  try {
    const [entryStatus, currentYear] = await Promise.all([
      systemSettingService.getEntryStatus(),
      academicYearService.getCurrentAcademicYear(),
    ]);
    res.json({ entryStatus, currentYear, user: req.user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    res.json(await systemSettingService.listSystemSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', adminOnly, async (req: Request, res: Response) => {
  try {
    res.json(await systemSettingService.updateEntryStatus(req.body.entryStatus || req.body, req.user!.userId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
