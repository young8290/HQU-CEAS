import type { ReactNode } from 'react';

interface DataPanelProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function DataPanel({ title, description, actions, children }: DataPanelProps) {
  return (
    <section className="rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex flex-col gap-3 border-b border-[#e4d8ca] pb-4 dark:border-neutral-800 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
