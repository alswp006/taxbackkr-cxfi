/**
 * Packet HEAL-2-01: 앱 루트 단일 부팅 경로 확정: Router·Provider 1회 마운트
 *
 * main.tsx/App.tsx를 단일 진입점으로 정리한다. BrowserRouter(또는 RouterProvider)를 정확히
 * 한 번만 마운트하고, 전역 Context Provider를 Router 상위에서 한 번만 감싼다. 0014와 0016에
 * 흩어진 중복 Router/Provider 선언을 제거하고 heal-1-01이 만든 단일 루트로 일원화한다.
 * Routes에 /, /result, /simulate, /checklist, /records, /analysis 6개를 모두 등록하고,
 * FloatingTabBar(홈/체크리스트/기록)를 Router 컨텍스트 내부에서 렌더한다.
 *
 * TDD Red Phase — 아래 테스트는 구현이 완결되기 전에는 실패할 수 있다 (의도적).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

// 라우팅 통합 테스트이므로 react-router-dom 자체는 목킹하지 않는다(실제 useNavigate/useLocation 필요).
// TDS + SDK + reward-ad 게이트만 목킹 — jsdom 크래시 방지.
mockTds();
mockAppsInToss();
mockTossRewardAd();

// 전역 Provider는 실제 훅을 타지 않고, "정확히 한 번 마운트되어 Routes 상위에 위치하는지"만
// 구조적으로 검증하기 위해 마운트 카운터가 달린 경량 스텁으로 대체한다.
let providerMountCount = 0;
vi.mock("@/components/TaxDataProvider", () => ({
  TaxDataProvider: ({ children }: { children: React.ReactNode }) => {
    React.useEffect(() => {
      providerMountCount += 1;
    }, []);
    return React.createElement("div", { "data-testid": "provider-boundary" }, children);
  },
  useTaxContext: () => ({}),
}));

import App from "@/App";

const SRC_ROOT = path.join(process.cwd(), "src");
const MAIN_SOURCE = fs.readFileSync(path.join(SRC_ROOT, "main.tsx"), "utf-8");

const ROUTE_TITLES: Record<string, string> = {
  "/": "세금 환급 계산",
  "/result": "환급 결과",
  "/analysis": "절세 상세 분석",
  "/simulate": "공제 시뮬레이션",
  "/checklist": "절세 체크리스트",
  "/records": "기록 & 비교",
};
const EXPECTED_ROUTES = Object.keys(ROUTE_TITLES);
const TAB_ROOT_LABELS = ["홈", "체크리스트", "기록"];

function renderAppAt(initialPath: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [initialPath] }, React.createElement(App)),
  );
}

// 전체 src 트리(테스트 파일 제외)를 재귀 탐색해 .ts/.tsx 소스 파일 목록을 수집한다.
// 0014/0016류 잔재 Router/Provider 선언이 어디에 남아있든 탐지할 수 있도록 한다.
function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      files = files.concat(collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const ALL_SOURCE_FILES = collectSourceFiles(SRC_ROOT);

beforeEach(() => {
  providerMountCount = 0;
});

describe("앱 루트 단일 부팅 경로 확정: Router·Provider 1회 마운트", () => {
  it("AC-1[P0]: main.tsx가 BrowserRouter를 정확히 한 번만 선언한다", () => {
    const browserRouterOpenTags = MAIN_SOURCE.match(/<BrowserRouter[\s>]/g) ?? [];
    expect(browserRouterOpenTags.length).toBe(1);
    expect(MAIN_SOURCE).toMatch(/createRoot/);
    expect(MAIN_SOURCE).toMatch(/<App\s*\/>/);
  });

  it("AC-1[P0]: 전역 Provider가 트리에서 정확히 한 번 마운트되고 <Routes> 상위(하위 콘텐츠를 감싸는 위치)에 있다", () => {
    renderAppAt("/");

    expect(providerMountCount).toBe(1);
    const boundary = screen.getByTestId("provider-boundary");
    expect(within(boundary).getByRole("heading", { name: ROUTE_TITLES["/"] })).toBeInTheDocument();
  });

  it("AC-2[P0]: BrowserRouter/RouterProvider 선언이 src 전체에서 main.tsx 한 곳에만 존재한다(0014/0016 중복 제거)", () => {
    const filesWithRouterDeclaration = ALL_SOURCE_FILES.filter((file) => {
      const source = fs.readFileSync(file, "utf-8");
      return /<BrowserRouter[\s>]|<RouterProvider[\s>]/.test(source);
    });

    expect(filesWithRouterDeclaration).toEqual([path.join(SRC_ROOT, "main.tsx")]);
  });

  it("AC-2[P0]: createRoot(...).render(...) 호출이 src 전체에서 정확히 한 번만 존재한다", () => {
    const filesWithCreateRoot = ALL_SOURCE_FILES.filter((file) => {
      const source = fs.readFileSync(file, "utf-8");
      return /createRoot\s*\(/.test(source);
    });

    expect(filesWithCreateRoot).toEqual([path.join(SRC_ROOT, "main.tsx")]);
  });

  it("AC-2: 전역 데이터 Provider(TaxDataProvider/AppProviders) JSX 마운트가 App.tsx(또는 그 하위 provider 조립 파일) 한 곳에서만 이뤄지고, 페이지 컴포넌트에는 없다", () => {
    const pageFiles = fs.readdirSync(path.join(SRC_ROOT, "pages")).filter((f) => f.endsWith(".tsx"));
    for (const pageFile of pageFiles) {
      const source = fs.readFileSync(path.join(SRC_ROOT, "pages", pageFile), "utf-8");
      expect(source).not.toMatch(/<TaxDataProvider[\s>]/);
      expect(source).not.toMatch(/<AppProviders[\s>]/);
    }
    // main.tsx도 앱 전용 Provider를 중복 마운트하지 않아야 한다
    expect(MAIN_SOURCE).not.toMatch(/TaxDataProvider/);
    expect(MAIN_SOURCE).not.toMatch(/AppProviders/);
  });

  it("AC-3[P0]: 6개 라우트 전부 실제 페이지 컴포넌트로 배선되어 각 고유 타이틀을 렌더한다", () => {
    for (const routePath of EXPECTED_ROUTES) {
      const { unmount } = renderAppAt(routePath);
      expect(screen.getByRole("heading", { name: ROUTE_TITLES[routePath] })).toBeInTheDocument();
      unmount();
    }
  });

  it("AC-3[P0]: 전체 라우트 스모크(6개 + fallback)가 콘솔 에러 없이 타임아웃 없이 통과한다", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    for (const routePath of [...EXPECTED_ROUTES, "/unknown-smoke-path-heal-2-01"]) {
      const { container, unmount } = renderAppAt(routePath);
      expect(container.innerHTML.length).toBeGreaterThan(0);
      unmount();
    }

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("AC-4[P0]: FloatingTabBar가 Router 컨텍스트 내부에서 3개 탭으로 렌더되고, 탭 클릭 시 해당 라우트로 이동한다", () => {
    renderAppAt("/");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(TAB_ROOT_LABELS.length);
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual(TAB_ROOT_LABELS);

    fireEvent.click(screen.getByRole("tab", { name: "체크리스트" }));
    expect(screen.getByRole("heading", { name: ROUTE_TITLES["/checklist"] })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "체크리스트" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "기록" }));
    expect(screen.getByRole("heading", { name: ROUTE_TITLES["/records"] })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "기록" })).toHaveAttribute("aria-selected", "true");
  });

  it("AC-4: 정의되지 않은 경로는 크래시 없이 홈으로 리다이렉트되고 탭바가 홈을 활성 표시한다", () => {
    const { container } = renderAppAt("/no-such-route-heal-2-01");

    expect(container.innerHTML.length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: ROUTE_TITLES["/"] })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "홈" })).toHaveAttribute("aria-selected", "true");
  });
});
