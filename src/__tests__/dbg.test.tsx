import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
// Import the helper module but DO NOT call any mock function.
import "@/__tests__/__helpers__/mocks";
import { ProbeNav } from "@/components/__ProbeNav";

describe("x", () => {
  it("y", () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/a"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/a", element: React.createElement(ProbeNav) }),
        ),
      ),
    );
    console.log("ProbeNav loc (helper imported, nothing called):", screen.getByTestId("probe").textContent);
    expect(true).toBe(true);
  });
});
