import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as pdfService from '../services/pdfService.js';
import * as fileStorageService from '../services/fileStorageService.js';

const router = Router();
router.use(authMiddleware);

router.post('/generate', async (req: Request, res: Response) => {
  try {
    res.json(await pdfService.generatePdfMaterial({
      pdfType: req.body.pdfType,
      businessType: req.body.businessType,
      businessId: parseInt(req.body.businessId),
      context: req.body.context || {},
      generatedBy: req.user!.userId,
      signatureFileIds: Array.isArray(req.body.signatureFileIds)
        ? req.body.signatureFileIds.map((id: unknown) => Number(id)).filter(Number.isFinite)
        : undefined,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const allowed = await pdfService.canAccessPdfMaterial({
      pdfId: id,
      role: req.user!.role,
      classId: req.user!.classId,
    });
    if (!allowed) {
      res.status(403).json({ error: '权限不足，只能访问本班 PDF 材料' });
      return;
    }
    res.json(await pdfService.getPdfMaterial(id));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const allowed = await pdfService.canAccessPdfMaterial({
      pdfId: id,
      role: req.user!.role,
      classId: req.user!.classId,
    });
    if (!allowed) {
      res.status(403).json({ error: '权限不足，只能访问本班 PDF 材料' });
      return;
    }
    const pdf = await pdfService.getPdfMaterial(id);
    if (!pdf) throw new Error('PDF不存在');
    const { file, buffer } = await fileStorageService.readStoredFile(pdf.storedFileId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
