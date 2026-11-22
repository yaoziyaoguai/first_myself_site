import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LikeButton } from "@/components/LikeButton";
import * as likesLib from "@/lib/likes";

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
      count: 6,
      hasLiked: true,
    });
  });

  it("should render like button", async () => {
    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: false })).toBeEnabled();
    });
  });

  it("should show like count", async () => {
    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText(/5 人觉得有启发/)).toBeInTheDocument();
    });
  });

  it("should show '已点赞' when user has liked", async () => {
    vi.spyOn(likesLib, "getLikeStatus").mockResolvedValue({
      count: 10,
      hasLiked: true,
    });

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
    });
  });

  it("should handle like click", async () => {
    const createLikeSpy = vi.spyOn(likesLib, "createLike");

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: false })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { pressed: false }));

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
      expect(screen.getByRole("button", { pressed: false })).toBeEnabled();
      expect(screen.getByText(/5 人觉得有启发/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { pressed: false }));

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
      expect(screen.getByText(/6 人觉得有启发/)).toBeInTheDocument();
    });
  });

  it("should disable button when already liked", async () => {
    vi.spyOn(likesLib, "getLikeStatus").mockResolvedValue({
      count: 10,
      hasLiked: true,
    });

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      const button = screen.getByRole("button", { pressed: true }).closest("button");
      expect(button).toBeDisabled();
    });
  });

  it("should show loading state initially", () => {
    render(<LikeButton targetId="blog-1" targetType="blog" />);

    expect(screen.getByRole("button", { busy: true })).toBeDisabled();
  });

  it("should hide count when showCount is false", async () => {
    render(<LikeButton targetId="blog-1" targetType="blog" showCount={false} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: false })).toBeEnabled();
    });

    expect(screen.queryByText(/人觉得有启发/)).not.toBeInTheDocument();
  });

  it("should apply different sizes", async () => {
    const { rerender } = render(
      <LikeButton targetId="blog-1" targetType="blog" size="sm" />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: false })).toBeEnabled();
    });

    rerender(<LikeButton targetId="blog-1" targetType="blog" size="lg" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: false })).toBeEnabled();
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
      expect(screen.getByRole("button", { pressed: false })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { pressed: false }));

    await waitFor(() => {
      expect(screen.getByText(/点赞失败/)).toBeInTheDocument();
    });
  });

  it("should handle already liked error gracefully", async () => {
    vi.spyOn(likesLib, "createLike").mockRejectedValue(new Error("您已经点赞过了"));

    render(<LikeButton targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: false })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { pressed: false }));

    await waitFor(() => {
      expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
    });
  });
});
