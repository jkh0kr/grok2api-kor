#!/usr/bin/env node
/** backend Go 파일에서 중국어 문자열 리터럴(주석 제외)을 추출해 빈도와 함께 나열 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith(".go") && !name.endsWith("_test.go")) files.push(p);
  }
})(root);

const hasZh = (s) => /[\u4e00-\u9fff]/.test(s);
const strings = new Map(); // value → count (문자열 리터럴만)
let commentLines = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const isComment = trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
    if (isComment) {
      if (hasZh(line)) commentLines += 1;
      continue; // 주석 안의 따옴표는 문자열로 세지 않는다
    }
    const re = /"((?:[^"\\\n]|\\.)*)"|`([^`\n]*)`/g;
    let m;
    while ((m = re.exec(line))) {
      const v = m[1] ?? m[2] ?? "";
      if (hasZh(v)) strings.set(v, (strings.get(v) ?? 0) + 1);
    }
  }
}
const sorted = [...strings.entries()].sort((a, b) => b[1] - a[1]);
console.log(`파일: ${files.length} | 중국어 문자열(런타임): ${sorted.length}종 ${sorted.reduce((s, [, c]) => s + c, 0)}건 | 중국어 주석 줄: ${commentLines}`);
sorted.forEach(([v, c]) => console.log(`${String(c).padStart(3)}  ${JSON.stringify(v)}`));
