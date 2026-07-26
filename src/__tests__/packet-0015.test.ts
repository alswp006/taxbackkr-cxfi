import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { SavedRecord, TaxProfile, Deductions } from "@/lib/types";

// TDS + SDK만 목킹 — 라우팅은 실제 react-router-dom(MemoryRouter)을 사용한다.
mockTds();
mockAppsInToss();

import Result from "@/pages/Result";
import Records from "@/pages/Records";

const SRC_ROOT = path.join(process.cwd(), "src");

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function readAllSource(): { path: string; content: string }[] {
  return collectSourceFiles(SRC_ROOT).map((p) => ({
    path: p,
    content: fs.readFileSync(p, "utf-8"),
  }));
}

function renderInRouter(ui: React.ReactElement, initialEntries: string[] = ["/"]) {
  return render(React.createElement(MemoryRouter, { initialEntries }, ui));
}

const PROFILE: TaxProfile = {
  id: "profile-1",
  taxYear: 2025,
  incomeType: "employee",
  annualSalary: 50000000,
  freelanceIncome: 0,
  dependents: 1,
  updatedAt: 1700000000000,
};

const DEDUCTIONS: Deductions = {
  creditCard: 3000000,
  medical: 0,
  education: 0,
  irp: 3000000,
  insurance: 0,
  donation: 0,
};

function makeRecord(taxYear: number, refundAmount: number): SavedRecord {
  return {
    id: `record-${taxYear}`,
    taxYear,
    profile: { ...PROFILE, taxYear },
    deductions: DEDUCTIONS,
    result: {
      taxableIncome: 40000000,
      calculatedTax: 3000000,
      prepaidTax: 3000000 + refundAmount,
      refundAmount,
      breakdown: [],
      needsGlobalFiling: false,
      computedAt: 1700000000000,
    },
    savedAt: 1700000000000 + taxYear,
  };
}

describe("광고 배치 & 전역 규정 감사", () => {
  it("AC-1[P0]: 결과 화면 하단에 env 기반 adGroupId를 가진 AdSlot이 콘텐츠와 겹치지 않게 배치된다", () => {
    seedLocalStorage({
      "taxback:profile": PROFILE,
      "taxback:deductions": DEDUCTIONS,
    });

    const { container } = renderInRouter(React.createElement(Result), ["/result"]);

    const summaryCard = container.querySelector('[data-testid="summary-card"]');
    expect(summaryCard).not.toBeNull();

    const adSlot = container.querySelector("[data-ad-group-id]");
    expect(adSlot).not.toBeNull();
    expect(adSlot?.getAttribute("data-ad-group-id")).toBeTruthy();

    // AdSlot은 SDK가 주입할 빈 leaf 노드여야 한다 — 카드/텍스트 등 콘텐츠를 감싸면 안 됨(비침투적 배치).
    expect(adSlot?.querySelectorAll("[data-testid]").length).toBe(0);

    // 콘텐츠와 겹치지 않도록 summary-card 카드 뒤(문서 순서상 이후)에 위치해야 한다.
    const position = summaryCard!.compareDocumentPosition(adSlot!);
    expect(!!(position & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("AC-1[P0]: 기록 화면의 기록 섹션 사이에 AdSlot이 배치되고 기록 카드를 감싸지 않는다", () => {
    seedLocalStorage({
      "taxback:records": [makeRecord(2024, 500000), makeRecord(2025, 800000)],
    });

    const { container } = renderInRouter(React.createElement(Records), ["/records"]);

    const diffCard = container.querySelector('[data-testid="record-diff-card"]');
    expect(diffCard).not.toBeNull();

    const adSlot = container.querySelector("[data-ad-group-id]");
    expect(adSlot).not.toBeNull();
    expect(adSlot?.getAttribute("data-ad-group-id")).toBeTruthy();
    expect(adSlot?.querySelectorAll("[data-testid]").length).toBe(0);

    // diff 카드와 기록 목록 카드 사이(또는 그 뒤) — diff 카드 문서 순서상 이후에 위치.
    const position = diffCard!.compareDocumentPosition(adSlot!);
    expect(!!(position & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("AC-2[P0]: 전체 소스에 외부 이탈(window.location.href/window.open) 코드가 존재하지 않는다", () => {
    const files = readAllSource();
    const offenders = files.filter(
      (f) => /window\.location\.href\s*=/.test(f.content) || /window\.open\s*\(/.test(f.content),
    );

    expect(offenders.map((f) => f.path)).toEqual([]);
    expect(offenders.length).toBe(0);
  });

  it("AC-2[P0]: 전체 소스에 외부 로그인/결제/광고/분석 SDK(firebase, stripe, amplitude, GA 등)가 존재하지 않는다", () => {
    const forbidden =
      /from\s+['"](firebase|@firebase\/|stripe|@stripe\/|amplitude-js|@amplitude\/|react-ga|react-ga4|@sentry\/|@react-oauth\/|next\/router)['"]|gtag\s*\(|ReactGA\.|google-analytics/i;

    const files = readAllSource();
    const offenders = files.filter((f) => forbidden.test(f.content));

    expect(offenders.map((f) => f.path)).toEqual([]);
    expect(offenders.length).toBe(0);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"),
    );
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const forbiddenPkgNames = ["firebase", "stripe", "amplitude-js", "react-ga", "react-ga4"];
    expect(forbiddenPkgNames.filter((name) => name in deps)).toEqual([]);
  });

  it("AC-3[P0]: Result/Analysis 결과 화면에 '참고용 추정치' 고지가 존재한다", () => {
    const resultSource = fs.readFileSync(path.join(SRC_ROOT, "pages/Result.tsx"), "utf-8");
    const analysisSource = fs.readFileSync(path.join(SRC_ROOT, "pages/Analysis.tsx"), "utf-8");

    expect(resultSource).toMatch(/참고용 추정치/);
    expect(analysisSource).toMatch(/참고용 추정치/);
  });

  it("AC-3[P1]: 전체 소스에 HEX 색상 하드코딩이 0건이다 (TDS/var(--tds-color-*)만 사용)", () => {
    const files = readAllSource();
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/;
    const offenders = files.filter((f) => hexPattern.test(f.content));

    expect(offenders.map((f) => `${f.path}: ${f.content.match(hexPattern)?.[0]}`)).toEqual([]);
    expect(offenders.length).toBe(0);
  });
});
