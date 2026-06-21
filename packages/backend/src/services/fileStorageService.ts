import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/database.js';

const storageRoot = path.resolve(process.cwd(), 'storage');

function monthPath() {
  const now = new Date();
  return path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
}

export async function saveStoredFile(data: {
  buffer: Buffer;
  fileName: string;
  fileType: string;
  mimeType: string;
  createdBy?: number;
}) {
  const sha256 = crypto.createHash('sha256').update(data.buffer).digest('hex');
  const ext = path.extname(data.fileName) || '.bin';
  const relativePath = path.join(data.fileType, monthPath(), `${Date.now()}-${sha256.slice(0, 12)}${ext}`);
  const fullPath = path.join(storageRoot, relativePath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data.buffer);

  return prisma.storedFile.create({
    data: {
      fileName: data.fileName,
      fileType: data.fileType,
      mimeType: data.mimeType,
      storageKey: relativePath.replace(/\\/g, '/'),
      sha256,
      size: data.buffer.length,
      createdBy: data.createdBy,
    },
  });
}

export async function readStoredFile(id: number) {
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) throw new Error('文件不存在');
  const fullPath = path.join(storageRoot, file.storageKey);
  const buffer = await fs.readFile(fullPath);
  return { file, buffer };
}
