import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

// TDS + SDK + reward-ad gate만 목킹 — 라우팅은 실제 react-router-dom(MemoryRouter)을 사용한다.
mockTds();
mockAppsInToss();
mockTossRewardAd();

import App from "@/App";

const SRC_ROOT = path.join(process.cwd(), "src");
const APP_SOURCE = fs.readFileSync(path.join(SRC_ROOT, "App.tsx"), "utf-8");
const MAIN_SOURCE = fs.readFileSync(path.join(SRC_ROOT, "main.tsx"), "utf-8");

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// Extract every literal string argument passed to navigate(...) across src/, e.g. navigate('/result') → "/result"
function collectNavigateTargets(): string[] {
  const files = collectSourceFiles(path.join(SRC_ROOT, "pages")).concat(
    collectSourceFiles(path.join(SRC_ROOT, "components")),
  );
  const targets = new Set<string>();
  const navigateCallPattern = /navigate\(\s*['"`]([^'"`]+)['"`]/g;
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match: RegExpExecArray | null;
    while ((match = navigateCallPattern.exec(content)) !== null) {
      targets.add(match[1]);
    }
  }
  return Array.from(targets);
}

// Extract every path="..." declared as a Route in App.tsx
function collectAppRoutePaths(): string[] {
  const routePattern = /<Route\s+path=["']([^"']+)["']/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = routePattern.exec(APP_SOURCE)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

const EXPECTED_PAGE_ROUTES = ["/", "/result", "/analysis", "/simulate", "/checklist", "/records"];

function renderAppAt(initialPath: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [initialPath] }, React.createElement(App)),
  );
}

describe("라우팅 와이어링 + Provider 연결 + 통합 폴리시", () => {
  it("AC-1[P0]: App.tsx에 6개 페이지(Home/Result/Analysis/Simulate/Checklist/Records) Route가 모두 정의되어 있다", () => {
    const definedPaths = collectAppRoutePaths();

    for (const expectedPath of EXPECTED_PAGE_ROUTES) {
      expect(definedPaths).toContain(expectedPath);
    }
    expect(definedPaths.length).toBeGreaterThanOrEqual(EXPECTED_PAGE_ROUTES.length);

    expect(APP_SOURCE).toMatch(/import\s+Home\s+from\s+['"]\.\/pages\/Home['"]/);
    expect(APP_SOURCE).toMatch(/import\s+Result\s+from\s+['"]\.\/pages\/Result['"]/);
    expect(APP_SOURCE).toMatch(/import\s+Analysis\s+from\s+['"]\.\/pages\/Analysis['"]/);
    expect(APP_SOURCE).toMatch(/import\s+Simulate\s+from\s+['"]\.\/pages\/Simulate['"]/);
    expect(APP_SOURCE).toMatch(/import\s+Checklist\s+from\s+['"]\.\/pages\/Checklist['"]/);
    expect(APP_SOURCE).toMatch(/import\s+Records\s+from\s+['"]\.\/pages\/Records['"]/);
  });

  it("AC-1[P0]: 알 수 없는 경로는 홈으로 리다이렉트하는 fallback Route가 존재한다", () => {
    const { container } = renderAppAt("/unknown-path-xyz");

    // Navigate to="/" replace fallback → 홈 화면 콘텐츠가 렌더되어야 한다.
    expect(container.innerHTML.length).toBeGreaterThan(0);
    expect(APP_SOURCE).toMatch(/<Route\s+path=["']\*["']/);
    expect(APP_SOURCE).toMatch(/<Navigate\s+to=["']\/["']\s+replace/);
  });

  it("AC-2[P0]: 소스 전체에서 navigate()로 이동하는 모든 경로가 App.tsx Route에 정의되어 있다", () => {
    const navigateTargets = collectNavigateTargets();
    const definedPaths = collectAppRoutePaths();

    expect(navigateTargets.length).toBeGreaterThan(0);

    const missingRoutes = navigateTargets.filter((target) => !definedPaths.includes(target));
    expect(missingRoutes).toEqual([]);
  });

  it("AC-2[P1]: FloatingTabBar/페이지에서 사용하는 navigate 대상이 spec의 6개 라우트 집합에 속한다", () => {
    const navigateTargets = collectNavigateTargets();

    for (const target of navigateTargets) {
      expect(EXPECTED_PAGE_ROUTES).toContain(target);
    }
  });

  it("AC-3[P0]: main.tsx에 TDSMobileAITProvider와 BrowserRouter가 그대로 유지되어 있다 (@AI:ANCHOR)", () => {
    expect(MAIN_SOURCE).toMatch(/@AI:ANCHOR/);
    expect(MAIN_SOURCE).toMatch(/TDSMobileAITProvider/);
    expect(MAIN_SOURCE).toMatch(/BrowserRouter/);
    expect(MAIN_SOURCE).toMatch(/from\s+['"]@toss\/tds-mobile-ait['"]/);
    expect(MAIN_SOURCE).toMatch(/from\s+['"]react-router-dom['"]/);
    expect(MAIN_SOURCE).toMatch(/<App\s*\/>/);
  });

  it("AC-4[P0]: 앱이 '/' 경로에서 크래시 없이 정상 렌더링된다", () => {
    const { container } = renderAppAt("/");

    expect(container).not.toBeNull();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("AC-4[P1]: 모든 페이지 라우트(/result, /analysis, /simulate, /checklist, /records)가 크래시 없이 렌더링된다", () => {
    for (const routePath of EXPECTED_PAGE_ROUTES) {
      const { container, unmount } = renderAppAt(routePath);
      expect(container.innerHTML.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it("AC-4[P1]: 홈 화면에는 하단 네비게이션(FloatingTabBar)의 탭 버튼들이 렌더된다", () => {
    renderAppAt("/");

    const tabs = screen.queryAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    expect(tabs.length).toBeLessThanOrEqual(5);
  });
});
