"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBar, BottomBar, Button, Chip, Icon, ModeBanner, Screen, Sheet } from "@/components/ui";
import { useFlow } from "@/components/FlowProvider";
import { t } from "@/lib/i18n";
import { ISSUE_MESSAGE } from "@/lib/quality/messages";
import { MIN_FACE_WIDTH, type QualityResult } from "@/lib/quality/gate";
import { blobToBitmap, qualityOf, toUploadJpeg } from "@/lib/client/image";

/** M1 촬영 가이드: live quality gate on the camera preview (face width ≥ 60%, light, frontal); upload fallback. */
function CaptureInner() {
  const { lang, consented, setConsented, setPhoto, setAttempt, stored } = useFlow();
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

  useEffect(() => {
    if (!consented && !forAttempt) return;
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
          setCamera("on");
        }
      } catch {
        setCamera("off");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [consented, forAttempt]);

  // live check every 500 ms
  useEffect(() => {
    if (camera !== "on") return;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (v && v.videoWidth) setQ(qualityOf(v, v.videoWidth, v.videoHeight));
    }, 500);
    return () => window.clearInterval(id);
  }, [camera]);

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
    const result = qualityOf(v, v.videoWidth, v.videoHeight);
    setQ(result);
    if (result.pass) accept(await toUploadJpeg(v, v.videoWidth, v.videoHeight));
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

  return (
    <Screen>
      <AppBar title={forAttempt ? t("captureAttemptTitle", lang) : t("captureTitle", lang)} backHref={forAttempt ? `/lesson${lesson ? `?id=${lesson}` : ""}` : "/"} />
      <ModeBanner />
      <main className="flex flex-1 flex-col">
        <div className="relative mx-auto mt-3 aspect-[3/4] w-full overflow-hidden bg-ink">
          <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" aria-label={t("captureTitle", lang)} />
          {camera !== "on" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-canvas">
              <Icon name="camera" className="h-10 w-10" />
              <p className="text-sm">{camera === "starting" ? t("checking", lang) : t("cameraOff", lang)}</p>
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
        <p className="px-4 pt-4 text-center text-sm text-muted">{forAttempt ? t("captureAttemptHint", lang) : t("captureHint", lang)}</p>
      </main>
      <BottomBar>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
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

      <Sheet open={!consented && !forAttempt} onClose={() => router.push("/")} title={t("consentTitle", lang)}>
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
