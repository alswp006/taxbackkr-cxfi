import { describe, it, expect } from "vitest";
import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { Deductions } from "@/lib/types";

mockAll();

// Checklist.tsx는 아직 생성되지 않음 — TDD red phase 예상 동작
import Checklist from "@/pages/Checklist";

const BASE_DEDUCTIONS: Deductions = {
  creditCard: 3000000, // target 3,000,000 → done
  medical: 7000000, // target 7,000,000 → done
  education: 3000000, // housing 항목 source, target 3,000,000 → done
  irp: 9000000, // target 9,000,000 → done
  insurance: 1000000, // pension 항목 source, target 3,000,000 → NOT done
  donation: 500000, // target 1,000,000 → NOT done
};

function renderChecklist() {
  return renderWithRouter(React.createElement(Checklist));
}

describe("절세 체크리스트 페이지 (`/checklist`)", () => {
  it("AC-1[P0]: 항상 6항목을 ListRow로 표시하고 상단에 achievedCount/6 달성도를 보여준다", () => {
    seedLocalStorage({ "taxback:deductions": BASE_DEDUCTIONS });
    renderChecklist();

    const keys = ["irp", "pension", "medical", "creditCard", "donation", "housing"];
    keys.forEach((key) => {
      expect(screen.getByTestId(`checklist-item-${key}`)).toBeInTheDocument();
    });

    // BASE_DEDUCTIONS 기준 달성: irp, medical, creditCard, housing = 4개
    expect(screen.getByText("4/6")).toBeInTheDocument();
  });

  it("AC-1[P0]: 달성 항목(done)은 완료 표시를, 미달성 항목은 완료 표시를 하지 않는다", () => {
    seedLocalStorage({ "taxback:deductions": BASE_DEDUCTIONS });
    renderChecklist();

    const irpItem = screen.getByTestId("checklist-item-irp");
    expect(within(irpItem).getByText(/완료/)).toBeInTheDocument();

    const pensionItem = screen.getByTestId("checklist-item-pension");
    expect(within(pensionItem).queryByText(/완료/)).toBeNull();
  });

  it("AC-2: currentAmount >= targetAmount인 항목만 done:true로 렌더된다 (모든 항목 미달성)", () => {
    const emptyDeductions: Deductions = {
      creditCard: 0,
      medical: 0,
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };
    seedLocalStorage({ "taxback:deductions": emptyDeductions });
    renderChecklist();

    expect(screen.getByText("0/6")).toBeInTheDocument();
    ["irp", "pension", "medical", "creditCard", "donation", "housing"].forEach((key) => {
      const item = screen.getByTestId(`checklist-item-${key}`);
      expect(within(item).queryByText(/완료/)).toBeNull();
    });
  });

  it("AC-2: 정확히 한도(target)에 도달한 항목만 done이고 미달 항목은 done이 아니다 (경계값)", () => {
    const boundaryDeductions: Deductions = {
      creditCard: 2999999, // target 3,000,000 → NOT done (1원 부족)
      medical: 7000000, // target 7,000,000 → done (정확히 일치)
      education: 0,
      irp: 0,
      insurance: 0,
      donation: 0,
    };
    seedLocalStorage({ "taxback:deductions": boundaryDeductions });
    renderChecklist();

    expect(screen.getByText("1/6")).toBeInTheDocument();
    expect(within(screen.getByTestId("checklist-item-medical")).getByText(/완료/)).toBeInTheDocument();
    expect(within(screen.getByTestId("checklist-item-creditCard")).queryByText(/완료/)).toBeNull();
  });

  it('AC-3[P0]: 항목 탭 시 DEDUCTION_TIPS 문구와 "참고용 정보"가 표시된다', () => {
    seedLocalStorage({ "taxback:deductions": BASE_DEDUCTIONS });
    renderChecklist();

    fireEvent.click(screen.getByTestId("checklist-item-irp"));

    expect(
      screen.getByText("IRP·연금저축은 연 900만원까지 납입하면 최대 148만 5천원 세액공제를 받아요"),
    ).toBeInTheDocument();
    expect(screen.getByText(/참고용 정보/)).toBeInTheDocument();
  });

  it("AC-3: pension 항목 탭 시 insurance DEDUCTION_TIPS 문구가 표시된다 (source 매핑 확인)", () => {
    seedLocalStorage({ "taxback:deductions": BASE_DEDUCTIONS });
    renderChecklist();

    fireEvent.click(screen.getByTestId("checklist-item-pension"));

    expect(
      screen.getByText("보장성보험료는 연 100만원 한도로 12% 세액공제돼요"),
    ).toBeInTheDocument();
    expect(screen.getByText(/참고용 정보/)).toBeInTheDocument();
  });
});
