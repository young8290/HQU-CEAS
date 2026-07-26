import type { ReactNode } from 'react';

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  /** 弹窗宽度类，默认 w-96；宽表单可传如 "w-[720px] max-w-[92vw]"。 */
  widthClass?: string;
}

/** 共享弹窗：点击遮罩关闭，点击面板不冒泡。原 StudentsPage/AccountsPage 等各自内联 Modal 的去重合一。 */
export default function Modal({ title, onClose, children, widthClass = 'w-96' }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className={`${widthClass} rounded-lg border border-[#ded6c8] bg-[#fffaf2] p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900`}
        onClick={(event) => event.stopPropagation()}
      >
        {title && <h3 className="text-lg font-semibold text-neutral-950 dark:text-white font-headings mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
