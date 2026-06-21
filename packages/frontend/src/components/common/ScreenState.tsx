interface ScreenStateProps {
  label: string;
  fullScreen?: boolean;
}

export default function ScreenState({
  label,
  fullScreen = false,
}: ScreenStateProps) {
  return (
    <div
      className={
        fullScreen
          ? 'min-h-screen flex items-center justify-center bg-[#f6f1e8] dark:bg-neutral-950'
          : 'flex items-center justify-center h-64'
      }
    >
      <div className="rounded-md border border-[#ded6c8] bg-[#fffaf2] px-4 py-3 text-sm text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        {label}
      </div>
    </div>
  );
}
