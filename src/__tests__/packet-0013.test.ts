import { describe, it, expect } from "vitest";
import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { SavedRecord } from "@/lib/types";

mockAll();

// Records.tsx는 아직 생성되지 않음 — TDD red phase 예상 동작
import Records from "@/pages/Records";

function makeRecord(taxYear: number, refundAmount: number, savedAt: number): SavedRecord {
  return {
    id: `record-${taxYear}`,
    taxYear,
    profile: {
      id: `profile-${taxYear}`,
      taxYear,
      incomeType: "employee",
      annualSalary: 50000000,
      freelanceIncome: 0,
      dependents: 0,
      updatedAt: savedAt,
    },
    deductions: {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    },
    result: {
      taxableIncome: 40000000,
      calculatedTax: 3000000,
      prepaidTax: 3000000 + refundAmount,
      refundAmount,
      breakdown: [],
      needsGlobalFiling: false,
      computedAt: savedAt,
    },
    savedAt,
  };
}

function renderRecords() {
  return renderWithRouter(React.createElement(Records));
}

describe("기록 & 비교 페이지 (`/records`)", () => {
  it("AC-1[P0]: 저장된 기록을 savedAt 내림차순(최신순)으로 ListRow에 연도·환급액과 함께 표시한다", () => {
    seedLocalStorage({
      "taxback:records": [
        makeRecord(2023, 1500000, 1000),
        makeRecord(2025, 1200000, 3000),
        makeRecord(2024, 900000, 2000),
      ],
    });
    renderRecords();

    const items = screen.getAllByTestId("record-item");
    expect(items).toHaveLength(3);
    // 최신순: 2025(savedAt=3000) → 2024(savedAt=2000) → 2023(savedAt=1000)
    expect(items[0]).toHaveTextContent("2025");
    expect(items[0]).toHaveTextContent("1,200,000");
    expect(items[1]).toHaveTextContent("2024");
    expect(items[1]).toHaveTextContent("900,000");
    expect(items[2]).toHaveTextContent("2023");
    expect(items[2]).toHaveTextContent("1,500,000");
  });

  it("AC-1[P0]: 기록이 5개를 초과하면 최신 5개만 ListRow로 표시한다", () => {
    seedLocalStorage({
      "taxback:records": [
        makeRecord(2018, 100000, 1),
        makeRecord(2019, 200000, 2),
        makeRecord(2020, 300000, 3),
        makeRecord(2021, 400000, 4),
        makeRecord(2022, 500000, 5),
        makeRecord(2023, 600000, 6),
      ],
    });
    renderRecords();

    const items = screen.getAllByTestId("record-item");
    expect(items).toHaveLength(5);
    // 가장 오래된 2018(savedAt=1)은 잘려나가야 한다
    expect(screen.queryByText(/2018/)).toBeNull();
    // 가장 최신 2023은 포함되어야 한다
    expect(items[0]).toHaveTextContent("2023");
  });

  it("AC-2[P0]: 2개 이상 기록이 있으면 최근-직전 환급액 차이를 부호와 함께 표시한다 (증가)", () => {
    seedLocalStorage({
      "taxback:records": [
        makeRecord(2024, 900000, 2000),
        makeRecord(2025, 1200000, 3000),
      ],
    });
    renderRecords();

    // 1,200,000 - 900,000 = +300,000 (증가)
    const diff = screen.getByTestId("record-diff");
    expect(diff).toHaveTextContent("300,000");
    expect(diff.textContent).toMatch(/\+/);
  });

  it("AC-2: 최근 환급액이 직전보다 감소하면 음수 부호로 표시한다", () => {
    seedLocalStorage({
      "taxback:records": [
        makeRecord(2024, 1500000, 2000),
        makeRecord(2025, 1000000, 3000),
      ],
    });
    renderRecords();

    // 1,000,000 - 1,500,000 = -500,000 (감소)
    const diff = screen.getByTestId("record-diff");
    expect(diff).toHaveTextContent("500,000");
    expect(diff.textContent).toMatch(/-/);
  });

  it("AC-2: 기록이 1개뿐이면 증감 비교를 표시하지 않는다", () => {
    seedLocalStorage({
      "taxback:records": [makeRecord(2025, 1200000, 3000)],
    });
    renderRecords();

    expect(screen.getAllByTestId("record-item")).toHaveLength(1);
    expect(screen.queryByTestId("record-diff")).toBeNull();
  });

  it("AC-3[P0]: 기록이 없으면 EmptyState로 안내 문구와 이동 버튼을 표시한다", () => {
    seedLocalStorage({ "taxback:records": [] });
    renderRecords();

    expect(screen.queryByTestId("record-item")).toBeNull();
    expect(screen.getByText("저장된 기록이 없어요")).toBeInTheDocument();
    expect(screen.getByText("결과 저장하러 가기")).toBeInTheDocument();
  });

  it("AC-3: EmptyState의 '결과 저장하러 가기' 클릭 시 /result로 이동한다", () => {
    seedLocalStorage({ "taxback:records": [] });
    renderRecords();

    fireEvent.click(screen.getByText("결과 저장하러 가기"));
    expect(mockNavigate).toHaveBeenCalledWith("/result");
  });
});
