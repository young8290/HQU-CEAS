import {
  startTransition,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

const routeChangeEvent = 'app:navigate';

function normalizePath(path: string) {
  if (!path) return '/';

  const [pathname] = path.split(/[?#]/);
  const normalized = pathname.endsWith('/') && pathname !== '/'
    ? pathname.slice(0, -1)
    : pathname;

  return normalized || '/';
}

function shouldHandleNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

export function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '/';
  }

  return normalizePath(window.location.pathname);
}

export function navigateTo(
  path: string,
  options: { replace?: boolean } = {},
) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPath = normalizePath(path);
  const method = options.replace ? 'replaceState' : 'pushState';

  if (normalizedPath !== getCurrentPath()) {
    window.history[method]({}, '', normalizedPath);
  }

  window.dispatchEvent(new Event(routeChangeEvent));
}

export function useCurrentPath() {
  const [path, setPath] = useState(getCurrentPath);

  useEffect(() => {
    const updatePath = () => {
      startTransition(() => {
        setPath(getCurrentPath());
      });
    };

    window.addEventListener('popstate', updatePath);
    window.addEventListener(routeChangeEvent, updatePath);

    // Catch up with any navigation that happened before the listeners mounted.
    updatePath();

    return () => {
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener(routeChangeEvent, updatePath);
    };
  }, []);

  return path;
}

interface AppLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

export function AppLink({ to, onClick, children, ...props }: AppLinkProps) {
  const href = normalizePath(to);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (!shouldHandleNavigation(event) || props.target === '_blank') {
      return;
    }

    event.preventDefault();
    navigateTo(href);
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
