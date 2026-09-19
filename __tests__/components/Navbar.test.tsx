import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/Navbar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

describe("Navbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("orders the primary navigation around the reader journey", () => {
    render(<Navbar />);

    const navigation = screen.getByRole("navigation", { name: "主要导航" });
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["首页", "文章", "项目", "关于", "联系"]);
  });
});
