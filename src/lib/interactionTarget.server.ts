import { buildBlogFrontendWhere } from "./blogVisibility";
import type { InteractionTargetType } from "./interactionTarget";
import { getPayloadAPI } from "./payload";

export async function targetExists(
  targetId: string,
  targetType: InteractionTargetType,
): Promise<boolean> {
  const payload = await getPayloadAPI();
  const result = await payload.count({
    collection: targetType === "blog" ? "blog" : "projects",
    where:
      targetType === "blog"
        ? {
            and: [
              { id: { equals: targetId } },
              buildBlogFrontendWhere(null),
            ],
          }
        : { id: { equals: targetId } },
    overrideAccess: true,
  });

  return result.totalDocs > 0;
}

export async function parentMatchesTarget(
  parentId: string,
  targetId: string,
  targetType: InteractionTargetType,
): Promise<boolean> {
  const payload = await getPayloadAPI();
  const result = await payload.count({
    collection: "comments",
    where: {
      and: [
        { id: { equals: parentId } },
        { targetId: { equals: targetId } },
        { targetType: { equals: targetType } },
        { isDeleted: { equals: false } },
        { parentId: { exists: false } },
      ],
    },
    overrideAccess: true,
  });

  return result.totalDocs > 0;
}
