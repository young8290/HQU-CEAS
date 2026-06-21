import prisma from '../config/database.js';
import { deflateSync, inflateSync } from 'node:zlib';
import { saveStoredFile, readStoredFile } from './fileStorageService.js';
import { recordAuditLog } from './auditService.js';

const pageWidth = 595.28;
const pageHeight = 841.89;
const marginX = 54;
const textTop = 746;
const lineHeight = 21;

type PdfImageFilter = 'FlateDecode' | 'DCTDecode';

interface PdfSignatureImage {
  id: number;
  buffer: Buffer;
  width: number;
  height: number;
  filter: PdfImageFilter;
}

function escapePdfText(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function toUtf16Hex(text: string) {
  return Buffer.from(`\uFEFF${text}`, 'utf16le').swap16().toString('hex').toUpperCase();
}

function textCommand(text: string, x: number, y: number, size = 11) {
  return `BT /F1 ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td <${toUtf16Hex(text)}> Tj ET`;
}

function asciiTextCommand(text: string, x: number, y: number, size = 10) {
  return `BT /F2 ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleString('zh-CN');
  if (Array.isArray(value)) return value.map(formatValue).join('、');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}：${formatValue(item)}`)
      .join('；');
  }
  return String(value);
}

function wrapText(text: string, maxChars = 38) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return [clean];
  const lines: string[] = [];
  for (let index = 0; index < clean.length; index += maxChars) {
    lines.push(clean.slice(index, index + maxChars));
  }
  return lines;
}

function contextLines(context: Record<string, unknown>) {
  return Object.entries(context)
    .flatMap(([key, value]) => wrapText(`${key}：${formatValue(value)}`))
    .slice(0, 18);
}

function agreementLines(context: Record<string, unknown>) {
  const declarationType = context.declarationType === 'honor' ? '荣誉称号申报' : '奖学金申报';
  return [
    '班级奖学金与荣誉称号申报确认协议',
    '',
    '本人作为本班申报负责人，已根据学院通知和系统筛选结果，对本班奖学金与荣誉称号申报信息进行核对。',
    '本人确认本次申报学生符合系统展示的数字条件，申报材料真实、完整、准确。',
    '本班申报结果已经按照学院要求完成班内核对和公示，相关问题由班级申报负责人配合学院说明。',
    '',
    `申报类型：${declarationType}`,
    ...contextLines(context).filter((line) => !line.startsWith('checklist')),
  ];
}

function scoreReviewLines(context: Record<string, unknown>) {
  return [
    '班级综合素质测评审核小组确认书',
    '',
    '本班综合素质测评审核小组已共同核对本班学生综测分数。',
    '审核小组确认本班学生德育分、学业分、创新分、体育相关分数、美育分、劳动教育分、公益服务分、附加分、社区表现分及综测总分真实无误。',
    '本确认书可作为奖学金与荣誉称号申报依据。',
    '',
    ...contextLines(context),
  ];
}

function genericLines(data: {
  pdfType: string;
  businessType: string;
  businessId: number;
  context: Record<string, unknown>;
}) {
  return [
    '奖学金与荣誉称号申报系统 PDF 材料',
    '',
    `材料类型：${data.pdfType}`,
    `业务记录：${data.businessType} #${data.businessId}`,
    ...contextLines(data.context),
  ];
}

function linesForPdf(data: {
  pdfType: string;
  businessType: string;
  businessId: number;
  context: Record<string, unknown>;
}) {
  if (data.pdfType === 'monitor_agreement') return agreementLines(data.context);
  if (data.pdfType === 'score_review_confirmation') return scoreReviewLines(data.context);
  return genericLines(data);
}

