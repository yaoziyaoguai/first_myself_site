import type { Comment } from "./comments";
import type { InteractionTargetType } from "./interactionTarget.server";
import {
  parentMatchesTarget,
  targetExists,
} from "./interactionTarget.server";
import { getPayloadAPI } from "./payload";

export { parentMatchesTarget, targetExists };

type StoredComment = Record<string, unknown> & { id: number | string };

export function toPublicComment(doc: StoredComment): Comment {
  return {
    id: String(doc.id),
    targetId: String(doc.targetId ?? ""),
    targetType: doc.targetType === "project" ? "project" : "blog",
    parentId: doc.parentId ? String(doc.parentId) : null,
    content: String(doc.content ?? ""),
    authorName: String(doc.authorName || "匿名用户"),
    createdAt: String(doc.createdAt ?? ""),
  };
}

export async function getComments(
  targetId: string,
  targetType: InteractionTargetType,
  limit = 10,
  page = 1,
): Promise<{ docs: Comment[]; totalDocs: number; totalPages: number }> {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "comments",
    where: {
      and: [
        { targetId: { equals: targetId } },
        { targetType: { equals: targetType } },
        { isDeleted: { equals: false } },
        { parentId: { exists: false } },
      ],
    },
    sort: "-createdAt",
    limit,
    page,
    overrideAccess: true,
  });

  return {
    docs: result.docs.map((doc) => toPublicComment(doc as StoredComment)),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  };
}

export async function getReplies(parentId: string): Promise<Comment[]> {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "comments",
    where: {
      and: [
        { parentId: { equals: parentId } },
        { isDeleted: { equals: false } },
      ],
    },
    sort: "createdAt",
    limit: 100,
    overrideAccess: true,
  });
  return result.docs.map((doc) => toPublicComment(doc as StoredComment));
}

type CreateStoredCommentData = {
  targetId: string;
  targetType: InteractionTargetType;
  parentId?: string | null;
  content: string;
  authorName?: string;
  authorEmail?: string;
  ipHash: string;
  fingerprint: string;
};

export async function createComment(
  data: CreateStoredCommentData,
): Promise<Comment> {
  const payload = await getPayloadAPI();
  const result = await payload.create({
    collection: "comments",
    data: {
      targetId: data.targetId,
      targetType: data.targetType,
      parentId: data.parentId || undefined,
      content: data.content,
      authorName: data.authorName || "匿名用户",
      authorEmail: data.authorEmail || "",
      ipHash: data.ipHash,
      fingerprint: data.fingerprint,
      isDeleted: false,
    },
    overrideAccess: true,
  });
  return toPublicComment(result as StoredComment);
}

export async function softDeleteComment(commentId: string): Promise<{ id: string }> {
  const payload = await getPayloadAPI();
  const result = await payload.update({
    collection: "comments",
    id: commentId,
    data: { isDeleted: true, deletedBy: "admin" },
    overrideAccess: true,
  });
  return { id: String(result.id) };
}

export async function getCommentCount(
  targetId: string,
  targetType: InteractionTargetType,
): Promise<number> {
  return (await getComments(targetId, targetType, 1, 1)).totalDocs;
}
