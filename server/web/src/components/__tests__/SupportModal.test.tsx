import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportModal } from '../SupportModal';

describe('SupportModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<SupportModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders support links when isOpen is true', () => {
    render(<SupportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Support JobFoundry')).toBeInTheDocument();
    expect(screen.getByText('Star on GitHub')).toBeInTheDocument();
    expect(screen.getByText('Sponsor the Project')).toBeInTheDocument();
    expect(screen.getByText('Report Issues & Feedback')).toBeInTheDocument();
  });

  it('calls onClose when close buttons are clicked', () => {
    const onClose = vi.fn();
    render(<SupportModal isOpen={true} onClose={onClose} />);

    const closeBtns = screen.getAllByRole('button', { name: /Close/i });
    expect(closeBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
