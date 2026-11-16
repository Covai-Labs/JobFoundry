import React, { useEffect, useRef } from 'react';

interface PopoverProps {
  /** Whether the panel is visible. The caller owns this state. */
  open: boolean;
  /** Called when the panel should close (outside click, Escape, item click). */
  onClose: () => void;
  /** The control that opens the panel; rendered next to the panel anchor. */
  trigger: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
  children: React.ReactNode;
}

/**
 * Minimal click-triggered panel: closes on outside click, Escape, or when the
 * consumer calls `onClose`. Keeps menu markup, dismissal and roving focus in
 * one place so the stage picker and the job overflow menu behave identically.
 */
export const Popover: React.FC<PopoverProps> = ({
  open,
  onClose,
  trigger,
  align = 'end',
  className = '',
  children,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the latest handler without re-binding document listeners every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Remember who had focus so Escape can hand it back to the trigger.
  const focusBeforeOpenRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    focusBeforeOpenRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = wrapRef.current?.querySelector<HTMLElement>('.popover-panel');
    const items = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          '[role="menuitem"], [role="menuitemradio"], button:not([disabled])'
        ) ?? []
      );

    // Menu pattern: focus enters the panel when it opens.
    items()[0]?.focus();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        onCloseRef.current();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        focusBeforeOpenRef.current?.focus();
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      const list = items();
      if (list.length === 0) return;

      event.preventDefault();
      const current = list.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = (current + step + list.length) % list.length;
      list[next].focus();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`popover ${className}`.trim()} ref={wrapRef}>
      {trigger}
      {open && <div className={`popover-panel popover-panel-${align}`}>{children}</div>}
    </div>
  );
};
