import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

// Router 라우팅 통합 테스트이므로 react-router-dom은 목킹하지 않는다(실제 useNavigate/useLocation 필요).
// TDS + SDK만 목킹 — jsdom 크래시 방지.
mockTds();
mockAppsInToss();

// App.tsx는 아직 라우팅/FloatingTabBar 배선이 완료되지 않음 — TDD red phase 예상 동작
import App from "@/App";

const ROUTE_TITLES: Record<string, string> = {
  "/": "세금 환급 계산",
  "/result": "환급 결과",
  "/analysis": "절세 상세 분석",
  "/simulate": "공제 시뮬레이션",
  "/checklist": "절세 체크리스트",
  "/records": "기록 & 비교",
};

function renderAppAt(pathname: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [pathname] }, React.createElement(App)),
  );
}

describe("라우팅 & FloatingTabBar 배선", () => {
  it("AC-1[P0]: / 와 /result 경로 진입 시 각각 대응하는 페이지가 렌더된다", () => {
    const { unmount } = renderAppAt("/");
    expect(screen.getByRole("heading", { name: ROUTE_TITLES["/"] })).toBeInTheDocument();
    unmount();

    renderAppAt("/result");
    expect(screen.getByRole("heading", { name: ROUTE_TITLES["/result"] })).toBeInTheDocument();
  });

  it("AC-1[P0]: /analysis, /simulate, /checklist, /records 경로가 모두 대응 페이지를 렌더한다", () => {
    for (const p of ["/analysis", "/simulate", "/checklist", "/records"]) {
      const { unmount } = renderAppAt(p);
      expect(screen.getByRole("heading", { name: ROUTE_TITLES[p] })).toBeInTheDocument();
      unmount();
    }
  });

  it("AC-2[P0]: 홈에서 체크리스트 탭을 누르면 /checklist 로 이동하고 체크리스트 탭이 활성화된다", () => {
    renderAppAt("/");

    // 초기 상태: 홈 탭이 활성(aria-selected=true)
    const homeTabInitial = screen.getByRole("tab", { name: "홈" });
    expect(homeTabInitial).toHaveAttribute("aria-selected", "true");

    const checklistTab = screen.getByRole("tab", { name: "체크리스트" });
    fireEvent.click(checklistTab);

    // 페이지 전환 확인
    expect(screen.getByRole("heading", { name: "절세 체크리스트" })).toBeInTheDocument();

    // 활성 탭 컬러 틴트: 체크리스트 탭이 선택 상태, 홈 탭은 비선택
    expect(screen.getByRole("tab", { name: "체크리스트" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "홈" })).toHaveAttribute("aria-selected", "false");
  });

  it("AC-2[P0]: 기록 탭을 누르면 /records 로 이동하고 기록 탭이 활성화된다", () => {
    renderAppAt("/checklist");

    const recordsTab = screen.getByRole("tab", { name: "기록" });
    fireEvent.click(recordsTab);

    expect(screen.getByRole("heading", { name: "기록 & 비교" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "기록" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "체크리스트" })).toHaveAttribute("aria-selected", "false");
  });

  it("AC-3[P0]: 정의되지 않은 경로는 / 로 리다이렉트되어 홈 화면을 렌더한다", () => {
    renderAppAt("/no-such-route-xyz");
    expect(screen.getByRole("heading", { name: "세금 환급 계산" })).toBeInTheDocument();
    expect(screen.queryByText("no-such-route-xyz")).not.toBeInTheDocument();
  });

  it("AC-3[P0]: main.tsx는 수정되지 않는다 (@AI:ANCHOR 보호, BrowserRouter/Provider 배선 유지)", () => {
    const mainTsxPath = path.resolve(__dirname, "../main.tsx");
    const content = fs.readFileSync(mainTsxPath, "utf-8");

    expect(content).toContain("@AI:ANCHOR");
    expect(content).toContain("BrowserRouter");
    expect(content).toContain("TDSMobileAITProvider");
  });

  it("통합: FloatingTabBar의 모든 탭이 실제 존재하는 라우트로 연결된다", () => {
    renderAppAt("/");
    const tablist = screen.getByRole("tablist", { name: "메인 네비게이션" });
    const tabs = within(tablist).getAllByRole("tab");

    // 홈/체크리스트/기록 3개 탭
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["홈", "체크리스트", "기록"]);
  });
});
