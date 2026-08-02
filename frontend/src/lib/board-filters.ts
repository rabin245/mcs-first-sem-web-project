export type SortMode = "created" | "priority" | "dueDate" | "title";

export interface BoardFilters {
  assignedToId: string | null;
  priority: number | null;
  search: string;
  sort: SortMode;
}

export const defaultFilters: BoardFilters = {
  assignedToId: null,
  priority: null,
  search: "",
  sort: "created",
};
