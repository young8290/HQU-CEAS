import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfBuffer, canAccessPdfMaterial } from './pdfService.js';

test('buildPdfBuffer creates a valid PDF object structure', () => {
  const buffer = buildPdfBuffer({
    pdfType: 'monitor_agreement',
    businessType: 'declaration_batch',
    businessId: 12,
    context: { declarationType: 'award', className: '2023级计算机科学与技术1班' },
    signatureImages: [],
  });
  const text = buffer.toString('binary');

  assert.equal(text.slice(0, 8), '%PDF-1.4');
  assert.match(text, /1 0 obj/);
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /xref/);
  assert.match(text, /startxref/);
  assert.match(text, /%%EOF/);
});

test('buildPdfBuffer embeds signature image XObject when provided', () => {
  const imageData = Buffer.from([120, 156, 99, 248, 207, 192, 0, 0, 3, 1, 1, 0]);
  const buffer = buildPdfBuffer({
    pdfType: 'score_review_confirmation',
    businessType: 'score_review',
    businessId: 3,
    context: { memberCount: 1 },
    signatureImages: [{ id: 1, buffer: imageData, width: 1, height: 1, filter: 'FlateDecode' }],
  });
  const text = buffer.toString('binary');

  assert.match(text, /\/Subtype \/Image/);
  assert.match(text, /\/Im1 7 0 R/);
  assert.match(text, /\/Filter \/FlateDecode/);
});

test('canAccessPdfMaterial allows admins before ownership lookup', async () => {
  assert.equal(await canAccessPdfMaterial({ pdfId: -1, role: 'admin' }), true);
});

test('canAccessPdfMaterial rejects monitors without class scope', async () => {
  assert.equal(await canAccessPdfMaterial({ pdfId: -1, role: 'monitor', classId: null }), false);
});
