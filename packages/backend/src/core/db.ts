import { PrismaClient } from '@prisma/client';
// 先加载 core/config（显式读入 .env），确保 PrismaClient 实例化时 DATABASE_URL 已就绪。
import './config.js';

/**
 * Prisma 单例 + SQLite 硬化（PLAN_V2 §5.1）。
 *
 * 初始化时逐条执行 PRAGMA：
 * - journal_mode=WAL   —— 并发读写吞吐主开关（持久化设置）
 * - busy_timeout=5000  —— 写锁竞争时等待而非立即报错（每连接生效）
 * - synchronous=NORMAL —— WAL 下的推荐持久性/性能平衡（每连接生效）
 *
 * 失败仅告警不阻断（例如底层不是 SQLite 时，行为自动退化为无操作）。
 */

const prisma = new PrismaClient();

const SQLITE_PRAGMAS = [
  'journal_mode=WAL',
  'busy_timeout=5000',
  'synchronous=NORMAL',
];

async function applySqlitePragmas(): Promise<void> {
  for (const pragma of SQLITE_PRAGMAS) {
    try {
      await prisma.$queryRawUnsafe(`PRAGMA ${pragma};`);
    } catch (err) {
      console.warn(`[db] PRAGMA ${pragma} 执行失败（不影响启动）:`, (err as Error).message);
    }
  }
}

// node:test 子进程内跳过：单元测试通过打桩 prisma 模型方法运行，不应触碰真实数据库，
// 也避免多个测试子进程并发对同一 dev.db 执行 WAL 切换。
if (!process.env.NODE_TEST_CONTEXT) {
  void applySqlitePragmas();
}

export default prisma;
