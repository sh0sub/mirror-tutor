"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBar, BottomBar, Button, Chip, Icon, ModeBanner, Screen, Sheet } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t } from "@/lib/i18n";
import { ISSUE_MESSAGE } from "@/lib/quality/messages";
import { MIN_FACE_WIDTH, maxDigitalZoom, visibleCrop, type QualityResult } from "@/lib/quality/gate";
import { blobToBitmap, qualityOf, toUploadJpeg } from "@/lib/client/image";

/** M1 촬영 가이드: live quality gate on the camera preview (face width ≥ 60%, light, frontal); upload fallback. */
function CaptureInner() {
  const { lang, consented, setConsented, setPhoto, setAttempt, stored, hydrated, startSample } = useFlow();
  const [sampleBusy, setSampleBusy] = useState(false);
  // "샘플 모델로 체험하기": no selfie and nothing uploaded, so it needs no consent; 0 units.
  const trySample = async () => {
    setSampleBusy(true);
    try {
      await startSample();
      router.push("/analyze");
    } catch {
      setSampleBusy(false);
    }
  };
  const router = useRouter();
  const params = useSearchParams();
  const forAttempt = params.get("for") === "attempt";
  const lesson = params.get("lesson");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [q, setQ] = useState<QualityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadIssue, setUploadIssue] = useState<QualityResult | null>(null);
  // Zoom: hardware (MediaStreamTrack `zoom` capability) when the camera has it, else a centered digital crop
  // capped so the uploaded crop keeps a short side ≥ 480 px.
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number; hw: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);
  const digitalZoom = zoomRange && !zoomRange.hw ? zoom : 1;

  useEffect(() => {
    if (!hydrated || (!consented && !forAttempt)) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1707 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play();
          const track = stream.getVideoTracks()[0] ?? null;
          trackRef.current = track;
          const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number; step?: number } };
          if (caps.zoom && caps.zoom.max > caps.zoom.min) {
            const max = Math.min(caps.zoom.max, caps.zoom.min * 3);
            setZoomRange({ min: caps.zoom.min, max, step: caps.zoom.step || 0.1, hw: true });
            setZoom(caps.zoom.min);
          } else {
            const max = maxDigitalZoom(v.videoWidth, v.videoHeight);
            setZoomRange(max > 1 ? { min: 1, max, step: 0.1, hw: false } : null);
          }
          setCamera("on");
        }
      } catch {
        setCamera("off");
      }
    })();
    return () => {
      cancelled = true;
      trackRef.current = null;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [hydrated, consented, forAttempt]);

  // live check every 500 ms
  useEffect(() => {
    if (camera !== "on") return;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (v && v.videoWidth) setQ(qualityOf(v, v.videoWidth, v.videoHeight, visibleCrop(v.videoWidth, v.videoHeight, 3 / 4, digitalZoom)));
    }, 500);
    return () => window.clearInterval(id);
  }, [camera, digitalZoom]);

  const changeZoom = (value: number) => {
    setZoom(value);
    if (zoomRange?.hw) {
      const track = trackRef.current;
      // `zoom` is not in the TS lib's MediaTrackConstraintSet yet
      track?.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] }).catch(() => undefined);
    }
  };

  const accept = useCallback(
    (jpeg: Blob) => {
      if (forAttempt) {
        setAttempt(jpeg);
        router.push(`/grade${lesson ? `?lesson=${lesson}` : ""}`);
      } else {
        setPhoto(jpeg);
        // Flow B: a stored profile + chosen lesson skips Face Analyzer (0u)
        router.push(stored && lesson ? `/lesson?id=${lesson}` : "/analyze");
      }
    },
    [forAttempt, lesson, router, setAttempt, setPhoto, stored],
  );

  const shoot = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    const crop = visibleCrop(v.videoWidth, v.videoHeight, 3 / 4, digitalZoom);
    const result = qualityOf(v, v.videoWidth, v.videoHeight, crop);
    setQ(result);
    if (result.pass) accept(await toUploadJpeg(v, v.videoWidth, v.videoHeight, crop));
    setBusy(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const bmp = await blobToBitmap(file);
      const result = qualityOf(bmp, bmp.width, bmp.height);
      if (result.pass) accept(await toUploadJpeg(bmp, bmp.width, bmp.height));
      else setUploadIssue(result);
    } catch {
      setUploadIssue({ pass: false, issues: ["no_face"], faceWidth: 0, brightness: 0, offset: 0 });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const shown = uploadIssue ?? q;
  const pass = camera === "on" && q?.pass;
  const issue = shown?.issues[0];
  const pct = Math.round((shown?.faceWidth ?? 0) * 100);
  const cameraOff = camera === "off" && hydrated && (consented || forAttempt);

  return (
    <Screen wide>
      <AppBar title={forAttempt ? t("captureAttemptTitle", lang) : t("captureTitle", lang)} backHref={forAttempt ? `/lesson${lesson ? `?id=${lesson}` : ""}` : "/"} />
      <ModeBanner />
      <main className={`flex flex-1 flex-col ${cameraOff ? "" : "lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-8"}`}>
        {cameraOff && (
          <section className="mx-auto my-6 w-full max-w-[560px] lg:max-w-[700px] px-4 lg:my-16" aria-live="polite">
            <div className="rounded-2xl border border-line bg-panel p-6 text-center shadow-sm lg:p-10">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-peach-soft text-primary-strong">
                <Icon name="camera" className="h-7 w-7" />
              </span>
              <p className="mx-auto mt-4 max-w-[34ch] break-keep text-base font-bold leading-snug">{forAttempt ? t("cameraOff", lang) : t("cameraOffCard", lang)}</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {!forAttempt && (
                  <Button className="flex-[3]" onClick={trySample} disabled={sampleBusy} data-testid="camera-off-sample">
                    <Icon name="user" className="h-4 w-4" />
                    {t("sampleTry", lang)}
                  </Button>
                )}
                <Button variant={forAttempt ? "primary" : "ghost"} className="flex-[2] whitespace-nowrap" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <Icon name="upload" className="h-4 w-4" />
                  {t("upload", lang)}
                </Button>
              </div>
              {!forAttempt && <p className="mt-3 text-xs text-muted">{t("sampleTryHint", lang)}</p>}
            </div>
          </section>
        )}
        <div className={`relative mx-auto mt-3 aspect-[3/4] w-full overflow-hidden bg-ink lg:mt-6 lg:rounded-2xl ${cameraOff ? "hidden" : ""}`}>
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: `scale(${-digitalZoom}, ${digitalZoom})` }} /* mirrored preview + digital zoom */
            aria-label={t("captureTitle", lang)}
          />
          {camera === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-canvas">
              <Icon name="camera" className="h-10 w-10" />
              <p className="text-sm">{t("checking", lang)}</p>
            </div>
          )}
          {/* guide oval: dashed = 60% target width; solid = current face width */}
          <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <ellipse cx="150" cy="180" rx={150 * MIN_FACE_WIDTH} ry="132" fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="2.5" strokeDasharray="7 6" />
            {camera === "on" && q && q.faceWidth > 0.1 && (
              <ellipse
                cx={150 - q.offset * 300} /* preview is mirrored */
                cy="180"
                rx={(q.faceWidth * 300) / 2}
                ry={((q.faceWidth * 300) / 2) * 1.47}
                fill="none"
                stroke={q.pass ? "#3F8A6C" : "#C97A1A"}
                strokeWidth="3"
                style={{ transition: "all 220ms" }}
              />
            )}
          </svg>
          <span className="pointer-events-none absolute left-1/2 top-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-canvas" aria-hidden>
            {t("target60", lang)}
          </span>
          {camera === "on" && zoomRange && (
            <label className="absolute right-2 top-14 flex h-44 w-12 flex-col items-center gap-1 rounded-full bg-panel/90 py-2 text-xs font-bold">
              <span className="num">{(zoomRange.hw ? zoom / zoomRange.min : zoom).toFixed(1)}×</span>
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step}
                value={zoom}
                onChange={(e) => changeZoom(Number(e.target.value))}
                aria-label={t("zoom", lang)}
                className="h-32 w-8 cursor-pointer accent-[var(--color-primary)] [writing-mode:vertical-lr] [direction:rtl]"
              />
            </label>
          )}
          <div className="absolute inset-x-0 top-3 flex justify-center gap-1.5">
            <Chip tone="neutral">{t("chipFront", lang)}</Chip>
            <Chip tone="neutral">{t("chipBright", lang)}</Chip>
            <Chip tone="neutral">{t("chipForehead", lang)}</Chip>
          </div>
          {shown && (
            <div className="absolute inset-x-3 bottom-3 rounded-xl bg-panel/95 p-3" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>
                  {t("faceWidth", lang)} <span className="num text-base">{pct}%</span>
                </span>
                <span className="text-muted">{t("need60", lang)}</span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-panel-2">
                <div className={`h-2 rounded-full ${shown.pass ? "bg-success" : "bg-warning"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                <div className="absolute top-[-3px] h-3.5 w-0.5 bg-ink" style={{ left: `${MIN_FACE_WIDTH * 100}%` }} aria-hidden />
              </div>
              <p className={`mt-2 flex items-center gap-1.5 text-sm font-bold ${shown.pass ? "text-success" : "text-warning"}`}>
                <Icon name={shown.pass ? "check" : "warn"} className="h-4 w-4" />
                {shown.pass ? t("looksGood", lang) : issue ? ISSUE_MESSAGE[issue][lang] : ""}
              </p>
            </div>
          )}
        </div>
        {!cameraOff && (
          <div className="flex flex-col lg:items-start lg:gap-3">
            <p className="break-keep px-4 pt-4 text-center text-sm text-muted lg:px-0 lg:pt-0 lg:text-left lg:text-base">{forAttempt ? t("captureAttemptHint", lang) : t("captureHint", lang)}</p>
            {!forAttempt && (
              <>
                <button
                  type="button"
                  onClick={trySample}
                  disabled={sampleBusy}
                  className="mx-auto mt-1 inline-flex min-h-12 items-center gap-1.5 px-4 text-sm font-bold text-primary-strong underline underline-offset-4 disabled:text-muted lg:hidden"
                >
                  <Icon name="user" className="h-4 w-4" />
                  {t("sampleTry", lang)}
                </button>
                <Button variant="soft" className="hidden lg:inline-flex" onClick={trySample} disabled={sampleBusy}>
                  <Icon name="user" className="h-4 w-4" />
                  {t("sampleTry", lang)}
                </Button>
                <p className="hidden text-sm text-muted lg:block">{t("sampleTryHint", lang)}</p>
              </>
            )}
          </div>
        )}
      </main>
      <BottomBar className={cameraOff ? "hidden" : ""}>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 whitespace-nowrap px-3" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="upload" className="h-4 w-4" />
            {t("upload", lang)}
          </Button>
          <Button className="flex-[2]" onClick={shoot} disabled={!pass || busy} aria-describedby="shutter-hint">
            <Icon name="camera" className="h-5 w-5" />
            {t("shutter", lang)}
          </Button>
        </div>
        <span id="shutter-hint" className="sr-only">
          {issue ? ISSUE_MESSAGE[issue][lang] : ""}
        </span>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </BottomBar>

      {/* dialog "close" also fires when agreeing closes the sheet; only leave when it was dismissed without consent */}
      <Sheet open={hydrated && !consented && !forAttempt} onClose={() => !consented && router.push("/")} title={t("consentTitle", lang)}>
        <p className="text-[15px] leading-relaxed">{t("consentBody", lang)}</p>
        <p className="mt-2 text-sm text-muted">{t("consentLocal", lang)}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => router.push("/")}>
            {t("cancel", lang)}
          </Button>
          <Button className="flex-[2]" onClick={() => setConsented(true)}>
            {t("agree", lang)}
          </Button>
        </div>
        <Button variant="soft" className="mt-2 w-full" onClick={trySample} disabled={sampleBusy}>
          <Icon name="user" className="h-4 w-4" />
          {t("sampleTry", lang)}
        </Button>
        <p className="mt-1 text-center text-xs text-muted">{t("sampleTryHint", lang)}</p>
      </Sheet>
    </Screen>
  );
}

export default function CapturePage() {
  return (
    <Suspense>
      <CaptureInner />
    </Suspense>
  );
}
