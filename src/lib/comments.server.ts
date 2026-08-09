import type { Comment } from "./comments";
import type { InteractionTargetType } from "./interactionTarget";
import { getPayloadAPI } from "./payload";

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

const publicCommentSelect = {
  targetId: true,
  targetType: true,
  parentId: true,
  content: true,
  authorName: true,
  createdAt: true,
} as const;

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
    depth: 0,
    select: publicCommentSelect,
    overrideAccess: true,
  });

  const comments = result.docs.map((doc) =>
    toPublicComment(doc as StoredComment),
  );
  const parentIds = comments.map((comment) => comment.id);
  const replies = parentIds.length
    ? await payload.find({
        collection: "comments",
        where: {
          and: [
            { parentId: { in: parentIds } },
            { isDeleted: { equals: false } },
          ],
        },
        sort: "createdAt",
        limit: 1000,
        depth: 0,
        select: publicCommentSelect,
        overrideAccess: true,
      })
    : null;
  const repliesByParent = new Map<string, Comment[]>();

  for (const doc of replies?.docs ?? []) {
    const reply = toPublicComment(doc as StoredComment);
    if (!reply.parentId) continue;
    const group = repliesByParent.get(reply.parentId) ?? [];
    group.push(reply);
    repliesByParent.set(reply.parentId, group);
  }

  return {
    docs: comments.map((comment) => ({
      ...comment,
      replies: repliesByParent.get(comment.id) ?? [],
    })),
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
    depth: 0,
    select: publicCommentSelect,
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
  const payload = await getPayloadAPI();
  const result = await payload.count({
    collection: "comments",
    where: {
      and: [
        { targetId: { equals: targetId } },
        { targetType: { equals: targetType } },
        { isDeleted: { equals: false } },
        { parentId: { exists: false } },
      ],
    },
    overrideAccess: true,
  });
  return result.totalDocs;
}
