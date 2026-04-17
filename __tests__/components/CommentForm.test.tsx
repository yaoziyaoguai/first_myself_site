import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommentForm } from "@/components/CommentForm";

describe("CommentForm", () => {
  it("should render form elements", () => {
    render(<CommentForm onSubmit={vi.fn()} />);

    expect(screen.getByPlaceholderText("写下你的评论...")).toBeInTheDocument();
    expect(screen.getByText("发表评论")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("匿名用户")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
  });

  it("should render in compact mode", () => {
    render(<CommentForm onSubmit={vi.fn()} compact />);

    expect(screen.getByPlaceholderText("写下你的评论...")).toBeInTheDocument();
    // In compact mode, name and email inputs are hidden
    expect(screen.queryByPlaceholderText("匿名用户")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("your@email.com")).not.toBeInTheDocument();
  });

  it("should update character count when typing", () => {
    render(<CommentForm onSubmit={vi.fn()} />);

    const textarea = screen.getByPlaceholderText("写下你的评论...");
    fireEvent.change(textarea, { target: { value: "Hello world" } });

    expect(screen.getByText("11 / 1000")).toBeInTheDocument();
  });

  it("should show error when submitting empty content", async () => {
    render(<CommentForm onSubmit={vi.fn()} />);

    // 直接触发表单提交（因为按钮在空内容时禁用）
    const form = screen.getByPlaceholderText("写下你的评论...").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("评论内容不能为空")).toBeInTheDocument();
    });
  });

  it("should show error for invalid email", async () => {
    render(<CommentForm onSubmit={vi.fn()} />);

    const emailInput = screen.getByPlaceholderText("your@email.com");
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });

    const textarea = screen.getByPlaceholderText("写下你的评论...");
    fireEvent.change(textarea, { target: { value: "Test content" } });

    // 直接触发表单提交
    const form = textarea.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("请输入有效的邮箱地址")).toBeInTheDocument();
    });
  });

  it("should call onSubmit with correct data", async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);

    render(<CommentForm onSubmit={mockSubmit} />);

    const nameInput = screen.getByPlaceholderText("匿名用户");
    const emailInput = screen.getByPlaceholderText("your@email.com");
    const textarea = screen.getByPlaceholderText("写下你的评论...");

    fireEvent.change(nameInput, { target: { value: "John Doe" } });
    fireEvent.change(emailInput, { target: { value: "john@example.com" } });
    fireEvent.change(textarea, { target: { value: "Test comment" } });

    const submitButton = screen.getByText("发表评论");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        "Test comment",
        "John Doe",
        "john@example.com"
      );
    });
  });

  it("should use default name when not provided", async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);

    render(<CommentForm onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText("写下你的评论...");
    fireEvent.change(textarea, { target: { value: "Test comment" } });

    const submitButton = screen.getByText("发表评论");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        "Test comment",
        "匿名用户",
        ""
      );
    });
  });

  it("should clear form after successful submit", async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);

    render(<CommentForm onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText("写下你的评论...");
    fireEvent.change(textarea, { target: { value: "Test comment" } });

    const submitButton = screen.getByText("发表评论");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("should show loading state when submitting", () => {
    render(<CommentForm onSubmit={vi.fn()} isSubmitting={true} />);

    expect(screen.getByText("提交中...")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should disable submit when content is empty", () => {
    render(<CommentForm onSubmit={vi.fn()} />);

    const submitButton = screen.getByRole("button");
    expect(submitButton).toBeDisabled();
  });

  it("should show custom submit label", () => {
    render(<CommentForm onSubmit={vi.fn()} submitLabel="发表回复" />);

    expect(screen.getByText("发表回复")).toBeInTheDocument();
  });

  it("should handle submit errors", async () => {
    const mockSubmit = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<CommentForm onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText("写下你的评论...");
    fireEvent.change(textarea, { target: { value: "Test comment" } });

    const submitButton = screen.getByText("发表评论");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("should trim whitespace from content", async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);

    render(<CommentForm onSubmit={mockSubmit} />);

    const textarea = screen.getByPlaceholderText("写下你的评论...");
    fireEvent.change(textarea, { target: { value: "  Test content  " } });

    const submitButton = screen.getByText("发表评论");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        "Test content",
        "匿名用户",
        ""
      );
    });
  });

  describe("character limit", () => {
    it("should show warning when approaching character limit", () => {
      render(<CommentForm onSubmit={vi.fn()} />);

      const textarea = screen.getByPlaceholderText("写下你的评论...");
      const longText = "a".repeat(950);
      fireEvent.change(textarea, { target: { value: longText } });

      const charCount = screen.getByText("950 / 1000");
      expect(charCount).toHaveClass("text-destructive");
    });

    it("should enforce maximum character limit", () => {
      render(<CommentForm onSubmit={vi.fn()} />);

      const textarea = screen.getByPlaceholderText("写下你的评论...");
      const longText = "a".repeat(1000);

      fireEvent.change(textarea, { target: { value: longText } });

      // 组件允许最多 1000 字符
      expect(textarea).toHaveValue(longText);

      // 尝试输入超过 1000 字符，组件会忽略超长部分
      const tooLongText = "a".repeat(1001);
      fireEvent.change(textarea, { target: { value: tooLongText } });

      // 由于 state 未更新，textarea 仍显示旧值
      expect(textarea).toHaveValue(longText);
    });
  });
});
