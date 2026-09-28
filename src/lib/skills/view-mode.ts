export type SkillViewMode = "grid" | "list";

export function parseSkillViewMode(value: string | null): SkillViewMode {
  return value === "list" ? "list" : "grid";
}
