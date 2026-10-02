import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/Navbar";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("orders the primary navigation around the reader journey", () => {
    render(<Navbar />);

    const navigation = screen.getByRole("navigation", { name: "主要导航" });
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["首页", "文章", "项目", "关于", "联系"]);
  });

  it("closes the mobile menu on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    await user.click(screen.getByRole("button", { name: "打开菜单" }));
    expect(screen.getByRole("navigation", { name: "移动端导航" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "移动端导航" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开菜单" })).toHaveFocus();
  });
});
