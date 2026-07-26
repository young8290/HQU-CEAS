import { Router, Request, Response } from 'express';
import multer from 'multer';
import { adminOnly, authMiddleware } from '../../../core/middleware/auth.js';
import * as awardQuotaService from '../services/awardQuotaService.js';
import * as academicYearService from '../../platform/services/academicYearService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(authMiddleware);

async function yearId(input?: unknown) {
  if (input) return parseInt(String(input));
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('未设置当前学年');
  return current.id;
}

router.post('/import', adminOnly, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) throw new Error('请上传文件');
    res.json(await awardQuotaService.importAwardQuotas({
      buffer: req.file.buffer,
      academicYearId: await yearId(req.body.academicYearId),
      userId: req.user!.userId,
      filename: req.file.originalname,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await awardQuotaService.listAwardQuotas(await yearId(req.query.academicYearId)));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
