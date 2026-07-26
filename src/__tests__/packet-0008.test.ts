import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { fireEvent, screen } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { TaxProfile } from "@/lib/types";

mockAll();

// Home.tsx는 아직 생성되지 않음 — TDD red phase 예상 동작
import Home from "@/pages/Home";

function readProfile(): TaxProfile | null {
  const raw = localStorage.getItem("taxback:profile");
  return raw ? JSON.parse(raw) : null;
}

function renderHome() {
  return renderWithRouter(React.createElement(Home));
}

describe("홈 / 소득 입력 페이지 (`/`)", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("AC-1[P0]: 직장인 선택 + {annualSalary:50000000, dependents:1} 제출 시 프로필 저장 후 /result로 이동한다", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "직장인" }));
    fireEvent.change(screen.getByPlaceholderText("예: 5,000만원"), {
      target: { value: "50000000" },
    });
    fireEvent.change(screen.getByPlaceholderText("본인 제외 인원 수"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "환급액 계산" }));

    const saved = readProfile();
    expect(saved?.incomeType).toBe("employee");
    expect(saved?.annualSalary).toBe(50000000);
    expect(saved?.dependents).toBe(1);
    expect(mockNavigate).toHaveBeenCalledWith("/result");
  });

  it("AC-1[P0]: 프리랜서 선택 + {freelanceIncome:30000000} 제출 시 incomeType:freelancer로 저장하고 이동한다", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "프리랜서" }));
    fireEvent.change(screen.getByPlaceholderText("예: 3,000만원"), {
      target: { value: "30000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "환급액 계산" }));

    const saved = readProfile();
    expect(saved?.incomeType).toBe("freelancer");
    expect(saved?.freelanceIncome).toBe(30000000);
    expect(mockNavigate).toHaveBeenCalledWith("/result");
  });

  it("AC-2[P1]: 총급여 0으로 제출하면 '총급여를 입력해주세요' 에러를 표시하고 이동하지 않는다", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "직장인" }));
    fireEvent.click(screen.getByRole("button", { name: "환급액 계산" }));

    expect(screen.getByRole("alert").textContent).toBe("총급여를 입력해주세요");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(readProfile()).toBeNull();
  });

  it("AC-2[P1]: 총급여가 100억을 초과하면 '총급여는 100억원 이하로 입력해주세요' 에러를 표시한다", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "직장인" }));
    fireEvent.change(screen.getByPlaceholderText("예: 5,000만원"), {
      target: { value: "10000000001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "환급액 계산" }));

    expect(screen.getByRole("alert").textContent).toBe("총급여는 100억원 이하로 입력해주세요");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("AC-3[P1]: 총급여 필드는 inputMode=numeric이며 비숫자 입력이 마지막 유효값을 덮어쓰지 않는다", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "직장인" }));
    const input = screen.getByPlaceholderText("예: 5,000만원") as HTMLInputElement;

    expect(input.getAttribute("inputmode") ?? input.getAttribute("inputMode")).toBe("numeric");

    fireEvent.change(input, { target: { value: "50000000" } });
    expect(input.value).toBe("50000000");

    fireEvent.change(input, { target: { value: "50000000abc" } });
    expect(input.value).toBe("50000000");
  });

  it("AC-3[P1]: 프리랜서 선택 시 총급여 필드는 숨기고 사업소득 필드를 표시한다", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "프리랜서" }));

    expect(screen.queryByPlaceholderText("예: 5,000만원")).toBeNull();
    expect(screen.getByPlaceholderText("예: 3,000만원")).not.toBeNull();
  });

  it("AC-3[P1]: 저장된 taxback:profile이 있으면 폼 필드가 프리필된다", () => {
    seedLocalStorage({
      "taxback:profile": {
        id: "profile-1",
        taxYear: 2025,
        incomeType: "employee",
        annualSalary: 42000000,
        freelanceIncome: 0,
        dependents: 2,
        updatedAt: 1234567890,
      },
    });

    renderHome();

    expect((screen.getByPlaceholderText("예: 5,000만원") as HTMLInputElement).value).toBe(
      "42000000",
    );
    expect((screen.getByPlaceholderText("본인 제외 인원 수") as HTMLInputElement).value).toBe(
      "2",
    );
  });

  it("AC-3[P1]: window.location.href/window.open을 통한 외부 이탈 코드가 존재하지 않는다", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/pages/Home.tsx"),
      "utf-8",
    );

    expect(source).not.toMatch(/window\.location\.href\s*=/);
    expect(source).not.toMatch(/window\.open\s*\(/);
  });
});
