import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleSuggestionModal } from '../RoleSuggestionModal';

describe('RoleSuggestionModal', () => {
  const sampleRoles = [
    'AI Operations Specialist',
    'Chief of Staff',
    'Market Research Analyst',
    'Strategy & Operations Lead',
  ];

  it('renders modal with all roles selected by default', () => {
    render(
      <RoleSuggestionModal
        isOpen={true}
        onClose={vi.fn()}
        roles={sampleRoles}
        source="llm"
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText('AI Role Keyword Suggestions')).toBeInTheDocument();
    expect(screen.getByText('✨ AI Synthesized')).toBeInTheDocument();
    expect(screen.getByText('4 of 4 selected')).toBeInTheDocument();

    sampleRoles.forEach((role) => {
      const chip = screen.getByRole('checkbox', { name: role });
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('allows toggling individual roles and deselecting / selecting all', () => {
    render(
      <RoleSuggestionModal
        isOpen={true}
        onClose={vi.fn()}
        roles={sampleRoles}
        source="llm"
        onApply={vi.fn()}
      />
    );

    // Toggle off the first role
    const firstRoleChip = screen.getByRole('checkbox', { name: 'AI Operations Specialist' });
    fireEvent.click(firstRoleChip);
    expect(firstRoleChip).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('3 of 4 selected')).toBeInTheDocument();

    // Deselect All
    fireEvent.click(screen.getByRole('button', { name: /^Deselect All$/i }));
    expect(screen.getByText('0 of 4 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Selected Roles/i })).toBeDisabled();

    // Select All
    fireEvent.click(screen.getByRole('button', { name: /^Select All$/i }));
    expect(screen.getByText('4 of 4 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Selected Roles/i })).not.toBeDisabled();
  });

  it('applies selected roles with append or replace mode', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <RoleSuggestionModal
        isOpen={true}
        onClose={onClose}
        roles={sampleRoles}
        source="llm"
        onApply={onApply}
      />
    );

    // Switch to replace mode
    fireEvent.click(screen.getByLabelText(/Replace all existing/i));

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Add Selected Roles \(4\)/i }));

    expect(onApply).toHaveBeenCalledWith(sampleRoles, 'replace');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key and close button', () => {
    const onClose = vi.fn();

    render(
      <RoleSuggestionModal
        isOpen={true}
        onClose={onClose}
        roles={sampleRoles}
        source="heuristic"
        notice="Heuristic fallback"
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText('Standard Heuristic')).toBeInTheDocument();
    expect(screen.getByText(/Heuristic fallback/i)).toBeInTheDocument();

    // Close button
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Overlay click
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
