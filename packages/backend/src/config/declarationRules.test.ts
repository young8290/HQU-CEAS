import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAgreementSignatureFileId } from './declarationRules.js';

test('requireAgreementSignatureFileId accepts a positive signature file id', () => {
  assert.equal(requireAgreementSignatureFileId(12), 12);
});

test('requireAgreementSignatureFileId rejects missing agreement signature id', () => {
  assert.throws(
    () => requireAgreementSignatureFileId(undefined),
    /班长确认协议签名/,
  );
});
