import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AiExplanation } from '../../extension/src/components/AiExplanation';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const input = { text: 'Urgent: confirm your password.', url: 'https://example.com/path?secret=hidden', links: [] };

it('requires preview approval before sending and keeps provider keys out of requests', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ message: 'Evidence explanation', findings: [] }));
  vi.stubGlobal('fetch', fetcher); vi.stubGlobal('__AFTERCLICK_API_ORIGIN__', 'http://localhost:8080');
  render(<AiExplanation input={input} />);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Review AI scan' }));
  expect(screen.getByRole('button', { name: 'Send to OpenAI' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Send to OpenAI' }));
  await screen.findByText('Evidence explanation');
  expect(fetcher).toHaveBeenCalledTimes(1);
  const options = fetcher.mock.calls[0]![1];
  expect(options.headers.Authorization).toBeUndefined();
  expect(options.body).not.toContain('secret=hidden');
});

it('displays provider failures and offers retry without altering local scan data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'OpenAI API credits have run out.' }, { status: 503 })));
  vi.stubGlobal('__AFTERCLICK_API_ORIGIN__', 'http://localhost:8080');
  render(<AiExplanation input={input} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review AI scan' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Send to OpenAI' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('credits have run out');
  expect(screen.getByRole('button', { name: 'Send to OpenAI' })).toBeEnabled();
});

it('ignores an old result when the selected text changes', async () => {
  let resolve!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise((r) => { resolve = r; })));
  vi.stubGlobal('__AFTERCLICK_API_ORIGIN__', 'http://localhost:8080');
  const view = render(<AiExplanation input={input} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review AI scan' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Send to OpenAI' }));
  view.rerender(<AiExplanation input={{ ...input, text: 'Different sample' }} />);
  await act(async () => { resolve(Response.json({ message: 'OLD RESULT', findings: [] })); });
  expect(screen.queryByText('OLD RESULT')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review AI scan' })).toBeEnabled());
});
