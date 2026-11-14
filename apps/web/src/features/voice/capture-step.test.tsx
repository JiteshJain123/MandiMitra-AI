import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaptureStep } from './capture-step';

const show = (error?: string) => render(<CaptureStep defaultLanguage="hi" busy={false} error={error} onSubmit={vi.fn()} />);

describe('CaptureStep errors', () => {
  it('shows nothing when there is no error', () => {
    show();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the server message (for example "recording too short") and never an empty box', () => {
    show('The recording is too short. Please speak for at least a second.');
    expect(screen.getByRole('alert')).toHaveTextContent('The recording is too short. Please speak for at least a second.');
  });

  it('an upload problem is explained in words', () => {
    show();
    const input = screen.getByTestId('audio-upload');
    fireEvent.change(input, { target: { files: [new File(['x'], 'clip.webm', { type: 'audio/webm' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('WebM is not supported');
  });

  it('a too-large upload is explained in words', () => {
    show();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByTestId('audio-upload'), { target: { files: [big] } });
    expect(screen.getByRole('alert')).toHaveTextContent('larger than 5 MB');
  });

  it('Discard and choosing a new file clear a stale server error (the page is told to reset)', () => {
    const onClearError = vi.fn();
    render(<CaptureStep defaultLanguage="hi" busy={false} error="The recording is too short." onSubmit={vi.fn()} onClearError={onClearError} />);
    fireEvent.change(screen.getByTestId('audio-upload'), { target: { files: [new File(['RIFF'], 'ok.wav', { type: 'audio/wav' })] } });
    expect(onClearError).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClearError).toHaveBeenCalledTimes(2);
  });

  it('a server error shows after a valid upload is chosen', () => {
    const { rerender } = show();
    fireEvent.change(screen.getByTestId('audio-upload'), { target: { files: [new File(['RIFF'], 'ok.wav', { type: 'audio/wav' })] } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<CaptureStep defaultLanguage="hi" busy={false} error="This does not look like a supported audio file." onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('This does not look like a supported audio file.');
  });
});
