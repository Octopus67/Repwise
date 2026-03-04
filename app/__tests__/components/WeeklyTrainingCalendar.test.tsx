import React from 'react';
import { render } from '@testing-library/react-native';
import { WeeklyTrainingCalendar } from '../../components/dashboard/WeeklyTrainingCalendar';

// Mock the Icon component to avoid SVG rendering issues in tests
jest.mock('../../components/common/Icon', () => ({
  Icon: ({ name }: { name: string }) => null,
}));

describe('WeeklyTrainingCalendar', () => {
  const mockSelectedDate = '2024-01-15'; // Monday
  const mockTrainedDates = new Set(['2024-01-15', '2024-01-17', '2024-01-19']); // Mon, Wed, Fri

  it('renders without crashing', () => {
    const { root } = render(
      <WeeklyTrainingCalendar
        selectedDate={mockSelectedDate}
        trainedDates={mockTrainedDates}
      />
    );

    expect(root).toBeTruthy();
  });

  it('renders with empty trained dates', () => {
    const { root } = render(
      <WeeklyTrainingCalendar
        selectedDate={mockSelectedDate}
        trainedDates={new Set()}
      />
    );

    expect(root).toBeTruthy();
  });

  it('handles different selected dates', () => {
    const { root } = render(
      <WeeklyTrainingCalendar
        selectedDate="2024-02-01" // Different week
        trainedDates={new Set(['2024-02-01'])}
      />
    );

    expect(root).toBeTruthy();
  });
});