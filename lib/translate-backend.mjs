#!/usr/bin/env node
/**
 * translate-backend.mjs — backend Go 소스의 중국어 문자열 리터럴을 한국어로 치환한다.
 *
 * 전략:
 *   1. Go 파일: 상태 머신으로 문자열/원시문자열 리터럴만 다루고 주석은 그대로 둔다.
 *      - ko-backend.json + ko-backend-parts/*.json 정확 매칭
 *      - 미등록 시 ko-backend-phrases.json 구문 치환 (긴 구문 우선)
 *      - 결과에 중국어 잔여 또는 Go 형식 동사(%s/%d/…) 집합 불일치 시 원문 유지
 *   2. backend/docs/*(swagger): 거대 JSON 리터럴은 원문 텍스트 치환으로 처리
 *      (이스케이프 안전성 검사 포함)
 *
 * 사용법: node lib/translate-backend.mjs <targetRepoRoot>
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2];
const exact = {};
{
  const partsDir = join(here, "..", "ko-backend-parts");
  const sources = [join(here, "..", "ko-backend.json")];
  if (existsSync(partsDir)) {
    for (const f of readdirSync(partsDir).filter((x) => x.endsWith(".json")).sort()) {
      sources.push(join(partsDir, f));
    }
  }
  for (const src of sources) Object.assign(exact, JSON.parse(readFileSync(src, "utf8")));
}
const phraseEntries = Object.entries(
  JSON.parse(readFileSync(join(here, "..", "ko-backend-phrases.json"), "utf8")),
).sort((a, b) => b[0].length - a[0].length);

const hasZh = (s) => /[\u4e00-\u9fff]/.test(s);
const verbs = (s) => (String(s).match(/%[a-zA-Z]/g) ?? []).sort().join(",");

function translate(value) {
  if (exact[value] !== undefined) return exact[value];
  let out = value;
  for (const [zh, ko] of phraseEntries) out = out.split(zh).join(ko);
  return out;
}

// swagger 문서(docs.go 안의 거대 JSON 리터럴 등)는 문자열 단위 스캔이 어려워
// 원문 텍스트 치환으로 처리한다. 이스케이프 안전성을 검사한 뒤에만 적용한다.
function translateDocs(repoRoot, exact2, phrasePairs) {
  const docsDir = join(repoRoot, "backend", "docs");
  if (!existsSync(docsDir)) return { hits: 0 };
  let hits = 0;
  for (const name of readdirSync(docsDir)) {
    if (!/\.(go|json|yaml)$/.test(name)) continue;
    const p = join(docsDir, name);
    const cur = readFileSync(p, "utf8");
    // 중국어 + CJK 문장부호로 시작하는 구간. 이스케이프(\\.)는 구간 내에서 허용.
    const next = cur.replace(
      /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef](?:\\.|[^"'`\\])*[\u4e00-\u9fff\u3000-\u303f\uff00-\uffefA-Za-z0-9%.)\]]|[\u4e00-\u9fff]/g,
      (seg) => {
        if (exact2[seg] !== undefined) return exact2[seg];
        let out = seg;
        for (const [zh, ko] of phrasePairs) out = out.split(zh).join(ko);
        const unescapedQuote = /(^|[^\\])["`]/.test(out);
        const strayBackslash = /\\(?!")/.test(out);
        if (hasZh(out) || unescapedQuote || strayBackslash) return seg;
        hits += 1;
        return out;
      },
    );
    if (next !== cur) writeFileSync(p, next);
  }
  return { hits };
}

export function translateBackend(repoRoot) {
  const backendDir = join(repoRoot, "backend");
  if (!existsSync(backendDir)) return null;
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".go")) files.push(p);
    }
  })(backendDir);

  let exactHits = 0;
  let phraseHits = 0;
  let kept = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    // 상태 머신: 문자열/원시문자열 리터럴만 다루고 주석은 그대로 둔다.
    let out = "";
    let i = 0;
    let changed = false;
    while (i < src.length) {
      const ch = src[i];
      const next = src[i + 1];
      if (ch === "/" && next === "/") {
        const nl = src.indexOf("\n", i);
        const end = nl === -1 ? src.length : nl;
        out += src.slice(i, end);
        i = end;
        continue;
      }
      if (ch === "/" && next === "*") {
        const close = src.indexOf("*/", i + 2);
        const end = close === -1 ? src.length : close + 2;
        out += src.slice(i, end);
        i = end;
        continue;
      }
      if (ch === '"' || ch === "`" || ch === "'") {
        const quote = ch;
        let j = i + 1;
        while (j < src.length) {
          if (quote !== "`" && src[j] === "\\") {
            j += 2;
            continue;
          }
          if (src[j] === quote) break;
          if (quote !== "`" && src[j] === "\n") break; // 미종결 방지
          j += 1;
        }
        if (j >= src.length || src[j] !== quote) {
          out += ch;
          i += 1;
          continue;
        }
        const lit = src.slice(i + 1, j);
        if (quote !== "'" && hasZh(lit)) {
          const translated = translate(lit);
          // \" 이스케이프 쌍은 허용하고, 그 외의 원시 따옴표/백틱은 금지한다.
          const stripped = translated.replace(/\\"/g, "");
          const ok =
            !hasZh(translated) &&
            verbs(translated) === verbs(lit) &&
            !/[`"]/.test(stripped) &&
            !/\\(?!")/.test(translated);
          if (ok && translated !== lit) {
            out += quote + translated + quote;
            if (lit in exact) exactHits += 1;
            else phraseHits += 1;
            changed = true;
          } else {
            out += src.slice(i, j + 1);
            if (!ok) kept += 1;
          }
        } else {
          out += src.slice(i, j + 1);
        }
        i = j + 1;
        continue;
      }
      out += ch;
      i += 1;
    }
    if (changed) writeFileSync(file, out);
  }
  const docs = translateDocs(repoRoot, exact, phraseEntries);
  return { files: files.length, exactHits, phraseHits, keptChinese: kept, docsHits: docs.hits };
}

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = root ?? process.cwd();
  const stats = translateBackend(target);
  if (!stats) {
    console.error("backend 디렉터리를 찾을 수 없습니다.");
    process.exit(1);
  }
  console.log(
    `backend 번역 완료 — 파일 ${stats.files} | 정확 매칭 ${stats.exactHits} | 구문 ${stats.phraseHits} | swagger 문서 ${stats.docsHits} | 원문 유지 ${stats.keptChinese}`,
  );
}
