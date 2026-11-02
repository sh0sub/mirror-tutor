"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/rules/engine";
import type { FaceProfile, ProfileKey, StoredProfile } from "@/lib/profile";
import { clearProfile, loadProfile, saveProfile } from "@/lib/privacy/profileStore";
import { fetchCredit, postAnalyze, postEndSession, streamRender, type CreditInfo } from "@/lib/client/api";
import type { StepResult } from "@/lib/services/render";
import type { FaceAnchors } from "@/lib/regions";
import type { GradeResult } from "@/lib/grade/types";
import type { ServiceMode } from "@/lib/services/analyze";
import { loadLang, saveLang } from "@/lib/i18n";
import type { FaceDetection } from "@/lib/client/landmarker";
import type { FacePins } from "@/lib/facePins";
import type { SkinMeasure } from "@/lib/skin/measure";
import { nearestShade } from "@/lib/skin/shades";
import { loadSampleSession, saveSampleSession } from "@/lib/demo/sampleSession";
import { DEFAULT_SAMPLE, sampleAttemptFor, sampleModelById, sampleOwnAttempt, type SampleId } from "@/lib/demo/sample";
import { EMPTY_LOG, clearPractice, loadConsent, loadPractice, recordPractice, saveConsent, savePractice, type PracticeLog } from "@/lib/practice";

/**
 * Client session state. Photos and rendered images live only in memory (object URLs / data URLs) and
 * are dropped on "세션 끝내기" or when the tab closes (privacy ①/F9). Only the 5 attributes persist.
 */
export interface Photo {
  blob: Blob;
  url: string;
}

export type StepState = { status: "pending" } | StepResult;

/** Foundation shade for the current photo (measured in this tab; only the ladder id is sent to /api/render). */
export interface SkinState {
  detecting: boolean;
  /** null when detection failed → lessons keep their default base color unless the user picks a shade. */
  measured: SkinMeasure | null;
  /** Ladder shade nearest to the measurement, with its ΔE2000. */
  measuredId: string | null;
  deltaE: number | null;
  /** What lessons render with: the user's pick, else measuredId. null = the lesson's own color. */
  shadeId: string | null;
  overridden: boolean;
}

interface FlowState {
  lang: Lang;
  setLang: (l: Lang) => void;
  consented: boolean;
  setConsented: (v: boolean) => void;
  /** X4 practice log (days + best scores), persisted locally. */
  practice: PracticeLog;
  photo: Photo | null;
  setPhoto: (b: Blob | null) => void;
  /** Eye/mouth centers of `photo` (MediaPipe, in this tab). null until detected or on failure. */
  anchors: FaceAnchors | null;
  /** M2 attribute pin points of `photo` (MediaPipe, in this tab). null until detected or on failure. */
  facePins: FacePins | null;
  /** null without a photo. */
  skin: SkinState | null;
  /** Override the measured shade (0 units; lessons re-render on next open, 1 unit per uncached step). */
  setSkinShade: (id: string) => void;
  stored: StoredProfile | null;
  hydrated: boolean;
  setStored: (p: StoredProfile | null) => void;
  editProfile: <K extends ProfileKey>(k: K, v: FaceProfile[K]) => void;
  deleteProfile: () => void;
  /** "샘플 모델로 체험하기": the sample model stands in for the selfie; its profile stays in memory (never overwrites the saved one). */
  sample: boolean;
  /** Which sample face the trial runs on (double-lid or monolid). */
  sampleId: SampleId;
  /** Load a sample model as the photo and enter sample mode (0 units; the server never calls YouCam for it). */
  startSample: (id?: SampleId, opts?: { withProfile?: boolean }) => Promise<void>;
  /** True while a reload/deep link restores a sample trial from sessionStorage (routes show a skeleton, not the "start a sample" card). */
  restoring: boolean;
  /** Sample mode: use the simulated attempt photo (for the lesson's answer image) instead of a new selfie. */
  loadSampleAttempt: (answerImage?: string | null) => Promise<void>;
  mode: ServiceMode | null;
  setMode: (m: ServiceMode) => void;
  renders: Record<string, Record<number, StepState>>;
  render: (lessonId: string, steps?: number[]) => Promise<void>;
  /** S4: per-lesson step intensity (0.8 / 1 / 1.2). */
  scales: Record<string, Record<number, number>>;
  setStepScale: (lessonId: string, step: number, scale: number) => Promise<void>;
  attempt: Photo | null;
  setAttempt: (b: Blob | null) => void;
  grade: GradeResult | null;
  setGrade: (g: GradeResult | null) => void;
  gradedLesson: string | null;
  setGradedLesson: (id: string | null) => void;
  cart: string[];
  addToCart: (sku: string) => void;
  completed: Record<string, number>;
  markCompleted: (lessonId: string, score: number) => void;
  credit: CreditInfo | null;
  refreshCredit: () => void;
  endSession: () => Promise<void>;
}

