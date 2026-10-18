import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { speakGuidance } from "@/lib/voice.functions";
import type { VoiceRequest } from "@/lib/voice";

export function VoiceGuide({ request }: { request: VoiceRequest }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "ended">("idle");
  const [error, setError] = useState("");
  const identity = JSON.stringify(request);

  useEffect(() => {
    setState("idle"); setError("");
    return () => {
      generation.current++;
      if (audio.current) { audio.current.pause(); audio.current.removeAttribute("src"); audio.current.load(); }
      audio.current = null;
    };
  }, [identity]);

  async function play(restart = false) {
    const token = generation.current;
    setError("");
    try {
      if (!audio.current) {
        setState("loading");
        const result = await speakGuidance({ data: request });
        if (token !== generation.current) return;
        if (!result.audio) throw new Error(result.error || "Voice is unavailable.");
        const player = new Audio(`data:audio/mpeg;base64,${result.audio}`);
        player.onended = () => { if (token === generation.current) setState("ended"); };
        player.onerror = () => {
          if (token !== generation.current) return;
          setError("Audio couldn't play. Please try again."); setState("idle"); audio.current = null;
        };
        audio.current = player;
      }
      if (restart) audio.current.currentTime = 0;
      await audio.current.play();
      if (token === generation.current) setState("playing");
    } catch (e) {
      if (token !== generation.current) return;
      setState(audio.current ? "paused" : "idle");
      setError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : "Tap Listen again to start audio.");
    }
  }

  return (
    <section aria-label="Voice guide" className="mb-5 rounded-xl border bg-secondary/40 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Volume2 className="size-4" aria-hidden="true" />
        <span className="mr-auto text-sm font-medium">Talk me through it</span>
        <button type="button" className="nav-pill" disabled={state === "loading"} onClick={() => {
          if (state === "playing") { audio.current?.pause(); setState("paused"); }
          else void play(state === "ended");
        }}>
          {state === "loading" ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : state === "playing" ? <Pause className="mr-1.5 size-4" /> : <Play className="mr-1.5 size-4" />}
          {state === "loading" ? "Preparing voice…" : state === "playing" ? "Pause" : state === "paused" ? "Resume" : "Listen"}
        </button>
        {audio.current && state !== "loading" && <button type="button" className="nav-pill" aria-label="Replay this guidance" onClick={() => void play(true)}><RotateCcw className="size-4" /></button>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">AI voice by ElevenLabs. Listening sends this guidance to ElevenLabs; your pasted message is not sent. Answer using the buttons below.</p>
      <p role="status" className="mt-1 text-xs text-muted-foreground">{error || (state === "ended" ? "Finished reading. Continue when you're ready." : "")}</p>
    </section>
  );
}
