import { useEffect } from 'react';

const defaultDescription = '计算机科学与技术学院综测填写、奖学金申报和荣誉称号申报系统';

export function usePageMeta(title: string, description = defaultDescription) {
  useEffect(() => {
    document.title = title;

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', description);
    }
  }, [description, title]);
}
