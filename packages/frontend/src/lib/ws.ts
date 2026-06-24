import { getToken } from './auth';

type MessageHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private classId: number | null = null;

  connect() {
    const token = getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/ws?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      if (this.classId) {
        this.send({ type: 'join:class', classId: this.classId });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const handlers = this.handlers.get(data.type);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting in 3s...');
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  joinClass(classId: number) {
    this.classId = classId;
    this.send({ type: 'join:class', classId });
  }

  updateScore(studentId: number, category: string, value: number, remark?: string, academicYearId?: number) {
    this.send({
      type: 'score:update',
      studentId,
      category,
      value,
      remark,
      academicYearId,
    });
  }

  updateReviewCheck(studentId: number, status: 'pending' | 'reviewed' | 'issue', remark?: string) {
    this.send({
      type: 'score-review:check:update',
      studentId,
      status,
      remark,
    });
  }

  joinAuditAdmin() {
    this.send({ type: 'join:audit-admin' });
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }
}

export const wsClient = new WebSocketClient();
