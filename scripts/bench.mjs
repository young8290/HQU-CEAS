#!/usr/bin/env node
/**
 * HQU-CEAS 并发压测脚本（PLAN_V2 §5 验收工具，长期入库）。
 *
 * ⚠ 仅限本地/授权环境使用：本脚本会现签管理员 JWT 并发起高并发请求，
 *   只允许对自己部署、且获得授权的 HQU-CEAS 实例运行，禁止指向任何第三方服务。
 *
 * 用法：
 *   node scripts/bench.mjs                     # 默认 http://127.0.0.1:4000，60 并发，每端点 600 次
 *   node scripts/bench.mjs --port 4100         # 打生产模式实例（示例）
 *   node scripts/bench.mjs --base http://127.0.0.1:4100 --concurrency 60 --requests 600
 *
 * 参数（命令行优先于环境变量）：
 *   --base/-b     基础地址（env: BASE_URL；默认 http://127.0.0.1:<port>）
 *   --port/-p     端口（env: PORT；默认 4000，仅在未给 --base 时生效）
 *   --concurrency/-c  并发 worker 数（env: CONCURRENCY；默认 60）
 *   --requests/-n     每端点总请求数（env: REQUESTS；默认 600）
 *   --warmup      每端点预热请求数（默认 20，不计入统计）
 *
 * JWT：使用 packages/backend 的 jsonwebtoken 依赖 + packages/backend/.env 的
 * JWT_SECRET 现签 admin payload（可用环境变量 JWT_SECRET 覆盖）。
 *
 * 多客户端模拟：后端 `trust proxy=1` 且全局限流按 IP（600 次/分/IP）。为了模拟
 * “N 个并发用户”而非“单 IP 疯狂请求”，每个 worker 携带独立的 X-Forwarded-For。
 * 该头只对本机/授权压测有意义，也正是脚本仅限授权环境使用的原因之一。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'packages', 'backend');

// 从 backend 包的依赖图解析 jsonwebtoken（与服务端签名实现保持同源同版本）
const requireFromBackend = createRequire(path.join(BACKEND_DIR, 'package.json'));
const jwt = requireFromBackend('jsonwebtoken');

// ── 参数解析 ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--base': case '-b': out.base = next(); break;
      case '--port': case '-p': out.port = next(); break;
      case '--concurrency': case '-c': out.concurrency = next(); break;
      case '--requests': case '-n': out.requests = next(); break;
      case '--warmup': out.warmup = next(); break;
      case '--help': case '-h': out.help = true; break;
      default:
        console.error(`未知参数: ${arg}（--help 查看用法）`);
        process.exit(1);
    }
  }
  return out;
}

function readEnvFile(filePath) {
  const result = {};
  try {
    if (!fs.existsSync(filePath)) return result;
    for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  } catch (err) {
    console.warn(`[bench] 读取 ${filePath} 失败:`, err.message);
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log('用法见文件头部注释：node scripts/bench.mjs [--base URL] [--port N] [--concurrency N] [--requests N] [--warmup N]');
  process.exit(0);
}

const port = Number(args.port ?? process.env.PORT ?? 4000);
const BASE_URL = String(args.base ?? process.env.BASE_URL ?? `http://127.0.0.1:${port}`).replace(/\/+$/, '');
const CONCURRENCY = Math.max(1, Number(args.concurrency ?? process.env.CONCURRENCY ?? 60));
const REQUESTS = Math.max(CONCURRENCY, Number(args.requests ?? process.env.REQUESTS ?? 600));
const WARMUP = Math.max(0, Number(args.warmup ?? 20));

// ── JWT 现签（admin payload，与 core/utils/token.ts 的 TokenPayload 对齐）──────
const backendEnv = readEnvFile(path.join(BACKEND_DIR, '.env'));
const jwtSecret = process.env.JWT_SECRET || backendEnv.JWT_SECRET;
if (!jwtSecret) {
  console.error('[bench] 未找到 JWT_SECRET（packages/backend/.env 或环境变量），无法签发压测 token。');
  process.exit(1);
}
const token = jwt.sign(
  { userId: 1, username: 'bench-admin', role: 'admin', classId: null },
  jwtSecret,
  { expiresIn: '1h' },
);

// ── 压测端点（与 2026-07 基线口径一致）──────────────────────────────────────
const ENDPOINTS = [
  { name: 'health', path: '/api/health', auth: false },
  { name: 'scores/class/11', path: '/api/evaluation/scores/class/11', auth: true },
  { name: 'award-candidates/11', path: '/api/declaration/awards/candidates/11', auth: true },
  { name: 'national-scholarships', path: '/api/declaration/national-scholarships', auth: true },
];

function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return NaN;
  const rank = Math.ceil((p / 100) * sortedMs.length);
  return sortedMs[Math.min(sortedMs.length - 1, Math.max(0, rank - 1))];
}

async function fireOnce(endpoint, headers) {
  const start = performance.now();
  try {
    const res = await fetch(BASE_URL + endpoint.path, { headers });
    await res.arrayBuffer(); // 完整读掉响应体：计时覆盖整个响应，且尽快释放连接
    const ms = performance.now() - start;
    return { ok: res.status === 200, status: res.status, ms };
  } catch (err) {
    return { ok: false, status: `ERR(${err?.cause?.code ?? err?.name ?? 'unknown'})`, ms: performance.now() - start };
  }
}

async function benchEndpoint(endpoint) {
  const baseHeaders = endpoint.auth ? { authorization: `Bearer ${token}` } : {};

  // 预热（不计入统计）：让 JIT/连接池/SQLite 页缓存进入稳态
  for (let i = 0; i < WARMUP; i += 1) {
    await fireOnce(endpoint, baseHeaders);
  }

  let issued = 0;
  const durations = [];
  const errors = new Map(); // status -> count

  const wallStart = performance.now();
  const workers = Array.from({ length: CONCURRENCY }, (_, workerId) => (async () => {
    // 每 worker 一个独立“客户端 IP”（仅授权压测环境；见文件头注释）
    const headers = {
      ...baseHeaders,
      'x-forwarded-for': `10.66.${Math.floor(workerId / 250)}.${(workerId % 250) + 1}`,
    };
    for (;;) {
      if (issued >= REQUESTS) return;
      issued += 1;
      const r = await fireOnce(endpoint, headers);
      if (r.ok) {
        durations.push(r.ms);
      } else {
        errors.set(r.status, (errors.get(r.status) ?? 0) + 1);
      }
    }
  })());
  await Promise.all(workers);
  const wallMs = performance.now() - wallStart;

  durations.sort((a, b) => a - b);
  const n = durations.length;
  const sum = durations.reduce((acc, v) => acc + v, 0);
  return {
    name: endpoint.name,
    path: endpoint.path,
    total: REQUESTS,
    ok: n,
    errors,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    max: n ? durations[n - 1] : NaN,
    mean: n ? sum / n : NaN,
    rps: REQUESTS / (wallMs / 1000),
  };
}

function fmtMs(v) {
  return Number.isFinite(v) ? `${v.toFixed(1)}ms` : '-';
}

function fmtErrors(errors) {
  if (errors.size === 0) return '0';
  return [...errors.entries()].map(([status, count]) => `${status}×${count}`).join(', ');
}

const results = [];
console.log('⚠ 仅限本地/授权环境使用。');
console.log(`[bench] base=${BASE_URL} concurrency=${CONCURRENCY} requests/endpoint=${REQUESTS} warmup=${WARMUP} node=${process.version}`);

// 连通性预检：避免把“服务没起”跑成一整屏错误统计
try {
  const probe = await fetch(`${BASE_URL}/api/health`);
  if (!probe.ok) throw new Error(`/api/health 返回 ${probe.status}`);
  await probe.arrayBuffer();
} catch (err) {
  console.error(`[bench] 无法连通 ${BASE_URL}/api/health ：${err.message ?? err}`);
  process.exit(1);
}

for (const endpoint of ENDPOINTS) {
  process.stdout.write(`[bench] ${endpoint.name} ...`);
  const r = await benchEndpoint(endpoint);
  results.push(r);
  console.log(` 完成（ok=${r.ok}/${r.total}）`);
}

// ── 汇总表 ───────────────────────────────────────────────────────────────────
const header = ['endpoint', 'n', 'ok', 'p50', 'p95', 'max', 'mean', 'req/s', 'errors'];
const rows = results.map((r) => [
  r.name,
  String(r.total),
  String(r.ok),
  fmtMs(r.p50),
  fmtMs(r.p95),
  fmtMs(r.max),
  fmtMs(r.mean),
  r.rps.toFixed(0),
  fmtErrors(r.errors),
]);
const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
console.log('');
console.log(line(header));
console.log(line(widths.map((w) => '-'.repeat(w))));
for (const row of rows) console.log(line(row));

const totalErrors = results.reduce((acc, r) => acc + (r.total - r.ok), 0);
if (totalErrors > 0) {
  console.log(`\n[bench] 存在 ${totalErrors} 个非 200 响应，数据仅供参考（限流/鉴权/服务异常均会体现在 errors 列）。`);
  process.exitCode = 1;
}
