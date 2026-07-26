import { describe, it, expect } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import React from "react";

// Scratch check kept for reference: confirms jsdom auto-clamps <input type="range">
// value to its `max` attribute on fireEvent.change, which packet-0011.test.ts relies on.
describe("jsdom range input clamps value to max attribute", () => {
  it("clamps an out-of-range value down to max", () => {
    const { container } = render(
      React.createElement("input", { type: "range", min: 0, max: 100000000, defaultValue: 0 }),
    );
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "150000000" } });

    expect(input.value).toBe("100000000");
    expect(input.max).toBe("100000000");
  });
});