function parsePngSize(buffer: Buffer) {
  const pngHeader = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngHeader) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function paethPredictor(left: number, up: number, upLeft: number) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function parsePngImage(buffer: Buffer): Omit<PdfSignatureImage, 'id'> | null {
  const size = parsePngSize(buffer);
  if (!size) return null;

  const idatChunks: Buffer[] = [];
  const colorType = buffer.readUInt8(25);
  const bitDepth = buffer.readUInt8(24);
  const interlace = buffer.readUInt8(28);
  if (bitDepth !== 8 || interlace !== 0) return null;

  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const start = offset + 8;
    const end = start + length;
    if (type === 'IDAT') idatChunks.push(buffer.subarray(start, end));
    offset = end + 4;
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels || idatChunks.length === 0) return null;

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const sourceRowLength = size.width * channels;
  const decoded = Buffer.alloc(size.height * sourceRowLength);
  let sourceOffset = 0;

  for (let row = 0; row < size.height; row += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = row * sourceRowLength;
    const previousRowStart = rowStart - sourceRowLength;
    for (let column = 0; column < sourceRowLength; column += 1) {
      const rawValue = inflated[sourceOffset];
      sourceOffset += 1;
      const left = column >= channels ? decoded[rowStart + column - channels] : 0;
      const up = row > 0 ? decoded[previousRowStart + column] : 0;
      const upLeft = row > 0 && column >= channels ? decoded[previousRowStart + column - channels] : 0;
      const value = filter === 0
        ? rawValue
        : filter === 1
          ? rawValue + left
          : filter === 2
            ? rawValue + up
            : filter === 3
              ? rawValue + Math.floor((left + up) / 2)
              : rawValue + paethPredictor(left, up, upLeft);
      decoded[rowStart + column] = value & 0xff;
    }
  }

  const rgb = Buffer.alloc(size.width * size.height * 3);
  for (let pixel = 0; pixel < size.width * size.height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 3;
    if (channels === 1) {
      rgb[target] = decoded[source];
      rgb[target + 1] = decoded[source];
      rgb[target + 2] = decoded[source];
      continue;
    }
    const alpha = channels === 4 ? decoded[source + 3] / 255 : 1;
    rgb[target] = Math.round(decoded[source] * alpha + 255 * (1 - alpha));
    rgb[target + 1] = Math.round(decoded[source + 1] * alpha + 255 * (1 - alpha));
    rgb[target + 2] = Math.round(decoded[source + 2] * alpha + 255 * (1 - alpha));
  }

  return {
    width: size.width,
    height: size.height,
    buffer: deflateSync(rgb),
    filter: 'FlateDecode',
  };
}

function parseJpegSize(buffer: Buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    const length = buffer.readUInt16BE(offset);
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  return null;
}

async function loadSignatureImages(signatureFileIds: number[] = []) {
  const images: PdfSignatureImage[] = [];
  for (const id of signatureFileIds) {
    const signature = await prisma.signatureFile.findUnique({
      where: { id },
      include: { croppedFile: true, originalFile: true },
    });
    const storedFileId = signature?.croppedFileId || signature?.originalFileId;
    if (!storedFileId) continue;
    const { file, buffer } = await readStoredFile(storedFileId);
    if (file.mimeType === 'image/png') {
      const image = parsePngImage(buffer);
      if (image) images.push({ id, ...image });
      continue;
    }
    if (file.mimeType === 'image/jpeg') {
      const size = parseJpegSize(buffer);
      if (size) images.push({ id, buffer, width: size.width, height: size.height, filter: 'DCTDecode' });
    }
  }
  return images;
}

