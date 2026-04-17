import { describe, it, expect, vi, beforeEach, waitFor } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentSection } from "@/components/CommentSection";
import * as commentsLib from "@/lib/comments";
import * as authLib from "@/lib/auth";

// Mock child components
vi.mock("./CommentItem", () => ({
  CommentItem: ({
    comment,
    onDelete,
    onReply,
  }: {
    comment: { id: string; content: string };
    onDelete?: (id: string) => void;
    onReply?: (id: string, content: string) => void;
  }) => (
    <div data-testid={`comment-${comment.id}`}>
      <span>{comment.content}</span>
      {onDelete && (
        <button data-testid={`delete-${comment.id}`} onClick={() => onDelete(comment.id)}>
          删除
        </button>
      )}
      {onReply && (
        <button data-testid={`reply-${comment.id}`} onClick={() => onReply(comment.id, "Test reply")}>
          回复
        </button>
      )}
    </div>
  ),
}));

vi.mock("./CommentForm", () => ({
  CommentForm: ({ onSubmit, isSubmitting }: { onSubmit: (c: string, n: string, e: string) => Promise<void>; isSubmitting?: boolean }) => (
    <form data-testid="comment-form">
      <textarea data-testid="comment-textarea" />
      <button
        data-testid="submit-comment"
        onClick={() => onSubmit("Test comment", "Test User", "test@example.com")}
        disabled={isSubmitting}
      >
        {isSubmitting ? "提交中..." : "发表评论"}
      </button>
    </form>
  ),
}));

// Mock fetch for IP API
global.fetch = vi.fn();

describe("CommentSection", () => {
  const mockComments = [
    {
      id: "1",
      content: "First comment",
      authorName: "User 1",
      createdAt: "2026-04-17T10:00:00.000Z",
      updatedAt: "2026-04-17T10:00:00.000Z",
      isDeleted: false,
      ipHash: "hash1",
      targetId: "blog-1",
      targetType: "blog" as const,
      replies: [],
    },
    {
      id: "2",
      content: "Second comment",
      authorName: "User 2",
      createdAt: "2026-04-17T11:00:00.000Z",
      updatedAt: "2026-04-17T11:00:00.000Z",
      isDeleted: false,
      ipHash: "hash2",
      targetId: "blog-1",
      targetType: "blog" as const,
      replies: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock isAdmin
    vi.spyOn(authLib, "isAdmin").mockResolvedValue(false);

    // Mock getComments
    vi.spyOn(commentsLib, "getComments").mockResolvedValue({
      docs: mockComments,
      totalDocs: 2,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });

    // Mock getReplies
    vi.spyOn(commentsLib, "getReplies").mockResolvedValue([]);

    // Mock fetch for IP
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ip: "127.0.0.1" }),
    });
  });

  it("should render comment section with title", async () => {
    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("评论")).toBeInTheDocument();
    });
  });

  it("should show comment count in title", async () => {
    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText(/评论/)).toBeInTheDocument();
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });
  });

  it("should render comment form", async () => {
    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByTestId("comment-form")).toBeInTheDocument();
    });
  });

  it("should load and display comments", async () => {
    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByTestId("comment-1")).toBeInTheDocument();
      expect(screen.getByTestId("comment-2")).toBeInTheDocument();
    });

    expect(screen.getByText("First comment")).toBeInTheDocument();
    expect(screen.getByText("Second comment")).toBeInTheDocument();
  });

  it("should check admin status on mount", async () => {
    const isAdminSpy = vi.spyOn(authLib, "isAdmin").mockResolvedValue(true);

    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(isAdminSpy).toHaveBeenCalled();
    });
  });

  it("should show loading state initially", () => {
    render(<CommentSection targetId="blog-1" targetType="blog" />);

    expect(screen.getByText("评论")).toBeInTheDocument();
  });

  it("should show empty state when no comments", async () => {
    vi.spyOn(commentsLib, "getComments").mockResolvedValue({
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });

    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText(/暂无评论/)).toBeInTheDocument();
    });
  });

  it("should handle comment submission", async () => {
    const createCommentSpy = vi.spyOn(commentsLib, "createComment").mockResolvedValue({
      id: "3",
      content: "Test comment",
      authorName: "Test User",
      createdAt: "2026-04-17T12:00:00.000Z",
      updatedAt: "2026-04-17T12:00:00.000Z",
      isDeleted: false,
      ipHash: "hash3",
      targetId: "blog-1",
      targetType: "blog",
    });

    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByTestId("submit-comment")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("submit-comment"));

    await waitFor(() => {
      expect(createCommentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "blog-1",
          targetType: "blog",
          content: "Test comment",
          authorName: "Test User",
          authorEmail: "test@example.com",
        })
      );
    });
  });

  it("should handle reply submission", async () => {
    const createCommentSpy = vi.spyOn(commentsLib, "createComment").mockResolvedValue({
      id: "3",
      content: "Test reply",
      authorName: "匿名用户",
      createdAt: "2026-04-17T12:00:00.000Z",
      updatedAt: "2026-04-17T12:00:00.000Z",
      isDeleted: false,
      ipHash: "hash3",
      targetId: "blog-1",
      targetType: "blog",
      parentId: "1",
    });

    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByTestId("reply-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("reply-1"));

    await waitFor(() => {
      expect(createCommentSpy).toHaveBeenCalled();
    });
  });

  it("should handle comment deletion for admin", async () => {
    vi.spyOn(authLib, "isAdmin").mockResolvedValue(true);
    const softDeleteSpy = vi.spyOn(commentsLib, "softDeleteComment").mockResolvedValue({
      id: "1",
      content: "First comment",
      authorName: "User 1",
      createdAt: "2026-04-17T10:00:00.000Z",
      updatedAt: "2026-04-17T10:00:00.000Z",
      isDeleted: true,
      deletedBy: "admin",
      ipHash: "hash1",
      targetId: "blog-1",
      targetType: "blog",
    });

    // Mock confirm
    window.confirm = vi.fn(() => true);

    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByTestId("delete-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("delete-1"));

    await waitFor(() => {
      expect(softDeleteSpy).toHaveBeenCalledWith("1");
    });
  });

  it("should show load more button when has more comments", async () => {
    vi.spyOn(commentsLib, "getComments").mockResolvedValue({
      docs: [mockComments[0]],
      totalDocs: 5,
      totalPages: 2,
      page: 1,
      hasNextPage: true,
      hasPrevPage: false,
    });

    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("加载更多评论")).toBeInTheDocument();
    });
  });

  it("should load more comments when clicking load more", async () => {
    const getCommentsSpy = vi
      .spyOn(commentsLib, "getComments")
      .mockResolvedValueOnce({
        docs: [mockComments[0]],
        totalDocs: 3,
        totalPages: 2,
        page: 1,
        hasNextPage: true,
        hasPrevPage: false,
      })
      .mockResolvedValueOnce({
        docs: [mockComments[1]],
        totalDocs: 3,
        totalPages: 2,
        page: 2,
        hasNextPage: false,
        hasPrevPage: true,
      });

    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText("加载更多评论")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("加载更多评论"));

    await waitFor(() => {
      expect(getCommentsSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("should handle error when loading comments", async () => {
    vi.spyOn(commentsLib, "getComments").mockRejectedValue(new Error("Network error"));

    render(<CommentSection targetId="blog-1" targetType="blog" />);

    await waitFor(() => {
      expect(screen.getByText(/加载评论失败/)).toBeInTheDocument();
    });
  });

  it("should apply custom className", () => {
    const { container } = render(
      <CommentSection targetId="blog-1" targetType="blog" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