const Ctx = createContext<FlowState | null>(null);

function usePhoto(): [Photo | null, (b: Blob | null) => void] {
  const [photo, set] = useState<Photo | null>(null);
  const ref = useRef<Photo | null>(null);
  const update = useCallback((b: Blob | null) => {
    if (ref.current) URL.revokeObjectURL(ref.current.url);
    const next = b ? { blob: b, url: URL.createObjectURL(b) } : null;
    ref.current = next;
    set(next);
  }, []);
  useEffect(
    () => () => {
      if (ref.current) URL.revokeObjectURL(ref.current.url);
    },
    [],
  );
  return [photo, update];
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return res.blob();
}

export function FlowProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    saveLang(window.localStorage, l); // S5: remember the choice on this device
  }, []);
  const [consented, setConsentedState] = useState(false);
  const setConsented = useCallback((v: boolean) => {
    setConsentedState(v);
    saveConsent(window.localStorage, v); // F1: ask once per device
  }, []);
  const [practice, setPractice] = useState<PracticeLog>(EMPTY_LOG);
  const [photo, setPhotoRaw] = usePhoto();
  const [sample, setSample] = useState(false);
  const sampleRef = useRef(sample);
  sampleRef.current = sample;
  const [sampleId, setSampleId] = useState<SampleId>(DEFAULT_SAMPLE);
  const [sampleStored, setSampleStored] = useState<StoredProfile | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [attempt, setAttempt] = usePhoto();
  // One MediaPipe pass per photo (eye/mouth anchors + skin tone), awaited by render().
  const [detection, setDetection] = useState<{ blob: Blob; result: FaceDetection | null } | null>(null);
  const [shadeOverride, setShadeOverride] = useState<string | null>(null);
  const shadeOverrideRef = useRef(shadeOverride);
  shadeOverrideRef.current = shadeOverride;
  const detectRef = useRef<{ blob: Blob; promise: Promise<FaceDetection | null> } | null>(null);
  const detectFor = useCallback((blob: Blob) => {
    if (detectRef.current?.blob !== blob) {
      const promise = import("@/lib/client/landmarker").then((m) => m.detectFace(blob)).catch(() => null);
      detectRef.current = { blob, promise };
    }
    return detectRef.current.promise;
  }, []);
  useEffect(() => {
    setDetection(null);
    setShadeOverride(null);
    if (!photo) return;
    let live = true;
    void detectFor(photo.blob).then((result) => live && setDetection({ blob: photo.blob, result }));
    return () => {
      live = false;
    };
  }, [photo, detectFor]);
  const anchors = detection?.result?.anchors ?? null;
  const facePins = photo && detection?.blob === photo.blob ? (detection.result?.pins ?? null) : null;
  const skin = useMemo<SkinState | null>(() => {
    if (!photo || sample) return null; // the sample model is not the visitor's face → lessons keep their default base color
    const measured = detection?.blob === photo.blob ? (detection.result?.skin ?? null) : null;
    const near = measured ? nearestShade(measured.lab) : null;
    const measuredId = near?.shade.id ?? null;
    return {
      detecting: detection?.blob !== photo.blob,
      measured,
      measuredId,
      deltaE: near?.deltaE ?? null,
      shadeId: shadeOverride ?? measuredId,
      overridden: shadeOverride !== null && shadeOverride !== measuredId,
    };
  }, [photo, sample, detection, shadeOverride]);
  const [stored, setStoredState] = useState<StoredProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<ServiceMode | null>(null);
  const [renders, setRenders] = useState<Record<string, Record<number, StepState>>>({});
  const [scales, setScales] = useState<Record<string, Record<number, number>>>({});
  const scalesRef = useRef(scales);
  scalesRef.current = scales;
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [gradedLesson, setGradedLesson] = useState<string | null>(null);
  const [cart, setCart] = useState<string[]>([]);
  const [completed, setCompleted] = useState<Record<string, number>>({});
  const [credit, setCredit] = useState<CreditInfo | null>(null);

  useEffect(() => {
    setStoredState(loadProfile(window.localStorage));
    setConsentedState(loadConsent(window.localStorage));
    setPractice(loadPractice(window.localStorage));
    setLangState(loadLang(window.localStorage, navigator.language, window.location.search));
    setHydrated(true);
    void fetchCredit().then(setCredit);
    // A reload inside a sample trial (or a deep link in the same tab) comes back as the same trial; home always starts clean.
    const snap = window.location.pathname === "/" ? null : loadSampleSession(window.sessionStorage);
    if (snap) {
      setRestoring(true);
      void fetchBlob(sampleModelById(snap.id).original)
        .then((blob) => {
          setSampleId(snap.id);
          setSampleStored(snap.stored);
          setSample(true);
          sampleRef.current = true;
          setPhotoRaw(blob);
          setMode("sample");
        })
        .catch(() => saveSampleSession(window.sessionStorage, null))
        .finally(() => setRestoring(false));
    } else if (window.location.pathname === "/") saveSampleSession(window.sessionStorage, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  // Keep the snapshot current while a sample trial runs; leaving the trial (real photo, session end, home) clears it.
  const wasSample = useRef(false);
  useEffect(() => {
    if (sample) saveSampleSession(window.sessionStorage, { id: sampleId, stored: sampleStored });
    else if (wasSample.current) saveSampleSession(window.sessionStorage, null);
    wasSample.current = sample;
  }, [sample, sampleId, sampleStored]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (hydrated) document.documentElement.classList.remove("lang-pending");
  }, [hydrated]);

  const refreshCredit = useCallback(() => void fetchCredit().then(setCredit), []);

  const setStored = useCallback((p: StoredProfile | null) => {
    if (sampleRef.current) {
      setSampleStored(p); // memory only
      setRenders({});
      return;
    }
    setStoredState(p);
    if (p) saveProfile(window.localStorage, p);
    else clearProfile(window.localStorage);
    setRenders({}); // techniques may change → re-render lessons
  }, []);

  const editProfile = useCallback(<K extends ProfileKey>(k: K, v: FaceProfile[K]) => {
    if (sampleRef.current) {
      setSampleStored((prev) => (prev ? { ...prev, profile: { ...prev.profile, [k]: v }, edited: Array.from(new Set([...prev.edited, k])) } : prev));
      setRenders({});
      return;
    }
    setStoredState((prev) => {
      if (!prev) return prev;
      const next: StoredProfile = { ...prev, profile: { ...prev.profile, [k]: v }, edited: Array.from(new Set([...prev.edited, k])) };
      saveProfile(window.localStorage, next);
      return next;
    });
    setRenders({});
  }, []);

  const deleteProfile = useCallback(() => {
    clearProfile(window.localStorage);
    clearPractice(window.localStorage);
    setPractice(EMPTY_LOG);
    setStoredState(null);
    setRenders({});
  }, []);

  const activeStored = sample ? sampleStored : stored;

  const render = useCallback(
    async (lessonId: string, steps?: number[], stepScales?: Record<number, number>) => {
      const profile = activeStored?.profile;
      if (!photo || !profile) return;
      const lessonScales = stepScales ?? scalesRef.current[lessonId];
      const indexes = steps ?? [1, 2, 3, 4];
      setRenders((r) => ({ ...r, [lessonId]: { ...(r[lessonId] ?? {}), ...Object.fromEntries(indexes.map((i) => [i, { status: "pending" as const }])) } }));
      // Sample mode uploads nothing: the server renders the sample model from its own copy (pre-generated steps, 0u).
      const det = sample ? null : await detectFor(photo.blob);
      const shade = sample ? null : (shadeOverrideRef.current ?? (det?.skin ? nearestShade(det.skin.lab).shade.id : null));
      try {
        await streamRender(
          sample ? null : photo.blob,
          lessonId,
          profile,
          (e) => {
            if (e.type === "step") {
              const { type: _type, ...step } = e;
              void _type;
              setRenders((r) => ({ ...r, [lessonId]: { ...(r[lessonId] ?? {}), [step.index]: step as StepResult } }));
            } else if (e.type === "done") {
              setMode(e.mode);
            } else {
              setRenders((r) => ({
                ...r,
                [lessonId]: Object.fromEntries(indexes.map((i) => [i, { index: i, status: "error", code: e.code, guide: "retry" } as StepResult])),
              }));
            }
          },
          steps,
          lessonScales,
          det?.anchors ?? null,
          shade,
          sample ? sampleId : undefined,
        );
      } catch {
        setRenders((r) => ({
          ...r,
          [lessonId]: { ...(r[lessonId] ?? {}), ...Object.fromEntries(indexes.map((i) => [i, { index: i, status: "error", code: "network", guide: "retry" } as StepResult])) },
        }));
      } finally {
        refreshCredit();
      }
    },
    [photo, activeStored, sample, sampleId, refreshCredit, detectFor],
  );

  const setStepScale = useCallback(
    async (lessonId: string, step: number, scale: number) => {
      const next = { ...(scalesRef.current[lessonId] ?? {}), [step]: scale };
      if (scale === 1) delete next[step];
      setScales((s) => ({ ...s, [lessonId]: next }));
      await render(lessonId, [step], next); // one VTO task (1u) unless cached
    },
    [render],
  );

  const setSkinShade = useCallback((id: string) => {
    setShadeOverride(id);
    setRenders({}); // base color changed → lessons re-render on next open (cache hits are free)
  }, []);

  const addToCart = useCallback((sku: string) => setCart((c) => (c.includes(sku) ? c : [...c, sku])), []);
  const markCompleted = useCallback((id: string, score: number) => {
    setCompleted((c) => ({ ...c, [id]: Math.max(score, c[id] ?? 0) }));
    if (sampleRef.current) return; // a sample run is not the visitor's practice → no streak/score saved
    setPractice((log) => {
      const next = recordPractice(log, id, score);
      savePractice(window.localStorage, next);
      return next;
    });
  }, []);

  const resetRun = useCallback(() => {
    setAttempt(null);
    setRenders({});
    setScales({});
    setGrade(null);
    setGradedLesson(null);
    setCompleted({});
    setMode(null);
  }, [setAttempt]);

  /** A real photo always leaves sample mode (the saved profile comes back). */
  const setPhoto = useCallback(
    (b: Blob | null) => {
      if (sampleRef.current) {
        setSample(false);
        setSampleStored(null);
        resetRun();
      }
      setPhotoRaw(b);
    },
    [resetRun, setPhotoRaw],
  );

  const startSample = useCallback(async (id: SampleId = DEFAULT_SAMPLE, opts?: { withProfile?: boolean }) => {
    const blob = await fetchBlob(sampleModelById(id).original);
    // Deep-link recovery: the sample's pre-generated profile (0u, same as /analyze in sample mode) so /shop and /grade have a lesson plan at once.
    const analyzed = opts?.withProfile ? await postAnalyze(null, id) : null;
    setSampleId(id);
    resetRun();
    setSampleStored(analyzed?.ok ? { profile: analyzed.profile, edited: [], source: analyzed.source } : null);
    setSample(true);
    sampleRef.current = true;
    setPhotoRaw(blob);
    setMode("sample");
  }, [resetRun, setPhotoRaw]);

  const loadSampleAttempt = useCallback(async (answerImage?: string | null) => {
    setAttempt(await fetchBlob(sampleAttemptFor(answerImage ?? null) ?? sampleOwnAttempt(sampleId)));
  }, [setAttempt, sampleId]);

  const endSession = useCallback(async () => {
    setSample(false);
    setSampleStored(null);
    setPhoto(null);
    setAttempt(null);
    setRenders({});
    setScales({});
    setGrade(null);
    setGradedLesson(null);
    setCart([]);
    setCompleted({});
    setMode(null);
    await postEndSession();
  }, [setPhoto, setAttempt]);

  const value = useMemo<FlowState>(
    () => ({
      lang, setLang, consented, setConsented, practice, photo, setPhoto, stored: activeStored, hydrated, setStored, editProfile, deleteProfile,
      anchors, facePins, skin, setSkinShade, sample, sampleId, startSample, restoring, loadSampleAttempt, mode, setMode, renders, render, scales, setStepScale, attempt, setAttempt, grade, setGrade, gradedLesson, setGradedLesson,
      cart, addToCart, completed, markCompleted, credit, refreshCredit, endSession,
    }),
    [lang, setLang, consented, setConsented, practice, photo, setPhoto, anchors, facePins, skin, setSkinShade, sample, sampleId, startSample, restoring, loadSampleAttempt, activeStored, hydrated, setStored, editProfile, deleteProfile, mode, renders, render, scales, setStepScale, attempt, setAttempt, grade, gradedLesson, cart, addToCart, completed, markCompleted, credit, refreshCredit, endSession],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFlow(): FlowState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFlow outside FlowProvider");
  return v;
}
