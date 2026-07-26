import { describe, it, expect, vi } from "vitest";
import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { TaxProfile, Deductions } from "@/lib/types";

mockAll();

// Simulate.tsx는 아직 생성되지 않음 — TDD red phase 예상 동작
import Simulate from "@/pages/Simulate";

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

function renderSimulate() {
  return renderWithRouter(React.createElement(Simulate));
}

describe("공제 시뮬레이션 페이지 (`/simulate`)", () => {
  it("AC-1[P0]: annualSalary 50,000,000 + irp 9,000,000 공제 상태에서 sim-hero는 환급액 1,350,000원을 표시한다", () => {
    seedLocalStorage({
      "taxback:profile": makeProfile(),
      "taxback:deductions": { ...EMPTY_DEDUCTIONS, irp: 9000000 },
    });
    renderSimulate();

    const hero = screen.getByTestId("sim-hero");
    expect(within(hero).getByText("1,350,000원")).toBeInTheDocument();
  });

  it("AC-1[P0]: creditCard 슬라이더를 0 → 3,000,000으로 조정하면(디바운스 이후) calcTax가 재호출되어 sim-hero 환급액이 1,350,000원 → 1,800,000원으로 즉시 갱신된다", async () => {
    seedLocalStorage({
      "taxback:profile": makeProfile(),
      "taxback:deductions": { ...EMPTY_DEDUCTIONS, irp: 9000000 },
    });
    renderSimulate();

    const hero = screen.getByTestId("sim-hero");
    expect(within(hero).getByText("1,350,000원")).toBeInTheDocument();

    vi.useFakeTimers();
    const slider = screen.getByTestId("deduction-slider-creditCard");
    fireEvent.change(slider, { target: { value: "3000000" } });
    await vi.advanceTimersByTimeAsync(250);
    vi.useRealTimers();

    expect(within(hero).getByText("1,800,000원")).toBeInTheDocument();
    expect(within(hero).queryByText("1,350,000원")).toBeNull();
  });

  it("AC-2[P0]: 6개 공제 항목 슬라이더는 모두 max=100,000,000(1억)으로 렌더된다", () => {
    seedLocalStorage({
      "taxback:profile": makeProfile(),
      "taxback:deductions": EMPTY_DEDUCTIONS,
    });
    renderSimulate();

    const keys: (keyof Deductions)[] = [
      "creditCard",
      "medical",
      "education",
      "irp",
      "insurance",
      "donation",
    ];
    keys.forEach((key) => {
      const slider = screen.getByTestId(`deduction-slider-${key}`) as HTMLInputElement;
      expect(slider.max).toBe("100000000");
    });
  });

  it("AC-2[P0]: donation 슬라이더에 1억 초과 값(150,000,000)을 입력하면 1억으로 잘려 적용되고 sim-hero가 6,240,000원(과세표준 0원)으로 갱신된다", async () => {
    seedLocalStorage({
      "taxback:profile": makeProfile(),
      "taxback:deductions": EMPTY_DEDUCTIONS,
    });
    renderSimulate();

    vi.useFakeTimers();
    const slider = screen.getByTestId("deduction-slider-donation") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "150000000" } });
    await vi.advanceTimersByTimeAsync(250);
    vi.useRealTimers();

    expect(slider.value).toBe("100000000");
    const hero = screen.getByTestId("sim-hero");
    expect(within(hero).getByText("6,240,000원")).toBeInTheDocument();

    const saved = JSON.parse(localStorage.getItem("taxback:deductions") ?? "{}");
    expect(saved.donation ?? 0).not.toBe(150000000);
  });

  it('AC-3[P1]: medical 슬라이더를 3,500,000으로 조정 후 "이 값으로 저장" 버튼을 탭하면 taxback:deductions에 반영되고 Toast "공제 내역을 저장했어요"가 표시된다', async () => {
    seedLocalStorage({
      "taxback:profile": makeProfile(),
      "taxback:deductions": EMPTY_DEDUCTIONS,
    });
    renderSimulate();

    vi.useFakeTimers();
    const slider = screen.getByTestId("deduction-slider-medical");
    fireEvent.change(slider, { target: { value: "3500000" } });
    await vi.advanceTimersByTimeAsync(250);
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "이 값으로 저장" }));

    expect(screen.getByText("공제 내역을 저장했어요")).toBeInTheDocument();

    const saved = JSON.parse(localStorage.getItem("taxback:deductions") ?? "{}");
    expect(saved.medical).toBe(3500000);
    expect(saved.creditCard).toBe(0);
  });
});
