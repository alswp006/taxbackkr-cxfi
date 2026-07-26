/**
 * Packet HEAL-1-01: 앱 루트 단일화: Router + 전역 Provider 1회 마운트
 *
 * main.tsx는 createRoot + <App/> 렌더(+ 앵커된 TDSMobileAITProvider/BrowserRouter)만 담당하고,
 * App.tsx가 전역 Provider(useTaxData/체크리스트 컨텍스트)를 <Routes> 상위에 정확히 한 번 감싼 뒤
 * 6개 라우트 + FloatingTabBar를 렌더하도록 진입 트리를 단일화한다.
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

// 전역 Provider(TaxDataProvider)는 실제 훅(useTaxData/useChecklistData)을 타지 않고,
// "정확히 한 번 마운트되어 Routes 상위에 위치하는지"만 구조적으로 검증하기 위해
// 마운트 카운터가 달린 경량 스텁으로 대체한다.
let providerMountCount = 0;
vi.mock("@/components/TaxDataProvider", () => ({
  TaxDataProvider: ({ children }: { children: React.ReactNode }) => {
    React.useEffect(() => {
      providerMountCount += 1;
    }, []);
    return React.createElement(
      "div",
      { "data-testid": "provider-boundary" },
      children,
    );
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

beforeEach(() => {
  providerMountCount = 0;
});

describe("앱 루트 단일화: Router + 전역 Provider 1회 마운트", () => {
  it("AC-1[P0]: main.tsx는 앵커된 TDSMobileAITProvider/BrowserRouter를 유지하며 <App/> 렌더만 담당한다", () => {
    expect(MAIN_SOURCE).toMatch(/@AI:ANCHOR/);
    expect(MAIN_SOURCE).toMatch(/TDSMobileAITProvider/);
    expect(MAIN_SOURCE).toMatch(/BrowserRouter/);
    expect(MAIN_SOURCE).toMatch(/<App\s*\/>/);
    // createRoot(...).render(...) 형태여야 한다 — App 렌더 자체가 없으면 안 됨
    expect(MAIN_SOURCE).toMatch(/createRoot/);
  });

  it("AC-1[P0]: main.tsx는 자체 라우트 정의나 앱 전용 전역 Provider를 중복 선언하지 않는다", () => {
    // 라우팅 테이블(<Routes>/<Route>)은 App.tsx(또는 routes.tsx) 소유 — main.tsx에 없어야 함
    expect(MAIN_SOURCE).not.toMatch(/<Routes[\s>]/);
    expect(MAIN_SOURCE).not.toMatch(/<Route\s/);
    // 앱 전용 데이터 Provider(TaxDataProvider/AppProviders)는 App.tsx에서 한 번만 감싸야 함
    expect(MAIN_SOURCE).not.toMatch(/TaxDataProvider/);
    expect(MAIN_SOURCE).not.toMatch(/AppProviders/);
  });

  it("AC-2[P0]: 전역 Provider가 트리에서 정확히 한 번 마운트되고 <Routes> 상위에 위치한다", () => {
    renderAppAt("/");

    expect(providerMountCount).toBe(1);
    const boundary = screen.getByTestId("provider-boundary");
    // 라우팅된 페이지 콘텐츠가 Provider 경계 내부(하위)에서 렌더되어야 Provider가 Routes보다 위에 있는 것
    expect(within(boundary).getByRole("heading", { name: ROUTE_TITLES["/"] })).toBeInTheDocument();
  });

  it("AC-2[P0]: 탭 이동으로 라우트가 여러 번 바뀌어도 전역 Provider는 재마운트되지 않는다(싱글턴)", () => {
    renderAppAt("/");
    expect(providerMountCount).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: "체크리스트" }));
    expect(screen.getByRole("heading", { name: ROUTE_TITLES["/checklist"] })).toBeInTheDocument();
    expect(providerMountCount).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: "기록" }));
    expect(screen.getByRole("heading", { name: ROUTE_TITLES["/records"] })).toBeInTheDocument();
    expect(providerMountCount).toBe(1);
  });

  it("AC-3[P0]: 6개 라우트 전부 실제 페이지 컴포넌트로 배선되어 각 고유 타이틀을 렌더한다", () => {
    for (const routePath of EXPECTED_ROUTES) {
      const { unmount } = renderAppAt(routePath);
      expect(screen.getByRole("heading", { name: ROUTE_TITLES[routePath] })).toBeInTheDocument();
      unmount();
    }
  });

  it("AC-3[P0]: 정의되지 않은 경로는 크래시 없이 홈으로 리다이렉트된다", () => {
    const { container } = renderAppAt("/no-such-route-zzz");

    expect(container.innerHTML.length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: ROUTE_TITLES["/"] })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "홈" })).toHaveAttribute("aria-selected", "true");
  });

  it("AC-3[P1]: 탭-루트 화면(홈/체크리스트/기록)에 FloatingTabBar가 정확히 3개 탭으로 표시된다", () => {
    renderAppAt("/");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(TAB_ROOT_LABELS.length);
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual(TAB_ROOT_LABELS);
    expect(screen.getByRole("tab", { name: "홈" })).toHaveAttribute("aria-selected", "true");
  });

  it("AC-4: 전체 라우트 스모크 — 6개 라우트 + fallback이 콘솔 에러 없이 타임아웃 없이 통과한다", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    for (const routePath of [...EXPECTED_ROUTES, "/unknown-smoke-path"]) {
      const { container, unmount } = renderAppAt(routePath);
      expect(container.innerHTML.length).toBeGreaterThan(0);
      unmount();
    }

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
