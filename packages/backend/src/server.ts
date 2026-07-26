import { createServer } from 'http';
import app from './app.js';
import { config } from './core/config.js';
import { setupWebSocket } from './core/ws.js';
import prisma from './core/db.js';

/**
 * 进程入口（PLAN_V2 §3 server.ts）：HTTP 监听 + WebSocket 挂载 + 优雅退出。
 * 应用组装见 app.ts。
 */

const server = createServer(app);

// WebSocket（路径 /ws，行为与 v1 完全一致）
const wss = setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`WebSocket on ws://localhost:${config.port}/ws`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] 收到 ${signal}，开始优雅关闭…`);

  // 超时兜底：10 秒未能收尾则强制退出
  const forceExit = setTimeout(() => {
    console.warn('[server] 优雅关闭超时，强制退出');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  // 先断开 WS 客户端，再关 HTTP 监听，最后断开数据库
  wss.close();
  for (const client of wss.clients) {
    client.terminate();
  }
  server.close(() => {
    prisma.$disconnect()
      .catch((err: unknown) => console.warn('[server] prisma 断开失败:', (err as Error).message))
      .finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
