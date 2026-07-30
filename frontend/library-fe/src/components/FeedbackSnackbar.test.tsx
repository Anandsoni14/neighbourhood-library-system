import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/tests/test-utils';

import { FeedbackSnackbar } from './FeedbackSnackbar';

describe('FeedbackSnackbar', () => {
  it('renders the message with the given severity when open', () => {
    render(
      <FeedbackSnackbar open message="Something failed." severity="error" onClose={vi.fn()} />,
    );

    const alert = screen.getByText('Something failed.').closest('[role="alert"]');
    expect(alert).toHaveClass('MuiAlert-colorError');
  });

  it('renders nothing when closed', () => {
    render(
      <FeedbackSnackbar
        open={false}
        message="Something failed."
        severity="error"
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText('Something failed.')).not.toBeInTheDocument();
  });

  it('calls onClose when the alert is dismissed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FeedbackSnackbar open message="Saved." severity="success" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
