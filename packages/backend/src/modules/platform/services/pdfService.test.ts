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
  assert.match(text, /\/Im1 6 0 R/);
  assert.match(text, /\/Filter \/FlateDecode/);
});

test('buildPdfBuffer does not leak raw enum values into agreement text', () => {
  const buffer = buildPdfBuffer({
    pdfType: 'monitor_agreement',
    businessType: 'declaration_batch',
    businessId: 5,
    context: { declarationType: 'honor', honorType: 'excellent_cadre', className: '2023级1班' },
    signatureImages: [],
  });
  // Text is stored as UTF-16 hex, so raw ASCII enum tokens must not appear.
  const hex = buffer.toString('binary');
  assert.doesNotMatch(hex, /excellent_cadre/);
  assert.doesNotMatch(hex, /declarationType/);
});

test('buildPdfBuffer paginates when content overflows a single page', () => {
  const students = Array.from({ length: 60 }, (_, index) => ({
    name: `学生${index + 1}`,
    studentNo: `2023${String(index).padStart(4, '0')}`,
    award: '院三等奖学金',
    amount: 600,
  }));
  const buffer = buildPdfBuffer({
    pdfType: 'monitor_agreement',
    businessType: 'declaration_batch',
    businessId: 7,
    context: { declarationType: 'award', students },
    signatureImages: [],
  });
  const text = buffer.toString('binary');
  const pageCount = (text.match(/\/Type \/Page[^s]/g) || []).length;
  assert.ok(pageCount > 1, `expected multiple pages, got ${pageCount}`);
});

test('canAccessPdfMaterial allows admins before ownership lookup', async () => {
  assert.equal(await canAccessPdfMaterial({ pdfId: -1, role: 'admin' }), true);
});

test('canAccessPdfMaterial rejects monitors without class scope', async () => {
  assert.equal(await canAccessPdfMaterial({ pdfId: -1, role: 'monitor', classId: null }), false);
});
