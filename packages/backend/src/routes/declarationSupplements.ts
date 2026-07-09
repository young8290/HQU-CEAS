import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authMiddleware, monitorClassCheck } from '../middleware/auth.js';
import * as declarationSupplementService from '../services/declarationSupplementService.js';
import * as academicYearService from '../services/academicYearService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

async function resolveYearId(value?: unknown) {
  if (value) return parseInt(String(value));
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('未设置当前学年');
  return current.id;
}

router.post('/import/:classId?', monitorClassCheck, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) throw new Error('请上传文件');
    const user = req.user!;
    const classId = user.role === 'monitor'
      ? user.classId ?? undefined
      : req.params.classId
        ? parseInt(String(req.params.classId))
        : req.body.classId
          ? parseInt(String(req.body.classId))
          : undefined;

    res.json(await declarationSupplementService.importDeclarationSupplements({
      buffer: req.file.buffer,
      academicYearId: await resolveYearId(req.body.academicYearId),
      classId,
      userId: user.userId,
      filename: req.file.originalname,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
