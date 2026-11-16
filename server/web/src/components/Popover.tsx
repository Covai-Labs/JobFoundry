import React, { useEffect, useRef, useState } from 'react';

interface PopoverProps {
  /** Renders the control that opens the panel. */
  trigger: (args: { open: boolean; toggle: () => void }) => React.ReactNode;
  /** Renders the panel body. `close` dismisses the panel. */
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * Minimal click-triggered panel: closes on outside click, Escape, or when the
 * consumer calls `close`. Keeps menu markup and dismissal logic in one place
 * so the stage picker and the job overflow menu behave identically.
 */
export const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  align = 'end',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
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
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div className={`popover-panel popover-panel-${align}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};
