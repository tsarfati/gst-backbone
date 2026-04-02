import * as React from "react";
import { Mic, Square } from "lucide-react";

import { cn } from "@/lib/utils";

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<(ArrayLike<{ transcript: string }> & { isFinal?: boolean })>;
  }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  enableSpeech?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, enableSpeech = true, disabled, value, onChange, ...props }, ref) => {
  const waveformBarCount = 120;
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [isListening, setIsListening] = React.useState(false);
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [waveHeights, setWaveHeights] = React.useState(() => Array.from({ length: waveformBarCount }, () => 2));
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const startedAtRef = React.useRef<number | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const lastWaveSampleAtRef = React.useRef<number>(0);
  const finalizedTranscriptRef = React.useRef<string[]>([]);
  const interimTranscriptRef = React.useRef<string>("");

  React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      analyserRef.current?.disconnect();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  React.useEffect(() => {
    if (!isListening) {
      setElapsedSeconds(0);
      setWaveHeights(Array.from({ length: waveformBarCount }, () => 2));
      return;
    }

    startedAtRef.current = Date.now();
    const intervalId = window.setInterval(() => {
      if (!startedAtRef.current) return;
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isListening]);

  const applyTranscript = React.useCallback((transcript: string) => {
    const element = innerRef.current;
    if (!element) return;

    const currentValue = String(value ?? element.value ?? "");
    const selectionStart = element.selectionStart ?? currentValue.length;
    const selectionEnd = element.selectionEnd ?? currentValue.length;
    const prefix = currentValue.slice(0, selectionStart);
    const suffix = currentValue.slice(selectionEnd);
    const needsLeadingSpace = prefix.length > 0 && !/\s$/.test(prefix);
    const needsTrailingSpace = suffix.length > 0 && !/^\s/.test(suffix);
    const insertValue = `${needsLeadingSpace ? " " : ""}${transcript.trim()}${needsTrailingSpace ? " " : ""}`;
    const nextValue = `${prefix}${insertValue}${suffix}`;

    if (onChange) {
      const syntheticEvent = {
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(syntheticEvent);
    }

    requestAnimationFrame(() => {
      element.focus();
      const cursorPosition = prefix.length + insertValue.length;
      element.setSelectionRange(cursorPosition, cursorPosition);
    });
  }, [onChange, value]);

  const stopWaveformCapture = React.useCallback(() => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setWaveHeights(Array.from({ length: waveformBarCount }, () => 2));
  }, [waveformBarCount]);

  const flushTranscript = React.useCallback(() => {
    const transcript = [...finalizedTranscriptRef.current, interimTranscriptRef.current]
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    finalizedTranscriptRef.current = [];
    interimTranscriptRef.current = "";

    if (transcript) {
      applyTranscript(transcript);
    }
  }, [applyTranscript]);

  const startWaveformCapture = React.useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      const audioContext = new window.AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.9;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);
      const tick = (timestamp: number) => {
        if (!analyserRef.current) return;

        analyser.getByteTimeDomainData(dataArray);
        if (timestamp - lastWaveSampleAtRef.current >= 70) {
          lastWaveSampleAtRef.current = timestamp;
          let sumSquares = 0;
          for (let current = 0; current < dataArray.length; current += 1) {
            const centered = (dataArray[current] - 128) / 128;
            sumSquares += centered * centered;
          }
          const rms = Math.sqrt(sumSquares / Math.max(1, dataArray.length));
          const gated = Math.max(0, rms - 0.01);
          const boosted = Math.min(1, Math.pow(gated * 9.4, 1.42));
          const nextHeight = Math.max(2, Math.min(28, Math.round(2 + (boosted * 26))));

          setWaveHeights((previous) => {
            const lastHeight = previous[previous.length - 1] ?? 2;
            const smoothedHeight = Math.round((lastHeight * 0.55) + (nextHeight * 0.45));
            return [...previous.slice(1), smoothedHeight];
          });
        }
        animationFrameRef.current = window.requestAnimationFrame(tick);
      };

      lastWaveSampleAtRef.current = 0;
      animationFrameRef.current = window.requestAnimationFrame(tick);
    } catch {
      setWaveHeights(Array.from({ length: waveformBarCount }, () => 2));
    }
  }, [waveformBarCount]);

  const handleToggleSpeechToText = () => {
    if (!enableSpeech || disabled || typeof window === "undefined") return;

    if (isListening) {
      recognitionRef.current?.stop();
      stopWaveformCapture();
      startedAtRef.current = null;
      setIsListening(false);
      flushTranscript();
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let latestInterim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || "";
        const trimmedTranscript = transcript.trim();
        if (!trimmedTranscript) continue;

        if (result.isFinal) {
          finalizedTranscriptRef.current.push(trimmedTranscript);
          latestInterim = "";
        } else {
          latestInterim = trimmedTranscript;
        }
      }
      interimTranscriptRef.current = latestInterim;
    };
    recognition.onerror = () => {
      stopWaveformCapture();
      startedAtRef.current = null;
      setIsListening(false);
      flushTranscript();
    };
    recognition.onend = () => {
      stopWaveformCapture();
      startedAtRef.current = null;
      setIsListening(false);
      flushTranscript();
    };

    recognitionRef.current = recognition;
    finalizedTranscriptRef.current = [];
    interimTranscriptRef.current = "";
    void startWaveformCapture();
    recognition.start();
    setElapsedSeconds(0);
    setIsListening(true);
  };

  const showSpeechControls = enableSpeech && speechSupported;
  const formattedElapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="group relative">
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          showSpeechControls ? "pb-14" : "",
          className,
        )}
        ref={innerRef}
        disabled={disabled}
        value={value}
        onChange={onChange}
        {...props}
      />
      {showSpeechControls ? (
        <div
          className={cn(
            "absolute inset-x-3 bottom-3 flex items-center gap-3 transition-opacity",
            !isListening ? "justify-end" : "",
            isListening ? "opacity-100" : "opacity-80 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          {isListening ? (
            <>
              <div className="relative flex h-8 min-w-0 flex-1 items-center overflow-hidden" aria-hidden="true">
                <div
                  className="grid h-full w-full items-center gap-px"
                  style={{ gridTemplateColumns: `repeat(${waveformBarCount}, minmax(0, 1fr))` }}
                >
                {waveHeights.map((height, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-red-500/80 transition-[height,transform,opacity] duration-150 ease-out"
                    style={{
                      width: "42%",
                      height: `${height}px`,
                      justifySelf: "center",
                      opacity: 0.95,
                    }}
                  />
                ))}
                </div>
              </div>
              <span className="shrink-0 min-w-[42px] text-[11px] font-medium tabular-nums text-muted-foreground">
                {formattedElapsed}
              </span>
            </>
          ) : null}
          <button
            type="button"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              isListening
                ? "border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={handleToggleSpeechToText}
            disabled={disabled}
            aria-label={isListening ? "Stop dictation" : "Start dictation"}
            title={isListening ? "Stop dictation" : "Start dictation"}
          >
            {isListening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>
      ) : null}
    </div>
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
