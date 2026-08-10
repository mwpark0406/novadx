#!/usr/bin/env node
/**
 * 자바스크립트 문법 검사 — 화면이 통째로 안 뜨는 사고를 배포 전에 잡는다.
 *
 * 이 저장소는 사이트 하나가 HTML 파일 하나(최대 2.4MB)이고 그 안에 <script>가
 * 여러 개 들어 있다. 한 블록이 깨지면 그 아래 정의가 전부 사라져 화면이 빈다.
 * 정규식으로 블록을 뽑아 vm.Script 로 파싱만 해본다(실행하지 않는다).
 *
 * 현재 12개 파일 전부 파싱 실패 0건이라 기준선도 0이다. 어떤 파일이든
 * 실패가 하나라도 생기면 실패로 본다. 기준선을 바꿔야 할 일이 생기면
 * .github/syntax-baseline.json 을 갱신할 것.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(__dirname, 'syntax-baseline.json');
const baseline = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};

function scan(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const blocks = [...src.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)];
  const bad = [];
  blocks.forEach((b, i) => {
    try { new vm.Script(b[1]); }
    catch (e) {
      const line = src.slice(0, b.index).split('\n').length;
      bad.push({ at: 'block ' + (i + 1) + ' (' + file + ':' + line + ')', msg: String(e.message).slice(0, 90) });
    }
  });
  return { total: blocks.length, bad };
}

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
let worse = false, totalBlocks = 0;

for (const f of files) {
  const r = scan(f);
  totalBlocks += r.total;
  const expected = baseline[f] != null ? baseline[f] : 0;
  const ok = r.bad.length <= expected;
  if (!ok) worse = true;
  console.log((ok ? '통과' : '실패') + '  ' + f.padEnd(20) + ' script ' + String(r.total).padStart(3) + '개 / 파싱 실패 ' + r.bad.length + '개 (기준선 ' + expected + ')');
  if (!ok) r.bad.forEach(x => console.log('        ' + x.at + '  ' + x.msg));
}

console.log('');
if (worse) {
  console.log('문법 오류가 기준선보다 늘었습니다. 방금 수정한 부분을 확인하세요.');
  console.log('구조를 바꿔 기준선이 달라진 것이라면 .github/syntax-baseline.json 을 갱신하세요.');
  process.exit(1);
}
console.log('문법 검사 통과 — ' + files.length + '개 파일 · script ' + totalBlocks + '개');
