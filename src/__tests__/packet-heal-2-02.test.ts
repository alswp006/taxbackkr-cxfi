/**
 * Packet HEAL-2-02: 절세 상세 분석 페이지(/analysis) 리워드 게이팅 완결
 *
 * heal-1-03/heal-2-01이 각각 /analysis 단독 렌더와 라우터 배선을 검증했지만, 실제 프로덕션
 * 트리(App.tsx → AppProviders → TaxDataProvider(진짜) → Routes)를 통해 /analysis에 진입했을 때
 * 리워드 게이팅과 Provider 데이터 소스(프로필/공제) 소비가 끝까지 맞물려 동작하는지는 아직
 * 검증되지 않았다. 이 패킷은 TaxDataProvider를 스텁으로 대체하지 않고 실제로 마운트한 채
 * /analysis 전체 플로우(게이트 → 광고 시청 → 상세 분석 노출)를 검증한다.
 *
 * TDD Red Phase — 구현이 완결되지 않았거나 회귀가 있다면 아래 테스트가 실패할 수 있다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";
import type { TaxProfile, Deductions } from "@/lib/types";

// 실제 라우팅 + 실제 TaxDataProvider를 태우는 통합 테스트이므로 react-router-dom과
// TaxDataProvider는 목킹하지 않는다. TDS(jsdom 크래시 방지)와 SDK(imperative 광고 API)만 목킹.
mockTds();
mockAppsInToss();

import App from "@/App";
import Analysis from "@/pages/Analysis";

const mockLoadFullScreenAd = vi.mocked(loadFullScreenAd);
const mockShowFullScreenAd = vi.mocked(showFullScreenAd);

const SRC_ROOT = path.join(process.cwd(), "src");
const ANALYSIS_SOURCE = fs.readFileSync(path.join(SRC_ROOT, "pages/Analysis.tsx"), "utf-8");

function makeProfile(overrides: Partial<TaxProfile> = {}): TaxProfile {
  return {
    id: "profile-heal-2-02",
    taxYear: 2025,
    incomeType: "employee",
    annualSalary: 50000000,
    freelanceIncome: 0,
    dependents: 0,
    updatedAt: 1234567890,
    ...overrides,
  };
}

const MIXED_DEDUCTIONS: Deductions = {
  creditCard: 1200000,
  medical: 4000000,
  education: 0,
  irp: 9000000,
  insurance: 0,
  donation: 0,
};

function seedMixed() {
  seedLocalStorage({
    "taxback:profile": makeProfile(),
    "taxback:deductions": MIXED_DEDUCTIONS,
  });
}

function renderAppAt(initialPath: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [initialPath] }, React.createElement(App)),
  );
}

describe("/analysis 리워드 게이팅 완결 (heal-1-03 마감, heal-2-02)", () => {
  beforeEach(() => {
    mockLoadFullScreenAd.mockClear();
    mockShowFullScreenAd.mockClear();
    mockLoadFullScreenAd.mockImplementation((opts: any) => opts.onEvent?.({ type: "loaded" }));
    mockShowFullScreenAd.mockImplementation((opts: any) => opts.onEvent?.({ type: "rewarded" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-1[P0]: /analysis가 실제 App 트리(진짜 TaxDataProvider 포함)에서 크래시 없이 로드되고 타이틀을 렌더한다", () => {
    seedMixed();

    expect(() => renderAppAt("/analysis")).not.toThrow();
    expect(screen.getByRole("heading", { name: "절세 상세 분석" })).toBeInTheDocument();
  });

  it("AC-1[P0]: 공제 데이터가 없는 초기 상태에서도 /analysis가 렌더 오류 없이 빈 상태 안내를 보여준다", () => {
    expect(() => renderAppAt("/analysis")).not.toThrow();
    expect(
      screen.getByRole("button", { name: /공제 입력하기/ }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("analysis-card")).toBeNull();
  });

  it("AC-2[P0]: 리워드 미시청 상태에서 게이트 UI가 표시되고, 시청 완료 후 실제 Provider가 공급한 공제 데이터로 상세 분석이 노출된다", async () => {
    seedMixed();
    renderAppAt("/analysis");

    const gateButton = screen.getByRole("button", { name: /광고/ });
    expect(gateButton).toBeInTheDocument();
    expect(screen.queryByTestId("analysis-card")).toBeNull();

    fireEvent.click(gateButton);

    const card = await screen.findByTestId("analysis-card");
    const items = within(card).getAllByRole("listitem");
    // MIXED_DEDUCTIONS는 6개 공제 항목 전부를 포함하므로 breakdown 전체가 노출되어야 한다
    expect(items.length).toBe(6);
    expect(within(card).getByText(/신용카드/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /광고/ })).toBeNull();
  });

  it("AC-2[P1]: 시청 전 화면에는 상세 공제 항목 텍스트가 노출되지 않는다(게이트가 실제로 콘텐츠를 가린다)", () => {
    seedMixed();
    renderAppAt("/analysis");

    // 게이트 상태에서는 블러 처리된 자리표시자만 있고, 항목 텍스트(listitem)는 없어야 한다
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("AC-3[P0]: Analysis.tsx는 ScreenScaffold로 감싸져 있고 window.open/location.href를 통한 외부 이탈이 없다", () => {
    expect(ANALYSIS_SOURCE).toMatch(/ScreenScaffold/);
    expect(ANALYSIS_SOURCE).not.toMatch(/window\.location\.href\s*=/);
    expect(ANALYSIS_SOURCE).not.toMatch(/window\.open\s*\(/);
  });

  it("AC-3[P0]: 광고 게이팅 SDK 호출(loadFullScreenAd/showFullScreenAd)이 try/catch로 가드되어 SDK가 throw해도 흰 화면이 되지 않는다", () => {
    seedMixed();
    mockLoadFullScreenAd.mockImplementation(() => {
      throw new Error("SDK unavailable outside Toss WebView");
    });

    expect(() => renderAppAt("/analysis")).not.toThrow();
    expect(screen.getByRole("heading", { name: "절세 상세 분석" })).toBeInTheDocument();
  });

  it("AC-4[P0]: analysis 라우트 스모크 — /analysis가 콘솔 에러 없이 App 전체 트리에서 렌더된다", () => {
    seedMixed();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = renderAppAt("/analysis");

    expect(container.innerHTML.length).toBeGreaterThan(0);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("AC-4: /analysis를 단독 컴포넌트로 렌더해도(라우터 트리 밖) 크래시 없이 동작해 회귀를 방지한다", () => {
    seedMixed();

    expect(() =>
      render(React.createElement(MemoryRouter, null, React.createElement(Analysis))),
    ).not.toThrow();
  });
});
