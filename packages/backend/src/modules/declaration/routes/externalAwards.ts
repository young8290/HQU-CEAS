import { Router, Request, Response } from 'express';
import multer from 'multer';
import { adminOnly, authMiddleware } from '../../../core/middleware/auth.js';
import * as externalAwardImportService from '../services/externalAwardImportService.js';
import * as academicYearService from '../../platform/services/academicYearService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(authMiddleware);

router.post('/import', adminOnly, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) throw new Error('请上传文件');
    const current = req.body.academicYearId
      ? { id: parseInt(req.body.academicYearId) }
      : await academicYearService.getCurrentAcademicYear();
    if (!current) throw new Error('未设置当前学年');
    res.json(await externalAwardImportService.importExternalAwardRecords({
      buffer: req.file.buffer,
      academicYearId: current.id,
      awardType: req.body.awardType || 'national_scholarship',
      userId: req.user!.userId,
      filename: req.file.originalname,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
