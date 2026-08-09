import type { InteractionTargetType } from "./interactionTarget";
import type { LikeStatus } from "./likes";
import { getPayloadAPI } from "./payload";

type LikeIdentity = { ipHash: string; fingerprint: string };

export async function getLikeStatus(
  targetId: string,
  targetType: InteractionTargetType,
  identity: LikeIdentity,
): Promise<LikeStatus> {
  const payload = await getPayloadAPI();
  const [countResult, userLikeResult] = await Promise.all([
    payload.count({
      collection: "likes",
      where: {
        and: [
          { targetId: { equals: targetId } },
          { targetType: { equals: targetType } },
        ],
      },
      overrideAccess: true,
    }),
    payload.count({
      collection: "likes",
      where: {
        and: [
          { targetId: { equals: targetId } },
          { targetType: { equals: targetType } },
          { ipHash: { equals: identity.ipHash } },
          { fingerprint: { equals: identity.fingerprint } },
        ],
      },
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
  const result = await payload.count({
    collection: "likes",
    where: {
      and: [
        { targetId: { equals: targetId } },
        { targetType: { equals: targetType } },
      ],
    },
    overrideAccess: true,
  });
  return result.totalDocs;
}
