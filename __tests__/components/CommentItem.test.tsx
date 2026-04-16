import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentItem } from "./CommentItem";
import type { Comment } from "@/lib/comments";

// Mock child components
vi.mock("./CommentForm", () => ({
  CommentForm: ({ onSubmit, submitLabel }: { onSubmit: (c: string) => void; submitLabel: string }) => (
    <form data-testid="comment-form">
      <textarea data-testid="comment-textarea" />
      <button data-testid="submit-reply" onClick={() => onSubmit("Test reply")}>
        {submitLabel}
      </button>
    </form>
  ),
}));

describe("CommentItem", () => {
  const mockComment: Comment = {
    id: "1",
    content: "Test comment content",
    authorName: "Test User",
    createdAt: "2026-04-17T10:00:00.000Z",
    updatedAt: "2026-04-17T10:00:00.000Z",
    isDeleted: false,
    ipHash: "hash1",
    targetId: "blog-1",
    targetType: "blog",
  };

  it("should render comment content", () => {
    render(
      <CommentItem
        comment={mockComment}
        isAuthor={false}
        currentUserIsAdmin={false}
      />
    );

    expect(screen.getByText("Test comment content")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("should display author badge for author replies", () => {
    render(
      <CommentItem
        comment={mockComment}
        isAuthor={true}
        currentUserIsAdmin={false}
      />
    );

    expect(screen.getByText("博主")).toBeInTheDocument();
  });

  it("should show delete button for admin", () => {
    render(
      <CommentItem
        comment={mockComment}
        isAuthor={false}
        currentUserIsAdmin={true}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("删除")).toBeInTheDocument();
  });

  it("should hide delete button for non-admin", () => {
    render(
      <CommentItem
        comment={mockComment}
        isAuthor={false}
        currentUserIsAdmin={false}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByText("删除")).not.toBeInTheDocument();
  });

  it("should show deleted message for deleted comments", () => {
    const deletedComment = {
      ...mockComment,
      isDeleted: true,
      deletedBy: "admin",
    };

    render(
      <CommentItem
        comment={deletedComment}
        isAuthor={false}
        currentUserIsAdmin={false}
      />
    );

    expect(screen.getByText(/评论已删除/)).toBeInTheDocument();
    expect(screen.getByText(/由 admin 删除/)).toBeInTheDocument();
  });

  it("should toggle reply form on reply button click", () => {
    render(
      <CommentItem
        comment={mockComment}
        isAuthor={false}
        currentUserIsAdmin={false}
      />
    );

    const replyButton = screen.getByText("回复");
    fireEvent.click(replyButton);

    expect(screen.getByTestId("comment-form")).toBeInTheDocument();
  });

  it("should render nested replies", () => {
    const commentWithReplies: Comment = {
      ...mockComment,
      replies: [
        {
          id: "2",
          content: "Reply content",
          authorName: "Reply User",
          createdAt: "2026-04-17T11:00:00.000Z",
          updatedAt: "2026-04-17T11:00:00.000Z",
          isDeleted: false,
          ipHash: "hash2",
          targetId: "blog-1",
          targetType: "blog",
          parentId: "1",
        },
      ],
    };

    render(
      <CommentItem
        comment={commentWithReplies}
        isAuthor={false}
        currentUserIsAdmin={false}
      />
    );

    expect(screen.getByText("Reply content")).toBeInTheDocument();
  });

  it("should call onDelete when delete button clicked", () => {
    const mockDelete = vi.fn();

    render(
      <CommentItem
        comment={mockComment}
        isAuthor={false}
        currentUserIsAdmin={true}
        onDelete={mockDelete}
      />
    );

    const deleteButton = screen.getByText("删除");
    fireEvent.click(deleteButton);

    expect(mockDelete).toHaveBeenCalledWith("1");
  });

  it("should format time correctly", () => {
    render(
      <CommentItem
        comment={mockComment}
        isAuthor={false}
        currentUserIsAdmin={false}
      />
    );

    // Check for formatted time (format may vary by locale)
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  describe("depth limitations", () => {
    it("should hide reply button at max depth", () => {
      render(
        <CommentItem
          comment={mockComment}
          isAuthor={false}
          currentUserIsAdmin={false}
          depth={4}
          maxDepth={5}
        />
      );

      // At depth 4 with maxDepth 5, reply should be hidden (depth < maxDepth - 1)
      expect(screen.queryByText("回复")).not.toBeInTheDocument();
    });

    it("should show reply button below max depth", () => {
      render(
        <CommentItem
          comment={mockComment}
          isAuthor={false}
          currentUserIsAdmin={false}
          depth={2}
          maxDepth={5}
        />
      );

      expect(screen.getByText("回复")).toBeInTheDocument();
    });
  });
});
