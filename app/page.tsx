"use client";

import { useEffect, useState } from "react";
import { BUSINESS } from "@/lib/business";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";

type Step = 1 | 2 | 3 | 4;

export default function Page() {
  const [step, setStep] = useState<Step>(1);
  const [rating, setRating] = useState(0);
  const [aspects, setAspects] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [posted, setPosted] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [genError, setGenError] = useState(false);

  useEffect(() => { track("page_open"); }, []);

  // Rating conditions the label: negatives for low ratings, positives otherwise.
  // (Pilot simplification — see Section 8, note 2.)
  const aspectLabel = (a: { pos: string; neg: string }) =>
    rating <= 2 ? a.neg : a.pos;

  const chooseRating = (r: number) => {
    setRating(r);
    track("rating_selected", { rating: r });
    setStep(2);
  };

  const toggle = (v: string, arr: string[], set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const generate = async () => {
    setLoading(true);
    setGenError(false);
    track("chips_selected", { aspectCount: aspects.length, itemCount: items.length });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({ rating, aspects, items, tone: "warm", length: "short" }),
      });
      if (!res.ok) throw new Error(`generate failed: ${res.status}`);
      const { text } = await res.json();
      if (!text) throw new Error("empty generation");
      setReview(text);
      track("review_generated", { length: text.length });
      setStep(3);
    } catch {
      setGenError(true);
    } finally {
      setLoading(false);
    }
  };

  const copyAndPost = async () => {
    const ok = await copyText(review);
    setCopyFailed(!ok);
    track("copy_and_open", { copied: ok });
    setStep(4); // mock: copy the text and show confirmation — no navigation
  };

  return (
    <main className="min-h-screen bg-[#f9f2ea] flex justify-center">
      <div className="w-full max-w-[430px] bg-white min-h-screen px-6 py-8 flex flex-col">

        {/* SCREEN 1 — RATE */}
        {step === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/chaileela-logo.jpg" alt={BUSINESS.name}
              className="w-20 h-20 rounded-2xl object-cover shadow-sm" />
            <div>
              <h1 className="font-display text-3xl font-extrabold text-[#2b1608]">{BUSINESS.name}</h1>
              <p className="text-[#a6927f]">{BUSINESS.locality}</p>
            </div>
            <h2 className="text-xl font-medium mt-6 text-[#2b1608]">How was your visit?</h2>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => chooseRating(n)} aria-label={`${n} stars`}
                  className="text-4xl leading-none text-[#e6d9cb] hover:text-[#fcb815]">
                  ★
                </button>
              ))}
            </div>
            <p className="text-sm text-[#a6927f] mt-4">tap to rate · about 15 seconds</p>
          </div>
        )}

        {/* SCREEN 2 — PICK WORDS */}
        {step === 2 && (
          <div className="flex-1 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="text-lg">
                <span className="text-[#fcb815]">{"★".repeat(rating)}</span>
                <span className="text-[#e6d9cb]">{"★".repeat(5 - rating)}</span>
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-[#a6927f]">edit</button>
            </div>

            <div>
              <p className="font-medium text-[#7a6455] mb-2">What stood out?</p>
              <div className="flex flex-wrap gap-2">
                {BUSINESS.aspects.map((a) => {
                  const l = aspectLabel(a);
                  const on = aspects.includes(l);
                  return (
                    <button key={a.key} onClick={() => toggle(l, aspects, setAspects)}
                      className={`px-4 py-2 rounded-full text-sm border ${
                        on ? "bg-[#fdecc8] text-[#4e2000] border-transparent"
                           : "bg-white text-[#7a6455] border-[#e6d9cb]"}`}>
                      {l}{on ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="font-medium text-[#7a6455] mb-2">What did you have?</p>
              <div className="flex flex-wrap gap-2">
                {BUSINESS.items.map((i) => {
                  const on = items.includes(i);
                  return (
                    <button key={i} onClick={() => toggle(i, items, setItems)}
                      className={`px-4 py-2 rounded-full text-sm border ${
                        on ? "bg-[#fde4d8] text-[#dd2803] border-transparent"
                           : "bg-white text-[#7a6455] border-[#e6d9cb]"}`}>
                      {i}{on ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {genError && (
              <p className="text-sm text-center text-[#dd2803]">
                Couldn&apos;t write your review — check your connection and try again.
              </p>
            )}
            <button onClick={generate}
              disabled={loading || (aspects.length === 0 && items.length === 0)}
              className="mt-auto bg-[#4e2000] text-white rounded-2xl py-4 font-medium disabled:opacity-40">
              {loading ? "Writing…" : genError ? "Try again" : "Continue"}
            </button>
          </div>
        )}

        {/* SCREEN 3 — REVIEW & EDIT */}
        {step === 3 && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-[#7a6455]">Your review</p>
              <button onClick={generate} disabled={loading}
                className="text-[#4e2000] font-medium disabled:opacity-40">
                {loading ? "Writing…" : "Redo"}
              </button>
            </div>
            <textarea value={review} onChange={(e) => setReview(e.target.value)}
              className="w-full h-40 rounded-2xl border border-[#e6d9cb] bg-[#fdf8f2] p-4 text-[#2b1608] resize-none" />
            {genError && (
              <p className="text-sm text-center text-[#dd2803]">
                Couldn&apos;t regenerate — check your connection and try Redo again.
              </p>
            )}
            <button onClick={copyAndPost} disabled={loading}
              className="mt-2 bg-[#4e2000] text-white rounded-2xl py-4 font-medium disabled:opacity-40">
              Copy &amp; post to Google
            </button>
            <p className="text-center text-sm text-[#a6927f]">edit anything before you post</p>
          </div>
        )}

        {/* SCREEN 4 — PASTE & POST */}
        {step === 4 && (
          <div className="flex-1 flex flex-col items-center text-center gap-4 pt-10">
            <div className="w-16 h-16 rounded-full bg-[#fdecc8] flex items-center justify-center text-2xl text-[#4e2000]">
              ✓
            </div>
            <h2 className="text-xl font-medium text-[#2b1608]">
              {copyFailed ? "Copy this review" : "Review copied"}
            </h2>
            <p className="text-[#7a6455]">
              {copyFailed
                ? "Couldn't copy automatically — select the text below and copy it yourself."
                : "Your review is on the clipboard. In the live app this button also opens Google's review box to paste into — stubbed out for the mock."}
            </p>
            {copyFailed && (
              <textarea readOnly value={review} onFocus={(e) => e.target.select()}
                className="w-full h-32 rounded-2xl border border-[#e6d9cb] bg-[#fdf8f2] p-4 text-[#2b1608] resize-none" />
            )}
            {!posted ? (
              <button onClick={() => { setPosted(true); track("posted_tap"); }}
                className="mt-4 border border-[#e6d9cb] rounded-2xl px-6 py-3 text-[#2b1608]">
                I&apos;ve posted my review
              </button>
            ) : (
              <p className="mt-4 text-[#4e2000] font-medium">Thank you! 🎉</p>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
