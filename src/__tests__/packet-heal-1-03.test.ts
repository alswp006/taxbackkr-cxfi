/**
 * Packet HEAL-1-03: 절세 상세 분석 페이지(/analysis) 리워드 게이팅 완결
 *
 * /analysis가 라우트에 배선된 상태에서 크래시 없이 렌더되고, TossRewardAd(리워드 광고)
 * 시청 완료 후에만 상세 분석 섹션을 노출하는지 검증한다. SDK 미로드/미시청 상태에서도
 * 게이트 UI가 크래시 없이 렌더되어야 하며, ScreenScaffold로 감싸고 HEX 하드코딩·외부
 * 이탈(window.open/location.href)이 없어야 한다.
 *
 * TDD Red Phase — Analysis.tsx 구현이 완결되지 않은 상태라면 아래 테스트가 실패할 수 있다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";
import type { TaxProfile, Deductions } from "@/lib/types";

// 라우팅 통합 테스트(AC-4)를 포함하므로 react-router-dom 자체는 목킹하지 않는다
// (heal-1-01 패턴과 동일 — 실제 useNavigate/useLocation 필요). TDS + SDK만 목킹.
mockTds();
mockAppsInToss();

import Analysis from "@/pages/Analysis";
import App from "@/App";

const mockLoadFullScreenAd = vi.mocked(loadFullScreenAd);
const mockShowFullScreenAd = vi.mocked(showFullScreenAd);

const SRC_ROOT = path.join(process.cwd(), "src");
const ANALYSIS_SOURCE = fs.readFileSync(path.join(SRC_ROOT, "pages/Analysis.tsx"), "utf-8");

function makeProfile(overrides: Partial<TaxProfile> = {}): TaxProfile {
  return {
    id: "profile-1",
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
  creditCard: 1000000,
  medical: 3500000,
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

function renderAnalysis() {
  return renderWithRouter(React.createElement(Analysis));
}

describe("절세 상세 분석 페이지(/analysis) 리워드 게이팅 완결", () => {
  beforeEach(() => {
    mockLoadFullScreenAd.mockClear();
    mockShowFullScreenAd.mockClear();
    mockLoadFullScreenAd.mockImplementation((opts: any) => opts.onEvent?.({ type: "loaded" }));
    mockShowFullScreenAd.mockImplementation((opts: any) => opts.onEvent?.({ type: "rewarded" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-1[P0]: 리워드 미시청 상태에서 게이트 UI(광고 보고 분석 확인 버튼)를 크래시 없이 렌더하고 상세 분석은 숨긴다", () => {
    seedMixed();
    expect(() => renderAnalysis()).not.toThrow();

    expect(screen.getByRole("button", { name: "광고 보고 분석 확인" })).toBeInTheDocument();
    expect(screen.queryByTestId("analysis-card")).toBeNull();
  });

  it("AC-1[P0]: 광고 로드 SDK가 throw하는 환경(비-토스 브라우저)에서도 게이트 UI가 크래시 없이 렌더된다", () => {
    seedMixed();
    mockLoadFullScreenAd.mockImplementation(() => {
      throw new Error("SDK unavailable outside Toss WebView");
    });

    expect(() => renderAnalysis()).not.toThrow();
    expect(screen.getByRole("button", { name: "광고 보고 분석 확인" })).toBeInTheDocument();
  });

  it("AC-2[P0]: 리워드 시청 완료(showFullScreenAd rewarded) 후 상세 분석 카드가 노출되고 공제 항목이 표시된다", () => {
    seedMixed();
    renderAnalysis();

    fireEvent.click(screen.getByRole("button", { name: "광고 보고 분석 확인" }));

    expect(mockShowFullScreenAd).toHaveBeenCalledTimes(1);

    const card = screen.getByTestId("analysis-card");
    expect(within(card).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "광고 보고 분석 확인" })).toBeNull();
  });

  it("AC-2[P1]: 광고 로드 실패 시 시청 버튼 클릭이 상세 분석을 잠금 해제하지 않고 안내 토스트를 띄운다", () => {
    seedMixed();
    mockLoadFullScreenAd.mockImplementation((opts: any) => opts.onError?.({ type: "load-failed" }));
    renderAnalysis();

    fireEvent.click(screen.getByRole("button", { name: "광고 보고 분석 확인" }));

    expect(mockShowFullScreenAd).not.toHaveBeenCalled();
    expect(screen.queryByTestId("analysis-card")).toBeNull();
  });

  it("AC-3[P0]: Analysis.tsx는 ScreenScaffold로 감싸져 있고 HEX 색상 하드코딩이 없다", () => {
    expect(ANALYSIS_SOURCE).toMatch(/ScreenScaffold/);
    expect(ANALYSIS_SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("AC-3[P0]: Analysis.tsx에 window.open/location.href를 통한 외부 이탈 코드가 없다", () => {
    expect(ANALYSIS_SOURCE).not.toMatch(/window\.location\.href\s*=/);
    expect(ANALYSIS_SOURCE).not.toMatch(/window\.open\s*\(/);
  });

  it("AC-4[P0]: /analysis 라우트가 App.tsx에 배선되어 있고, 실제 라우터로 진입 시 크래시 없이 렌더된다", () => {
    seedMixed();

    expect(() =>
      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/analysis"] },
          React.createElement(App),
        ),
      ),
    ).not.toThrow();

    expect(screen.getByText("절세 상세 분석")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "광고 보고 분석 확인" })).toBeInTheDocument();
  });
});
