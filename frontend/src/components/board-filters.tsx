import { Filter, X } from "lucide-react";
import type { User } from "@/lib/types";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./ui/combobox";
import {
  defaultFilters,
  type BoardFilters,
  type SortMode,
} from "@/lib/board-filters";

const ANY = "__any__";

interface AssigneeOption {
  value: string;
  label: string;
  hint?: string;
}

export function BoardFiltersBar({
  filters,
  onChange,
  members,
}: {
  filters: BoardFilters;
  onChange: (next: BoardFilters) => void;
  members: User[];
}) {
  const active =
    filters.assignedToId !== null ||
    filters.priority !== null ||
    filters.search !== "" ||
    filters.sort !== "created";

  const assigneeItems: AssigneeOption[] = members.map((m) => ({
    value: m.id,
    label: m.username,
    hint: m.email,
  }));
  const selectedAssignee =
    assigneeItems.find((o) => o.value === filters.assignedToId) ?? null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      <span className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Filter className="size-3.5" /> Filter
      </span>

      <input
        type="search"
        placeholder="Search tasks..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />

      <Combobox<AssigneeOption>
        items={assigneeItems}
        value={selectedAssignee}
        isItemEqualToValue={(a, b) => a.value === b.value}
        onValueChange={(v) =>
          onChange({ ...filters, assignedToId: v?.value ?? null })
        }
      >
        <ComboboxInput
          showClear={!!selectedAssignee}
          placeholder="Any assignee"
          className="w-[160px] rounded-md bg-transparent dark:bg-transparent"
        />
        <ComboboxContent>
          <ComboboxEmpty>No members</ComboboxEmpty>
          <ComboboxList>
            {(item: AssigneeOption) => (
              <ComboboxItem key={item.value} value={item}>
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate">{item.label}</span>
                  {item.hint && (
                    <span className="truncate text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <Select
        value={filters.priority !== null ? String(filters.priority) : ANY}
        onValueChange={(v) =>
          onChange({ ...filters, priority: v === ANY ? null : Number(v) })
        }
      >
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any priority</SelectItem>
          <SelectItem value="1">1 - Highest</SelectItem>
          <SelectItem value="2">2</SelectItem>
          <SelectItem value="3">3</SelectItem>
          <SelectItem value="4">4</SelectItem>
          <SelectItem value="5">5 - Lowest</SelectItem>
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort</span>
        <Select
          value={filters.sort}
          onValueChange={(v) => onChange({ ...filters, sort: v as SortMode })}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="dueDate">Due date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>

        {active && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(defaultFilters)}
            className="h-8"
          >
            <X /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