export function buildPdfBuffer(data: {
  pdfType: string;
  businessType: string;
  businessId: number;
  context: Record<string, unknown>;
  signatureImages: PdfSignatureImage[];
}) {
  const catalogObjectId = 1;
  const pagesObjectId = 2;
  const pageObjectId = 3;
  const fontObjectId = 4;
  const asciiFontObjectId = 5;
  const cidFontObjectId = 6;
  const firstImageObjectId = 7;
  const imageObjectIds = data.signatureImages.map((_, index) => firstImageObjectId + index);
  const contentObjectId = firstImageObjectId + data.signatureImages.length;

  const commands: string[] = [];
  commands.push('0.92 0.90 0.86 rg');
  commands.push(`0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)} re f`);
  commands.push('1 0.992 0.973 rg');
  commands.push(`${marginX - 18} 58 ${pageWidth - (marginX - 18) * 2} ${pageHeight - 112} re f`);
  commands.push('0.86 0.80 0.72 RG 1 w');
  commands.push(`${marginX - 18} 58 ${pageWidth - (marginX - 18) * 2} ${pageHeight - 112} re S`);
  commands.push('0.60 0.36 0.24 rg');
  commands.push(textCommand('计算机科学与技术学院学术部制作', marginX, 790, 10));
  commands.push(asciiTextCommand(`Generated by HQU-CCES · ${new Date().toISOString()}`, marginX, 70, 8));
  commands.push('0.18 0.16 0.14 rg');

  let y = textTop;
  for (const line of linesForPdf(data)) {
    if (line === '') {
      y -= lineHeight;
      continue;
    }
    const size = y === textTop ? 18 : 11;
    commands.push(textCommand(line, marginX, y, size));
    y -= y === textTop ? 34 : lineHeight;
  }

  if (data.signatureImages.length > 0) {
    commands.push('0.60 0.36 0.24 rg');
    commands.push(textCommand('签名', marginX, 180, 12));
  }

  data.signatureImages.forEach((image, index) => {
    const maxWidth = data.signatureImages.length > 1 ? 150 : 210;
    const maxHeight = 70;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = marginX + index * 170;
    const yPos = 98;
    commands.push('q');
    commands.push(`${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${yPos.toFixed(2)} cm`);
    commands.push(`/Im${index + 1} Do`);
    commands.push('Q');
  });

  const imageResource = data.signatureImages
    .map((_, index) => `/Im${index + 1} ${imageObjectIds[index]} 0 R`)
    .join(' ');
  const content = commands.join('\n');
  const pageResources = `<< /Font << /F1 ${fontObjectId} 0 R /F2 ${asciiFontObjectId} 0 R >>${imageResource ? ` /XObject << ${imageResource} >>` : ''} >>`;
  const objectBodies = new Map<number, Buffer>();
  objectBodies.set(catalogObjectId, Buffer.from(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`, 'binary'));
  objectBodies.set(pagesObjectId, Buffer.from(`<< /Type /Pages /Kids [${pageObjectId} 0 R] /Count 1 >>`, 'binary'));
  objectBodies.set(pageObjectId, Buffer.from(`<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources ${pageResources} /Contents ${contentObjectId} 0 R >>`, 'binary'));
  objectBodies.set(fontObjectId, Buffer.from(`<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontObjectId} 0 R] >>`, 'binary'));
  objectBodies.set(asciiFontObjectId, Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'binary'));
  objectBodies.set(cidFontObjectId, Buffer.from('<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> >>', 'binary'));
  objectBodies.set(contentObjectId, Buffer.from(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`, 'utf8'));
  data.signatureImages.forEach((image, index) => {
    const imageObjectId = imageObjectIds[index];
    objectBodies.set(imageObjectId, Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${image.filter} /Length ${image.buffer.length} >>\nstream\n`, 'binary'),
      image.buffer,
      Buffer.from('\nendstream', 'binary'),
    ]));
  });

  const objectCount = contentObjectId;
  const finalObjects = Array.from({ length: objectCount }, (_, index) => {
    const objectNumber = index + 1;
    const object = objectBodies.get(objectNumber);
    if (!object) throw new Error(`PDF对象缺失：${objectNumber}`);
    return Buffer.concat([
      Buffer.from(`${objectNumber} 0 obj\n`, 'binary'),
      object,
      Buffer.from('\nendobj\n', 'binary'),
    ]);
  });

  const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary');
  const offsets: number[] = [0];
  let position = header.length;
  for (const object of finalObjects) {
    offsets.push(position);
    position += object.length;
  }

  const body = Buffer.concat(finalObjects);
  const xrefOffset = header.length + body.length;
  const xref = [
    'xref',
    `0 ${finalObjects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${finalObjects.length + 1} /Root ${catalogObjectId} 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');

  return Buffer.concat([header, body, Buffer.from(xref, 'binary')]);
}

export async function generatePdfMaterial(data: {
  pdfType: string;
  businessType: string;
  businessId: number;
  context: Record<string, unknown>;
  generatedBy?: number;
  signatureFileIds?: number[];
}) {
  const signatureImages = await loadSignatureImages(data.signatureFileIds);
  const buffer = buildPdfBuffer({ ...data, signatureImages });
  const storedFile = await saveStoredFile({
    buffer,
    fileName: `${data.pdfType}-${data.businessId}.pdf`,
    fileType: 'pdf',
    mimeType: 'application/pdf',
    createdBy: data.generatedBy,
  });
  const pdf = await prisma.pdfFile.create({
    data: {
      storedFileId: storedFile.id,
      pdfType: data.pdfType,
      templateVersion: 1,
      businessType: data.businessType,
      businessId: data.businessId,
      generatedBy: data.generatedBy,
    },
    include: { storedFile: true },
  });

  await recordAuditLog({
    module: 'pdf',
    action: 'generate_pdf',
    actorId: data.generatedBy,
    targetType: 'PdfFile',
    targetId: pdf.id,
    after: {
      pdfType: data.pdfType,
      businessType: data.businessType,
      businessId: data.businessId,
      signatureFileIds: data.signatureFileIds || [],
    },
  });

  return pdf;
}

export async function getPdfMaterial(id: number) {
  return prisma.pdfFile.findUnique({
    where: { id },
    include: { storedFile: true },
  });
}

export async function canAccessPdfMaterial(data: {
  pdfId: number;
  role: string;
  classId?: number | null;
}) {
  if (data.role === 'admin') return true;
  if (!data.classId) return false;

  const pdf = await prisma.pdfFile.findUnique({ where: { id: data.pdfId } });
  if (!pdf) return false;

  if (pdf.businessType === 'declaration_batch') {
    const batch = await prisma.declarationBatch.findUnique({
      where: { id: pdf.businessId },
      select: { classId: true },
    });
    return batch?.classId === data.classId;
  }

  if (pdf.businessType === 'score_review') {
    const record = await prisma.scoreReviewRecord.findUnique({
      where: { id: pdf.businessId },
      select: { classId: true },
    });
    return record?.classId === data.classId;
  }

  return false;
}
