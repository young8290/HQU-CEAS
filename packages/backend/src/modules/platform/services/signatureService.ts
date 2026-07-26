import prisma from '../../../core/db.js';
import { saveStoredFile } from './fileStorageService.js';
import { recordAuditLog } from './auditService.js';

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return { mimeType: 'image/png', buffer: Buffer.from(dataUrl, 'base64') };
  }
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

export async function saveSignature(data: {
  signerName: string;
  method: 'draw' | 'upload';
  purpose: string;
  imageData: string;
  createdBy?: number;
}) {
  const { mimeType, buffer } = decodeDataUrl(data.imageData);
  const storedFile = await saveStoredFile({
    buffer,
    fileName: `${data.signerName}-${data.purpose}.png`,
    fileType: 'signatures',
    mimeType,
    createdBy: data.createdBy,
  });

  const signature = await prisma.signatureFile.create({
    data: {
      signerName: data.signerName,
      method: data.method,
      purpose: data.purpose,
      originalFileId: storedFile.id,
      croppedFileId: storedFile.id,
      createdBy: data.createdBy,
    },
    include: {
      originalFile: true,
      croppedFile: true,
    },
  });

  await recordAuditLog({
    module: 'signature',
    action: 'save_signature',
    actorId: data.createdBy,
    targetType: 'SignatureFile',
    targetId: signature.id,
    after: { signerName: data.signerName, method: data.method, purpose: data.purpose },
  });

  return signature;
}

export async function getSignature(id: number) {
  return prisma.signatureFile.findUnique({
    where: { id },
    include: { originalFile: true, croppedFile: true },
  });
}
