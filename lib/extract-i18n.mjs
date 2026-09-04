#!/usr/bin/env node
/**
 * extract-i18n.mjs — upstream i18n 리소스 추출기
 *
 * frontend/src/shared/i18n/index.ts 를 안전한 샌드박스에서 평가하여
 * Object.assign 블록까지 모두 반영된 최종 resources 트리를 JSON 으로 내보낸다.
 *
 * 사용법:
 *   node extract-i18n.mjs <repoRoot> [outJson]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

export function countLeaves(node) {
  if (node === null || typeof node !== "object") return 1;
  return Object.values(node).reduce((sum, value) => sum + countLeaves(value), 0);
}

export function extractResources(repoRoot) {
  const i18nPath = path.join(repoRoot, "frontend", "src", "shared", "i18n", "index.ts");
  let src = readFileSync(i18nPath, "utf8");

  // import/export 는 샌드박스에서 스텁으로 대체한다.
  let body = src.replace(/^import[^\n]*$/gm, "").replace(/^export[^\n]*$/gm, "");

  // 가능하면 frontend/node_modules 의 실제 TypeScript 컴파일러를 사용하고,
  // 없으면 이 파일의 제한된 TS 문법만 제거하는 정규식 폴백을 쓴다.
  let compiler = "regex";
  try {
    const require = createRequire(path.join(repoRoot, "frontend", "package.json"));
    const ts = require("typescript");
    body = ts.transpileModule(body, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    compiler = "typescript";
  } catch {
    body = body
      .replace(/ as const\b/g, "")
      .replace(/ as unknown as Record<[^,>]+,\s*[^>]+>/g, "")
      .replace(/ as unknown as [A-Za-z_$][\w$.[\]]*/g, "")
      .replace(/\)\s*:\s*(?:void|string\s*\|\s*null)\s*\{/g, ") {")
      .replace(/\(([A-Za-z_$][\w$]*)\s*:\s*string\)/g, "($1)");
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    window: undefined,
    document: undefined,
  };
  vm.createContext(sandbox);
  try {
    vm.runInContext(
      `
      const i18n = { use: () => ({ init: () => {} }), on: () => {}, language: "zh-CN" };
      const initReactI18next = { type: "3rdParty", init: () => {} };
${body}
      module.exports.resources = resources;
      `,
      sandbox,
      { filename: "i18n-index.virtual.js" },
    );
  } catch (error) {
    throw new Error(`i18n 모듈 평가 실패 (${compiler} 경로): ${error && error.stack ? error.stack : error}`);
  }

  const resources = sandbox.module.exports.resources;
  const zhLeaves = resources?.["zh-CN"]?.translation ? countLeaves(resources["zh-CN"].translation) : 0;
  const enLeaves = resources?.en?.translation ? countLeaves(resources.en.translation) : 0;
  if (zhLeaves < 500 || enLeaves < 500) {
    throw new Error(
      `추출 결과가 비정상입니다 (zh-CN=${zhLeaves}, en=${enLeaves} leaves). upstream 구조 변경 가능성이 있으니 확인이 필요합니다.`,
    );
  }
  return { resources, compiler, zhLeaves, enLeaves };
}

function sortDeep(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
  return out;
}

export function flatten(node, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") flatten(value, p, out);
    else out[p] = value;
  }
  return out;
}

// CLI 로 실행된 경우: JSON 파일로 덤프한다.
if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
  const outPath = path.resolve(process.argv[3] ?? "i18n-resources.json");
  const { resources, compiler, zhLeaves, enLeaves } = extractResources(repoRoot);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(sortDeep(resources), null, 2)}\n`);
  console.error(
    `추출 완료 (compiler=${compiler}) — zh-CN ${zhLeaves} / en ${enLeaves} leaves → ${outPath}`,
  );
}
