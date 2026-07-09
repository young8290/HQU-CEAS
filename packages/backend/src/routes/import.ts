import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnly, monitorClassCheck } from '../middleware/auth.js';
import * as importService from '../services/importService.js';
import * as exportService from '../services/exportService.js';
import * as academicYearService from '../services/academicYearService.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authMiddleware);

// Import academic scores
router.post('/academic/:classId?', adminOnly, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传文件' });
      return;
    }

    const classId = req.params.classId ? parseInt(req.params.classId as string) : parseInt(req.body.classId) || 0;

    let academicYearId = parseInt(req.body.academicYearId) || 0;
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) { res.status(400).json({ error: '未设置当前学年' }); return; }
      academicYearId = current.id;
    }

    const result = await importService.importAcademicScores(req.file.buffer, academicYearId, req.user!.userId, classId || undefined);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Import sports scores
router.post('/sports/:classId?', adminOnly, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传文件' });
      return;
    }

    const classId = req.params.classId ? parseInt(req.params.classId as string) : parseInt(req.body.classId) || 0;

    let academicYearId = parseInt(req.body.academicYearId) || 0;
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) { res.status(400).json({ error: '未设置当前学年' }); return; }
      academicYearId = current.id;
    }

    const result = await importService.importSportsScores(req.file.buffer, academicYearId, req.user!.userId, classId || undefined);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Import personal form (monitor can access for own class) - supports multiple files
router.post('/personal/:classId?', upload.array('files', 100), async (req: Request, res: Response) => {
  try {
    // Support both single file (field: 'file') and multiple files (field: 'files')
    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = (req as any).file as Express.Multer.File | undefined;
    
    const fileList = files && files.length > 0 ? files : singleFile ? [singleFile] : [];
    
    if (fileList.length === 0) {
      res.status(400).json({ error: '请上传文件' });
      return;
    }

    const user = req.user!;
    let classId = req.params.classId ? parseInt(req.params.classId as string) : parseInt(req.body.classId) || 0;

    // Monitor can only import for their own class
    if (user.role === 'monitor') {
      classId = user.classId!;
    }

    if (!classId) {
      res.status(400).json({ error: '请指定班级' });
      return;
    }

    let academicYearId = parseInt(req.body.academicYearId) || 0;
    if (!academicYearId) {
      const current = await academicYearService.getCurrentAcademicYear();
      if (!current) { res.status(400).json({ error: '未设置当前学年' }); return; }
      academicYearId = current.id;
    }

    const result = await importService.importPersonalFormMultiple(fileList, academicYearId, classId, user.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get import logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await importService.getImportLogs({ type, limit });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export failed records
router.post('/export-failures', async (req: Request, res: Response) => {
  try {
    const { failures } = req.body;
    const buffer = await exportService.exportFailedRecords(failures);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=import_failures.xlsx');
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
