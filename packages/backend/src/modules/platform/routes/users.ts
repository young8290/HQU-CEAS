import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnly } from '../../../core/middleware/auth.js';
import * as userService from '../services/userService.js';
import * as exportService from '../../evaluation/services/exportService.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

router.get('/', adminOnly, async (req: Request, res: Response) => {
  try {
    const role = req.query.role as string | undefined;
    const users = await userService.listUsers({ role });
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', adminOnly, async (req: Request, res: Response) => {
  try {
    const { username, password, role, classId, displayName, email } = req.body;
    const user = await userService.createUser({ username, password, role, classId, displayName, email });
    res.json({ id: user.id, username: user.username });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/email', adminOnly, async (req: Request, res: Response) => {
  try {
    const user = await userService.updateUserEmail(parseInt(req.params.id as string), req.body.email || null);
    res.json(user);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/monitor-emails/import', adminOnly, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) throw new Error('请上传文件');
    res.json(await userService.importMonitorEmails({
      buffer: req.file.buffer,
      actorId: req.user!.userId,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    await userService.deleteUser(parseInt(req.params.id as string));
    res.json({ message: '删除成功' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reset-password', adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await userService.resetPassword(parseInt(req.params.id as string));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/generate-monitors/:gradeId?', adminOnly, async (req: Request, res: Response) => {
  try {
    const gradeId = req.params.gradeId ? parseInt(req.params.gradeId as string) : undefined;
    const overwrite = req.body.overwrite || false;
    const results = await userService.batchGenerateMonitors({
      gradeId: gradeId || 0,
      overwrite,
    });
    res.json(results);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/export-accounts', adminOnly, async (req: Request, res: Response) => {
  try {
    const accounts = req.body.accounts;
    const buffer = await exportService.exportAccountsList(accounts);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=accounts_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
