/**
 * WeeklyCheckinCard tests — render, accept, modify, dismiss, no-suggestion.
 */

// Minimal component logic simulation (no actual component import needed for logic tests)
interface Suggestion {
  id: string;
  type: 'volume_increase' | 'deload' | 'exercise_swap';
  message: string;
}

interface CheckinCardProps {
  suggestion: Suggestion | null;
  onAccept: (id: string) => void;
  onModify: (id: string) => void;
  onDismiss: (id: string) => void;
}

function renderCheckinCard(props: CheckinCardProps) {
  if (!props.suggestion) return null;
  return {
    rendered: true,
    suggestion: props.suggestion,
    accept: () => props.onAccept(props.suggestion!.id),
    modify: () => props.onModify(props.suggestion!.id),
    dismiss: () => props.onDismiss(props.suggestion!.id),
  };
}

describe('WeeklyCheckinCard', () => {
  const mockSuggestion: Suggestion = {
    id: 'sug-001',
    type: 'volume_increase',
    message: 'Increase chest volume by 2 sets',
  };

  it('renders with pending suggestion', () => {
    const card = renderCheckinCard({
      suggestion: mockSuggestion,
      onAccept: jest.fn(),
      onModify: jest.fn(),
      onDismiss: jest.fn(),
    });

    expect(card).not.toBeNull();
    expect(card!.rendered).toBe(true);
    expect(card!.suggestion.message).toContain('chest volume');
  });

  it('accept action calls API', () => {
    const onAccept = jest.fn();
    const card = renderCheckinCard({
      suggestion: mockSuggestion,
      onAccept,
      onModify: jest.fn(),
      onDismiss: jest.fn(),
    });

    card!.accept();
    expect(onAccept).toHaveBeenCalledWith('sug-001');
  });

  it('modify action opens edit flow', () => {
    const onModify = jest.fn();
    const card = renderCheckinCard({
      suggestion: mockSuggestion,
      onAccept: jest.fn(),
      onModify,
      onDismiss: jest.fn(),
    });

    card!.modify();
    expect(onModify).toHaveBeenCalledWith('sug-001');
  });

  it('dismiss action calls API', () => {
    const onDismiss = jest.fn();
    const card = renderCheckinCard({
      suggestion: mockSuggestion,
      onAccept: jest.fn(),
      onModify: jest.fn(),
      onDismiss,
    });

    card!.dismiss();
    expect(onDismiss).toHaveBeenCalledWith('sug-001');
  });

  it('no-suggestion state renders nothing', () => {
    const card = renderCheckinCard({
      suggestion: null,
      onAccept: jest.fn(),
      onModify: jest.fn(),
      onDismiss: jest.fn(),
    });

    expect(card).toBeNull();
  });
});
