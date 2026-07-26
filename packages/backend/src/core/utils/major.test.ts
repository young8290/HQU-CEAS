import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveMajorName } from './major.js';

test('deriveMajorName strips trailing numeric class suffix', () => {
  assert.equal(deriveMajorName('软件工程2班'), '软件工程');
  assert.equal(deriveMajorName('计算机科学与技术12班'), '计算机科学与技术');
});

test('deriveMajorName trims surrounding whitespace after stripping', () => {
  assert.equal(deriveMajorName('软件工程 3班'), '软件工程');
  assert.equal(deriveMajorName(' 软件工程 '), '软件工程');
});

test('deriveMajorName keeps names without a numeric class suffix', () => {
  // 「班」前无数字时不匹配，原样返回（仅 trim）
  assert.equal(deriveMajorName('智能班'), '智能班');
  assert.equal(deriveMajorName('软件工程'), '软件工程');
});

test('deriveMajorName returns empty string when the whole name is a class number', () => {
  // 现状锁定：整名即「N班」时得到空串，由调用方决定是否回退为原班级名
  assert.equal(deriveMajorName('3班'), '');
});
