import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyToken, TokenPayload } from '../utils/token.js';
import * as scoreService from '../services/scoreService.js';
import * as academicYearService from '../services/academicYearService.js';
import * as scoreReviewInviteService from '../services/scoreReviewInviteService.js';

interface AuthenticatedWebSocket extends WebSocket {
  user?: TokenPayload;
  classId?: number;
  isAlive?: boolean;
}

const classrooms = new Map<number, Set<AuthenticatedWebSocket>>();
const adminAuditClients = new Set<AuthenticatedWebSocket>();

export function broadcastToClass(classId: number, message: Record<string, unknown>) {
  if (!classrooms.has(classId)) return;
  classrooms.get(classId)!.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

export function broadcastToAdmins(message: Record<string, unknown>) {
  adminAuditClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

export function broadcastScoreReviewAudit(classId: number, audit: unknown) {
  broadcastToClass(classId, { type: 'score-review:log:sync', log: audit });
  broadcastToAdmins({ type: 'audit-log:sync', log: audit });
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as AuthenticatedWebSocket;
      if (client.isAlive === false) return client.terminate();
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Authenticate via query param token
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', error: '未提供认证Token' }));
      ws.close();
      return;
    }

    try {
      const user = verifyToken(token);
      ws.user = user;
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Token无效或已过期' }));
      ws.close();
      return;
    }

    ws.send(JSON.stringify({ type: 'connected', message: '连接成功' }));

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'join:class': {
            const classId = msg.classId;
            // Permission check
            if (ws.user!.role === 'monitor' && ws.user!.classId !== classId) {
              ws.send(JSON.stringify({ type: 'error', error: '无权访问该班级' }));
              return;
            }
            if (ws.user!.role === 'reviewer' && ws.user!.classId !== classId) {
              ws.send(JSON.stringify({ type: 'error', error: 'permission_denied' }));
              return;
            }

            // Leave previous classroom
            if (ws.classId && classrooms.has(ws.classId)) {
              classrooms.get(ws.classId)!.delete(ws);
            }

            // Join new classroom
            ws.classId = classId;
            if (!classrooms.has(classId)) {
              classrooms.set(classId, new Set());
            }
            classrooms.get(classId)!.add(ws);

            ws.send(JSON.stringify({ type: 'joined:class', classId }));
            break;
          }

          case 'join:audit-admin': {
            if (ws.user!.role !== 'admin') {
              ws.send(JSON.stringify({ type: 'error', error: 'permission_denied' }));
              return;
            }
            adminAuditClients.add(ws);
            ws.send(JSON.stringify({ type: 'joined:audit-admin' }));
            break;
          }

          case 'score:update': {
            if (ws.user!.role === 'reviewer') {
              ws.send(JSON.stringify({ type: 'score:error', error: 'permission_denied' }));
              return;
            }
            const { studentId, category, value, remark } = msg;
            if (ws.user!.role === 'monitor') {
              if (!ws.user!.classId) {
                ws.send(JSON.stringify({ type: 'score:error', studentId, category, error: 'permission_denied' }));
                return;
              }
              await scoreService.assertStudentInClass(parseInt(studentId), ws.user!.classId);
            }

            // Role-based editability check
            const { SCORE_CATEGORIES } = await import('../config/scoreRules.js');
            const catRule = SCORE_CATEGORIES[category as keyof typeof SCORE_CATEGORIES];
            if (catRule) {
              if (catRule.editableBy === 'none') {
                ws.send(JSON.stringify({ type: 'score:error', studentId, category, error: `${catRule.label}为计算字段，不可修改` }));
                return;
              }
              if (catRule.editableBy === 'admin' && ws.user!.role !== 'admin') {
                ws.send(JSON.stringify({ type: 'score:error', studentId, category, error: `${catRule.label}仅管理员可修改` }));
                return;
              }
            }

            // Get current academic year
            const currentYear = await academicYearService.getCurrentAcademicYear();
            if (!currentYear) {
              ws.send(JSON.stringify({ type: 'score:error', studentId, category, error: '未设置当前学年' }));
              return;
            }

            try {
              const scores = await scoreService.updateScore({
                studentId,
                academicYearId: msg.academicYearId || currentYear.id,
                category,
                value: parseFloat(value),
                remark,
                updatedBy: ws.user!.userId,
              });
              const details = await scoreService.getScoreBonusDetails({
                studentId: parseInt(studentId),
                academicYearId: msg.academicYearId || currentYear.id,
                category,
              });

              // Send confirmation back to sender
              ws.send(JSON.stringify({
                type: 'score:updated',
                studentId,
                category,
                scores,
                details,
                updatedAt: new Date().toISOString(),
                success: true,
              }));

              // Broadcast to other clients in the same classroom
              if (ws.classId && classrooms.has(ws.classId)) {
                classrooms.get(ws.classId)!.forEach((client) => {
                  if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                      type: 'score:sync',
                      studentId,
                      category,
                      scores,
                      details,
                      updatedBy: ws.user!.username,
                    }));
                  }
                });
              }
            } catch (err: any) {
              ws.send(JSON.stringify({
                type: 'score:error',
                studentId,
                category,
                error: err.message,
              }));
            }
            break;
          }

          case 'score-review:check:update': {
            const { studentId, status, remark } = msg;
            try {
              const result = await scoreReviewInviteService.updateStudentCheck({
                payload: ws.user!,
                studentId: parseInt(studentId),
                status,
                remark,
              });
              ws.send(JSON.stringify({
                type: 'score-review:check:updated',
                studentId: parseInt(studentId),
                check: result.check,
                aggregate: result.aggregate,
              }));
              if (ws.user!.classId) {
                broadcastToClass(ws.user!.classId, {
                  type: 'score-review:check:sync',
                  studentId: parseInt(studentId),
                  check: result.check,
                  aggregate: result.aggregate,
                });
                broadcastScoreReviewAudit(ws.user!.classId, result.audit);
              }
            } catch (err: any) {
              ws.send(JSON.stringify({
                type: 'score-review:check:error',
                studentId: parseInt(studentId),
                error: err.message,
              }));
            }
            break;
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: '消息格式错误' }));
      }
    });

    ws.on('close', () => {
      if (ws.classId && classrooms.has(ws.classId)) {
        classrooms.get(ws.classId)!.delete(ws);
        if (classrooms.get(ws.classId)!.size === 0) {
          classrooms.delete(ws.classId);
        }
      }
      adminAuditClients.delete(ws);
    });
  });

  return wss;
}
