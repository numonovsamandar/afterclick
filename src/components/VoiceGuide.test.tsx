import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VoiceGuide } from "./VoiceGuide";
import { speakGuidance } from "@/lib/voice.functions";

vi.mock("@/lib/voice.functions", () => ({ speakGuidance: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const request = { incident: "link" as const, facts: {}, section: "aid" as const, index: 0 };

it("displays missing-configuration errors without removing the guide", async () => {
  vi.mocked(speakGuidance).mockResolvedValue({ error: "Voice isn't connected yet." });
  render(<VoiceGuide request={request} />);
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  expect(await screen.findByText("Voice isn't connected yet.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Listen" })).toBeEnabled();
});

it("pauses, resumes, and stops playback on unmount", async () => {
  const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(), currentTime: 0 };
  vi.stubGlobal("Audio", vi.fn(function () { return player; }));
  vi.mocked(speakGuidance).mockResolvedValue({ audio: "YXVkaW8=" });
  const view = render(<VoiceGuide request={request} />);
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
  expect(player.pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  await waitFor(() => expect(player.play).toHaveBeenCalledTimes(2));
  view.unmount();
  expect(player.removeAttribute).toHaveBeenCalledWith("src");
});

it("does not play a delayed response after changing steps", async () => {
  let resolve!: (value: { audio: string }) => void;
  vi.mocked(speakGuidance).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const audioConstructor = vi.fn();
  vi.stubGlobal("Audio", audioConstructor);
  const view = render(<VoiceGuide request={request} />);
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  view.rerender(<VoiceGuide request={{ ...request, section: "step" }} />);
  await act(async () => { resolve({ audio: "YXVkaW8=" }); });
  expect(audioConstructor).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Listen" })).toBeEnabled();
});
