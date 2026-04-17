import { describe, it, expect, vi, beforeEach, waitFor } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LikeButton } from "@/components/LikeButton";
import * as likesLib from "@/lib/likes";

// Mock fetch for IP API
global.fetch = vi.fn();

describe("LikeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getLikeStatus
    vi.spyOn(likesLib, "getLikeStatus").mockResolvedValue({
      count: 5,
      hasLiked: false,
    });

    // Mock createLike
    vi.spyOn(likesLib, "createLike").mockResolvedValue({
      id: "like-1",
      targetId: "blog-1",
      targetType: "blog",
      ipHash: "hash1",
      fingerprint: "fp1",
      createdAt: "2026-04-17T10:00:00.000Z",
      updatedAt: "2026-04-17T10:00:00.000Z",
    });

    // Mock fetch for IP
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ip: "127.0.0.1" }),
    });
  });

  it("should render like button", async () => {
    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("点赞")).toBeInTheDocument();
    });
  });

  it("should show like count", async () => {
    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText(/5 人点赞/)).toBeInTheDocument();
    });
  });

  it("should show '已点赞' when user has liked", async () => {
    vi.spyOn(likesLib, "getLikeStatus").mockResolvedValue({
      count: 10,
      hasLiked: true,
    });

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("已点赞")).toBeInTheDocument();
    });
  });

  it("should handle like click", async () => {
    const createLikeSpy = vi.spyOn(likesLib, "createLike");

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("点赞")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("点赞"));

    await waitFor(() => {
      expect(createLikeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "blog-1",
          targetType: "blog",
        })
      );
    });
  });

  it("should update UI after liking", async () => {
    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("点赞")).toBeInTheDocument();
      expect(screen.getByText(/5 人点赞/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("点赞"));

    await waitFor(() => {
      expect(screen.getByText("已点赞")).toBeInTheDocument();
      expect(screen.getByText(/6 人点赞/)).toBeInTheDocument();
    });
  });

  it("should disable button when already liked", async () => {
    vi.spyOn(likesLib, "getLikeStatus").mockResolvedValue({
      count: 10,
      hasLiked: true,
    });

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      const button = screen.getByText("已点赞").closest("button");
      expect(button).toBeDisabled();
    });
  });

  it("should show loading state initially", () => {
    render(<LikeButton targetId="blog-1" targetType="blog" />);

    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it("should hide count when showCount is false", async () => {
    render(<LikeButton targetId="blog-1" targetType="blog" showCount={false} />);

    await waitFor(() => {
      expect(screen.getByText("点赞")).toBeInTheDocument();
    });

    expect(screen.queryByText(/人点赞/)).not.toBeInTheDocument();
  });

  it("should apply different sizes", async () => {
    const { rerender } = render(
      <LikeButton targetId="blog-1" targetType="blog" size="sm" />
    );

    await waitFor(() => {
      expect(screen.getByText("点赞")).toBeInTheDocument();
    });

    rerender(<LikeButton targetId="blog-1" targetType="blog" size="lg" />);

    await waitFor(() => {
      expect(screen.getByText("点赞")).toBeInTheDocument();
    });
  });

  it("should apply custom className", async () => {
    const { container } = render(
      <LikeButton targetId="blog-1" targetType="blog" className="custom-class" />
    );

    await waitFor(() => {
      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  it("should handle like error", async () => {
    vi.spyOn(likesLib, "createLike").mockRejectedValue(new Error("点赞失败"));

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("点赞")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("点赞"));

    await waitFor(() => {
      expect(screen.getByText(/点赞失败/)).toBeInTheDocument();
    });
  });

  it("should handle already liked error gracefully", async () => {
    vi.spyOn(likesLib, "createLike").mockRejectedValue(new Error("您已经点赞过了"));

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("点赞")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("点赞"));

    await waitFor(() => {
      expect(screen.getByText("已点赞")).toBeInTheDocument();
    });
  });
});
