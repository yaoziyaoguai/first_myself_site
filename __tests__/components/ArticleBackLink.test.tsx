import { StrictMode, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleBackLink } from "@/components/ArticleBackLink";
import { Navbar } from "@/components/Navbar";
import { rememberArchiveLocation } from "@/lib/archiveNavigation";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigate }),
  usePathname: () => window.location.pathname,
}));
vi.mock("@/components/CommandMenu", () => ({ CommandMenu: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, onNavigate }: {
    href: string;
    children: ReactNode;
    onNavigate?: (event: { preventDefault: () => void }) => void;
  }) => (
    <a href={href} onClick={(event) => {
      event.preventDefault();
      let cancelled = false;
      onNavigate?.({ preventDefault: () => { cancelled = true; } });
      if (!cancelled) navigate(href);
    }}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigate.mockClear();
});

describe("archive return links", () => {
  it("restores the current archive query even when storage is blocked, then clears it for the same article", async () => {
    const storage = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage is disabled", "SecurityError");
    });
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/blog?view=series&q=Agent");
    rememberArchiveLocation("/blog/first");
    window.history.pushState(null, "", "/blog/first");
    const archiveVisit = render(<ArticleBackLink pathname="/blog/first" />, { wrapper: StrictMode });
    await user.click(screen.getByRole("link", { name: /返回文章列表/ }));
    expect(navigate).toHaveBeenLastCalledWith("/blog?view=series&q=Agent");
    archiveVisit.unmount();

    window.history.pushState(null, "", "/blog/first");
    render(<ArticleBackLink pathname="/blog/first" />);
    await user.click(screen.getByRole("link", { name: /返回文章列表/ }));
    expect(navigate).toHaveBeenLastCalledWith("/blog");
    expect(storage).not.toHaveBeenCalled();
  });

  it("discards a return recorded for a different route", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/blog?q=old");
    rememberArchiveLocation("/blog/first");
    window.history.pushState(null, "", "/blog/other");
    render(<ArticleBackLink pathname="/blog/other" />);
    await user.click(screen.getByRole("link", { name: /返回文章列表/ }));
    expect(navigate).toHaveBeenLastCalledWith("/blog");
  });

  it("discards a pending return when an unrelated navigation replaces the archive click", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/blog?q=stale");
    const { rerender } = render(<Navbar />);
    rememberArchiveLocation("/blog/first");

    window.history.pushState(null, "", "/about");
    rerender(<Navbar />);
    window.history.pushState(null, "", "/blog/first");
    rerender(<><Navbar /><ArticleBackLink pathname="/blog/first" /></>);

    await user.click(screen.getByRole("link", { name: /返回文章列表/ }));
    expect(navigate).toHaveBeenLastCalledWith("/blog");
  });
});
