interface Props {
  label: string;
}

/**
 * Non-clickable group header that labels a cluster of nav items.
 * Only used in the expanded sidebar — the collapsed rail drops section
 * breaks entirely (icons are distinct enough to read without them).
 */
export function SidebarSection({ label }: Props) {
  return (
    <p className="select-none px-3 pt-2 pb-0.5 text-xs font-bold uppercase tracking-[0.08em] text-sidebar-foreground/55">
      {label}
    </p>
  );
}
