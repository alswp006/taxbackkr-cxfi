import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { loadFullScreenAd, showFullScreenAd } from "@apps-in-toss/web-framework";
import type { TaxProfile, Deductions } from "@/lib/types";

// NOTE: mocks.ts hoists every vi.mock() it declares (including the one inside
// mockAppsInToss()) the moment this file imports ANYTHING from it — so a second,
// competing `vi.mock("@apps-in-toss/web-framework", ...)` declared locally here would
// silently lose to that hoisted registration. Call mockAppsInToss() to opt in, then
// control its already-mocked loadFullScreenAd/showFullScreenAd via vi.mocked() below.
mockTds();
mockAppsInToss();
mockRouter();

import Analysis from "@/pages/Analysis";

const mockLoadFullScreenAd = vi.mocked(loadFullScreenAd);
const mockShowFullScreenAd = vi.mocked(showFullScreenAd);

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

const EMPTY_DEDUCTIONS: Deductions = {
  creditCard: 0,
  medical: 0,
  education: 0,
  irp: 0,
  insurance: 0,
  donation: 0,
};

// 한도: creditCard 3,000,000 / medical 7,000,000 / education 9,000,000 /
//       irp 9,000,000 / insurance 1,000,000 / donation 100,000,000
// 적용액 기준 usedRatio·잔여액(계산 엔진 실값):
//  creditCard: applied 1,000,000 / limit 3,000,000 → ratio 33%, 잔여 2,000,000원
//  medical:    applied 3,500,000 / limit 7,000,000 → ratio 50%, 잔여 3,500,000원
//  irp:        applied 9,000,000 / limit 9,000,000 → ratio 100%, 잔여 0원
const MIXED_DEDUCTIONS: Deductions = {
  ...EMPTY_DEDUCTIONS,
  creditCard: 1000000,
  medical: 3500000,
  irp: 9000000,
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

describe("절세 상세 분석 페이지 (`/analysis`)", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLoadFullScreenAd.mockClear();
    mockShowFullScreenAd.mockClear();
    mockLoadFullScreenAd.mockImplementation((opts: any) => opts.onEvent?.({ type: "loaded" }));
    mockShowFullScreenAd.mockImplementation((opts: any) => opts.onEvent?.({ type: "rewarded" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-1[P0]: 광고 시청 전에는 analysis-card 상세가 숨겨지고 '광고 보고 분석 확인' CTA만 노출된다", () => {
    seedMixed();
    renderAnalysis();

    expect(screen.getByRole("button", { name: "광고 보고 분석 확인" })).toBeInTheDocument();
    expect(screen.queryByText(/한도까지/)).toBeNull();
    expect(screen.queryByText("신용카드 소득공제")).toBeNull();
  });

  it("AC-1[P0]: 광고 시청 완료 후 analysis-card에 6개 공제 항목 ListRow+MiniBar(usedRatio)와 잔여액이 표시된다", () => {
    seedMixed();
    renderAnalysis();

    fireEvent.click(screen.getByRole("button", { name: "광고 보고 분석 확인" }));

    expect(mockShowFullScreenAd).toHaveBeenCalledTimes(1);

    const card = screen.getByTestId("analysis-card");
    expect(within(card).getAllByRole("listitem")).toHaveLength(6);

    const bars = within(card).getAllByRole("progressbar");
    expect(bars).toHaveLength(6);

    // creditCard: 1,000,000 / 3,000,000 = 33%, 잔여 2,000,000원
    expect(within(card).getByText("신용카드 소득공제")).toBeInTheDocument();
    expect(within(card).getByText("한도까지 2,000,000원 남음")).toBeInTheDocument();

    // irp: 9,000,000 / 9,000,000 = 100%, 잔여 0원
    expect(within(card).getByText("IRP·연금저축 세액공제")).toBeInTheDocument();
    expect(within(card).getByText("한도까지 0원 남음")).toBeInTheDocument();

    const irpBar = bars.find((el) => el.getAttribute("aria-valuenow") === "100");
    expect(irpBar).toBeDefined();
  });

  it("AC-2[P1]: 공제 입력이 모두 0이면 '분석할 공제 내역이 없어요' EmptyState와 '공제 입력하기' 버튼을 표시하고 게이팅 CTA는 노출되지 않는다", () => {
    seedLocalStorage({
      "taxback:profile": makeProfile(),
      "taxback:deductions": EMPTY_DEDUCTIONS,
    });
    renderAnalysis();

    expect(screen.getByText("분석할 공제 내역이 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "광고 보고 분석 확인" })).toBeNull();
    expect(screen.queryByTestId("analysis-card")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "공제 입력하기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/simulate");
  });

  it("AC-3[P1]: 광고 로드 실패 후 CTA 탭 시 실패 Toast를 표시하고 게이팅을 유지한다", () => {
    mockLoadFullScreenAd.mockImplementation((opts: any) =>
      opts.onError?.({ message: "load failed" }),
    );
    seedMixed();
    renderAnalysis();

    fireEvent.click(screen.getByRole("button", { name: "광고 보고 분석 확인" }));

    expect(
      screen.getByText("광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"),
    ).toBeInTheDocument();
    expect(mockShowFullScreenAd).not.toHaveBeenCalled();
    expect(screen.queryByTestId("analysis-card")).toBeNull();
    expect(screen.queryByText(/한도까지/)).toBeNull();
    expect(screen.getByRole("button", { name: "광고 보고 분석 확인" })).toBeInTheDocument();
  });
});
