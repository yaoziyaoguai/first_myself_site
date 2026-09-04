import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/Footer";
import { getPayloadAPI } from "@/lib/payload";

vi.mock("@/lib/payload", () => ({
  getPayloadAPI: vi.fn(),
}));

const mockGetPayloadAPI = vi.mocked(getPayloadAPI);

describe("Footer", () => {
  beforeEach(() => {
    mockGetPayloadAPI.mockResolvedValue({
      findGlobal: vi.fn().mockResolvedValue({}),
    } as never);
  });

  it("shows the ICP filing number and links to the MIIT filing site", async () => {
    render(await Footer());

    const filingLink = screen.getByRole("link", {
      name: "京ICP备20260057679号-1",
    });

    expect(filingLink).toHaveAttribute("href", "https://beian.miit.gov.cn/");
    expect(filingLink).toHaveAttribute("target", "_blank");
    expect(filingLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});
