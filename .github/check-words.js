#!/usr/bin/env node
/**
 * 금칙어 검사 — 원본 회사를 특정할 수 있는 표현이 저장소에 들어오는 걸 막는다.
 *
 * 배경: 이 데모는 사내 시스템을 재구성한 것이라, 작업하다 보면 커밋 메시지나
 *       주석에 원본 회사명을 자연스럽게 쓰게 된다. 실제로 이전 저장소에서는
 *       커밋 148개 중 68개에 회사명이 들어갔고, 공개 저장소라 그대로 노출됐다.
 *       한 번 커밋되면 지우기 어려우므로 들어오는 단계에서 막는다.
 *
 * 검사 대상: 추적 중인 모든 파일의 내용 + (git 저장소면) 커밋 메시지 전체
 * 대안 표현: '원본 시스템' · '사내 시스템' · 아예 언급하지 않기
 *
 * 사용: node .github/check-words.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// 원본 회사를 특정할 수 있는 표현들
const BANNED = [
  { re: /원텍/g, why: '원본 회사명(한글)' },
  { re: /wontech/gi, why: '원본 회사명(영문)' },
  { re: /wt-management/gi, why: '원본 조직 저장소' },
  { re: /wt-sites|wtj-management|wt-corps|wt-consumables|wt-receivables/gi, why: '원본 저장소명' },
  { re: /nimichang/gi, why: '회사 이메일 계정' },
  { re: /496-88-01552/g, why: '원본 사업자번호' },
];

const skipFile = f => /^\.github[\\/]check-words\.js$/.test(f);

function listFiles() {
  try {
    return execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    return fs.readdirSync(ROOT).filter(f => fs.statSync(path.join(ROOT, f)).isFile());
  }
}

const hits = [];

for (const f of listFiles()) {
  if (skipFile(f)) continue;
  let src;
  try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
  for (const b of BANNED) {
    const m = src.match(b.re);
    if (m) hits.push({ where: '파일 ' + f, word: m[0], n: m.length, why: b.why });
  }
}

let msgs = '';
try { msgs = execSync('git log --format=%s%n%b', { cwd: ROOT, encoding: 'utf8' }); } catch (e) {}
for (const b of BANNED) {
  const m = msgs.match(b.re);
  if (m) hits.push({ where: '커밋 메시지', word: m[0], n: m.length, why: b.why });
}

function report() {
  console.log('금칙어 검사 — 패턴 ' + BANNED.length + '종');
  if (!hits.length) {
    console.log('통과 — 원본 회사를 특정할 표현이 없습니다.');
    return 0;
  }
  console.log('');
  console.log('실패 ' + hits.length + '건 — 아래 표현이 들어왔습니다.');
  for (const h of hits) console.log('  [' + h.where + '] "' + h.word + '" ' + h.n + '건 — ' + h.why);
  console.log('');
  console.log("'원본 시스템'·'사내 시스템' 같은 중립 표현으로 바꾸거나 아예 빼세요.");
  console.log('이미 커밋된 메시지는 되돌리기 어려우니 커밋 전에 확인하는 게 좋습니다.');
  return 1;
}

module.exports = { report, hits };
if (require.main === module) process.exit(report());
