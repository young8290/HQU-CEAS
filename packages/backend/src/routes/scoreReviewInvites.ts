import { Router, Request, Response } from 'express';
import { authMiddleware, monitorClassCheck, reviewerOnly } from '../middleware/auth.js';
import * as academicYearService from '../services/academicYearService.js';
import * as scoreReviewInviteService from '../services/scoreReviewInviteService.js';
import { broadcastScoreReviewAudit, broadcastToClass } from '../ws/index.js';

const router = Router();

async function resolveYearId(value?: unknown) {
  if (value) return parseInt(String(value));
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('current_academic_year_not_found');
  return current.id;
}

function requestBaseUrl(req: Request) {
  const origin = req.headers.origin;
  if (origin) return origin;
  return `${req.protocol}://${req.get('host')}`;
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const result = await scoreReviewInviteService.loginByInvite({
      token: String(req.body.token || ''),
      deviceId: String(req.body.deviceId || ''),
    });
    if (result.audit.classId) broadcastScoreReviewAudit(result.audit.classId, result.audit);
    res.json({ token: result.token, user: result.user });
  } catch (err: any) {
    res.status(err.message === 'device_mismatch' ? 403 : 401).json({ error: err.message });
  }
});

router.use(authMiddleware);

router.get('/logs', reviewerOnly, async (req: Request, res: Response) => {
  try {
    const session = await scoreReviewInviteService.getReviewerSession(req.user!);
    res.json(await scoreReviewInviteService.getClassLogs(session.record.classId, session.record.academicYearId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/session', reviewerOnly, async (req: Request, res: Response) => {
  try {
    res.json(await scoreReviewInviteService.getReviewerSession(req.user!));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/checks/:studentId', reviewerOnly, async (req: Request, res: Response) => {
  try {
    const result = await scoreReviewInviteService.updateStudentCheck({
      payload: req.user!,
      studentId: parseInt(req.params.studentId as string),
      status: req.body.status,
      remark: req.body.remark,
    });
    if (req.user!.classId) {
      broadcastToClass(req.user!.classId, {
        type: 'score-review:check:sync',
        studentId: parseInt(req.params.studentId as string),
        check: result.check,
        aggregate: result.aggregate,
      });
      broadcastScoreReviewAudit(req.user!.classId, result.audit);
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/signature', reviewerOnly, async (req: Request, res: Response) => {
  try {
    const result = await scoreReviewInviteService.bindReviewerSignature({
      payload: req.user!,
      signatureFileId: parseInt(req.body.signatureFileId),
    });
    if (req.user!.classId) {
      broadcastToClass(req.user!.classId, {
        type: 'score-review:signature:sync',
        record: result.record,
      });
      broadcastScoreReviewAudit(req.user!.classId, result.audit);
    }
    res.json(result.record);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:classId/logs', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await scoreReviewInviteService.getClassLogs(
      parseInt(req.params.classId as string),
      await resolveYearId(req.query.academicYearId),
    ));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:classId/checks', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await scoreReviewInviteService.getClassReviewChecks({
      academicYearId: await resolveYearId(req.query.academicYearId),
      classId: parseInt(req.params.classId as string),
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:classId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    res.json(await scoreReviewInviteService.listInvites({
      academicYearId: await resolveYearId(req.query.academicYearId),
      classId: parseInt(req.params.classId as string),
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:classId/members/:memberId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    const result = await scoreReviewInviteService.generateInvite({
      academicYearId: await resolveYearId(req.body.academicYearId),
      classId: parseInt(req.params.classId as string),
      memberId: parseInt(req.params.memberId as string),
      actorId: req.user!.userId,
      baseUrl: req.body.baseUrl || requestBaseUrl(req),
    });
    broadcastScoreReviewAudit(parseInt(req.params.classId as string), result.audit);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:classId/members/:memberId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    const audit = await scoreReviewInviteService.revokeInvite({
      academicYearId: await resolveYearId(req.body?.academicYearId),
      classId: parseInt(req.params.classId as string),
      memberId: parseInt(req.params.memberId as string),
      actorId: req.user!.userId,
    });
    broadcastScoreReviewAudit(parseInt(req.params.classId as string), audit);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
