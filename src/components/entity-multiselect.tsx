"use client";

interface Entity {
  id: number;
  name: string;
}

/**
 * Multi-select list of clients or suppliers, used by translation rule modals
 * so one rule can target several entities at once.
 */
export default function EntityMultiSelect({
  entities,
  selectedIds,
  onToggle,
  emptyText = "No items available",
}: {
  entities: Entity[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  emptyText?: string;
}) {
  if (entities.length === 0) {
    return <p className="text-xs text-slate-400 italic">{emptyText}</p>;
  }

  return (
    <div className="border border-slate-300 rounded-lg bg-white max-h-40 overflow-y-auto">
      {entities.map((e) => {
        const checked = selectedIds.includes(e.id);
        return (
          <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(e.id)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span className="text-sm text-slate-700">{e.name}</span>
          </label>
        );
      })}
    </div>
  );
}
