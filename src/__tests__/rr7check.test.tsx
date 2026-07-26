import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { mockAppsInToss } from "@/__tests__/__helpers__/mocks";
mockAppsInToss();
import { FloatingTabBar } from "@/components/FloatingTabBar";

function LocDebug() {
  const loc = useLocation();
  return React.createElement("span", { "data-testid": "loc" }, loc.pathname);
}

function A() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement("h1", null, "PageA"),
    React.createElement(LocDebug),
    React.createElement(FloatingTabBar, {
      items: [
        { label: "홈", path: "/a" },
        { label: "체크리스트", path: "/b" },
      ],
    }),
  );
}
function B() {
  return React.createElement("h1", null, "PageB");
}

describe("floatingtabbar sanity", () => {
  it("navigates on tab click", () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/a"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/a", element: React.createElement(A) }),
          React.createElement(Route, { path: "/b", element: React.createElement(B) }),
        ),
      ),
    );
    console.log("loc text:", screen.getByTestId("loc").textContent);
    fireEvent.click(screen.getByRole("tab", { name: "체크리스트" }));
    expect(screen.getByText("PageB")).toBeInTheDocument();
  });
});
