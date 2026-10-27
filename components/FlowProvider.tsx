"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lang } from "@/lib/rules/engine";
import type { FaceProfile, ProfileKey, StoredProfile } from "@/lib/profile";
import { clearProfile, loadProfile, saveProfile } from "@/lib/privacy/profileStore";
import { fetchCredit, postEndSession, streamRender, type CreditInfo } from "@/lib/client/api";
import type { StepResult } from "@/lib/services/render";
import type { GradeResult } from "@/lib/grade/types";
import type { ServiceMode } from "@/lib/services/analyze";

/**
 * Client session state. Photos and rendered images live only in memory (object URLs / data URLs) and
 * are dropped on "세션 끝내기" or when the tab closes (privacy ①/F9). Only the 5 attributes persist.
 */
export interface Photo {
  blob: Blob;
  url: string;
}

export type StepState = { status: "pending" } | StepResult;

interface FlowState {
  lang: Lang;
  setLang: (l: Lang) => void;
  consented: boolean;
  setConsented: (v: boolean) => void;
  photo: Photo | null;
  setPhoto: (b: Blob | null) => void;
  stored: StoredProfile | null;
  hydrated: boolean;
  setStored: (p: StoredProfile | null) => void;
  editProfile: <K extends ProfileKey>(k: K, v: FaceProfile[K]) => void;
  deleteProfile: () => void;
  mode: ServiceMode | null;
  setMode: (m: ServiceMode) => void;
  renders: Record<string, Record<number, StepState>>;
  render: (lessonId: string, steps?: number[]) => Promise<void>;
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

export function FlowProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ko");
  const [consented, setConsented] = useState(false);
  const [photo, setPhoto] = usePhoto();
  const [attempt, setAttempt] = usePhoto();
  const [stored, setStoredState] = useState<StoredProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<ServiceMode | null>(null);
  const [renders, setRenders] = useState<Record<string, Record<number, StepState>>>({});
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [gradedLesson, setGradedLesson] = useState<string | null>(null);
  const [cart, setCart] = useState<string[]>([]);
  const [completed, setCompleted] = useState<Record<string, number>>({});
  const [credit, setCredit] = useState<CreditInfo | null>(null);

  useEffect(() => {
    setStoredState(loadProfile(window.localStorage));
    setHydrated(true);
    void fetchCredit().then(setCredit);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const refreshCredit = useCallback(() => void fetchCredit().then(setCredit), []);

  const setStored = useCallback((p: StoredProfile | null) => {
    setStoredState(p);
    if (p) saveProfile(window.localStorage, p);
    else clearProfile(window.localStorage);
    setRenders({}); // techniques may change → re-render lessons
  }, []);

  const editProfile = useCallback(<K extends ProfileKey>(k: K, v: FaceProfile[K]) => {
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
    setStoredState(null);
    setRenders({});
  }, []);

  const render = useCallback(
    async (lessonId: string, steps?: number[]) => {
      if (!photo || !stored) return;
      const indexes = steps ?? [1, 2, 3, 4];
      setRenders((r) => ({ ...r, [lessonId]: { ...(r[lessonId] ?? {}), ...Object.fromEntries(indexes.map((i) => [i, { status: "pending" as const }])) } }));
      try {
        await streamRender(
          photo.blob,
          lessonId,
          stored.profile,
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
    [photo, stored, refreshCredit],
  );

  const addToCart = useCallback((sku: string) => setCart((c) => (c.includes(sku) ? c : [...c, sku])), []);
  const markCompleted = useCallback((id: string, score: number) => setCompleted((c) => ({ ...c, [id]: Math.max(score, c[id] ?? 0) })), []);

  const endSession = useCallback(async () => {
    setPhoto(null);
    setAttempt(null);
    setRenders({});
    setGrade(null);
    setGradedLesson(null);
    setCart([]);
    setCompleted({});
    setMode(null);
    await postEndSession();
  }, [setPhoto, setAttempt]);

  const value = useMemo<FlowState>(
    () => ({
      lang, setLang, consented, setConsented, photo, setPhoto, stored, hydrated, setStored, editProfile, deleteProfile,
      mode, setMode, renders, render, attempt, setAttempt, grade, setGrade, gradedLesson, setGradedLesson,
      cart, addToCart, completed, markCompleted, credit, refreshCredit, endSession,
    }),
    [lang, consented, photo, setPhoto, stored, hydrated, setStored, editProfile, deleteProfile, mode, renders, render, attempt, setAttempt, grade, gradedLesson, cart, addToCart, completed, markCompleted, credit, refreshCredit, endSession],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFlow(): FlowState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFlow outside FlowProvider");
  return v;
}
