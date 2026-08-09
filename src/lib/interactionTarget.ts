export type InteractionTargetType = "blog" | "project";

export function isInteractionTargetType(
  value: unknown,
): value is InteractionTargetType {
  return value === "blog" || value === "project";
}
