import { getPayloadAPI } from "./payload";

export type InteractionTargetType = "blog" | "project";

export function isInteractionTargetType(
  value: unknown,
): value is InteractionTargetType {
  return value === "blog" || value === "project";
}

export async function targetExists(
  targetId: string,
  targetType: InteractionTargetType,
): Promise<boolean> {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: targetType === "blog" ? "blog" : "projects",
    where:
      targetType === "blog"
        ? {
            and: [
              { id: { equals: targetId } },
              { status: { equals: "published" } },
              { visibility: { equals: "public" } },
            ],
          }
        : { id: { equals: targetId } },
    limit: 1,
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
  const result = await payload.find({
    collection: "comments",
    where: {
      and: [
        { id: { equals: parentId } },
        { targetId: { equals: targetId } },
        { targetType: { equals: targetType } },
        { isDeleted: { equals: false } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  return result.totalDocs > 0;
}
