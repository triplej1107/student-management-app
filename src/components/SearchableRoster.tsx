"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui";

export function SearchableRoster({
  items,
  placeholder,
  emptyLabel,
}: {
  items: { key: string | number; searchText: string; node: ReactNode }[];
  placeholder: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.searchText.toLowerCase().includes(q)) : items;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full box-border rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />
      <div className="mt-3 flex flex-col gap-2.5">
        {filtered.length === 0 && <EmptyState>{emptyLabel}</EmptyState>}
        {filtered.map((i) => (
          <div key={i.key}>{i.node}</div>
        ))}
      </div>
    </div>
  );
}
