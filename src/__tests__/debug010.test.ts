import { it, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { mockNavigate } from "@/__tests__/__helpers__/mocks";
void mockNavigate;

const mockLoadFullScreenAd = vi.fn((opts: any) => {
  console.log("mockLoadFullScreenAd CALLED");
  opts.onEvent?.({ type: "loaded" });
});

vi.mock("@apps-in-toss/web-framework", () => ({
  loadFullScreenAd: (opts: any) => mockLoadFullScreenAd(opts),
  showFullScreenAd: vi.fn(),
  generateHapticFeedback: vi.fn(),
}));

import DebugAd from "@/pages/__DebugAd";

it("debug import mockNavigate only", () => {
  render(React.createElement(DebugAd));
  console.log("calls:", mockLoadFullScreenAd.mock.calls.length);
});
