import type { InteractionTargetType } from "./interactionTarget.server";
import { targetExists } from "./interactionTarget.server";
import type { LikeStatus } from "./likes";
import { getPayloadAPI } from "./payload";

export { targetExists };

type LikeIdentity = { ipHash: string; fingerprint: string };

export async function getLikeStatus(
  targetId: string,
  targetType: InteractionTargetType,
  identity: LikeIdentity,
): Promise<LikeStatus> {
  const payload = await getPayloadAPI();
  const [countResult, userLikeResult] = await Promise.all([
    payload.find({
      collection: "likes",
      where: {
        and: [
          { targetId: { equals: targetId } },
          { targetType: { equals: targetType } },
        ],
      },
      limit: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: "likes",
      where: {
        and: [
          { targetId: { equals: targetId } },
          { targetType: { equals: targetType } },
          { ipHash: { equals: identity.ipHash } },
          { fingerprint: { equals: identity.fingerprint } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    }),
  ]);

  return {
    count: countResult.totalDocs,
    hasLiked: userLikeResult.totalDocs > 0,
  };
}

export async function createLike(
  data: {
    targetId: string;
    targetType: InteractionTargetType;
  } & LikeIdentity,
): Promise<void> {
  const payload = await getPayloadAPI();
  const existing = await payload.find({
    collection: "likes",
    where: {
      and: [
        { targetId: { equals: data.targetId } },
        { targetType: { equals: data.targetType } },
        { ipHash: { equals: data.ipHash } },
        { fingerprint: { equals: data.fingerprint } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  if (existing.totalDocs > 0) throw new Error("LIKE_ALREADY_EXISTS");

  try {
    await payload.create({
      collection: "likes",
      data: {
        targetId: data.targetId,
        targetType: data.targetType,
        ipHash: data.ipHash,
        fingerprint: data.fingerprint,
      },
      overrideAccess: true,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /unique|duplicate/i.test(`${error.name} ${error.message}`)
    ) {
      throw new Error("LIKE_ALREADY_EXISTS");
    }
    throw error;
  }
}

export async function getLikeCount(
  targetId: string,
  targetType: InteractionTargetType,
): Promise<number> {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "likes",
    where: {
      and: [
        { targetId: { equals: targetId } },
        { targetType: { equals: targetType } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  });
  return result.totalDocs;
}
