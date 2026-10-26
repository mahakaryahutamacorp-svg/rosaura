"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDisplayPromoAction, removeDisplayPromoAction } from "@/app/actions/display-promos";
import {
  emptyDisplayPromos,
  type CustomerDisplaySnapshot,
  type DisplayPromoSlide,
  type DisplayPromoSlot,
} from "@/lib/display";
import { formatRupiah } from "@/lib/format";
import { formatClock } from "@/lib/time";

const QRIS = "/display/qris.jpg?v=2";
const HOTLINE = "/display/hotline.jpg?v=2";
const REVIEW = "/display/review.jpg?v=2";
const POLL_MS = 5000;
const PROMO_ROTATE_MS = 5000;

interface Slide {
  key: string;
  src: string;
  alt: string;
  promoId: string | null;
}

function normalizeSnapshot(data: CustomerDisplaySnapshot) {
  if (!data || !Array.isArray(data.queue) || !Array.isArray(data.beds)) return null;
  const promos = data.promos ?? emptyDisplayPromos();
  return {
    ...data,
    promos: {
      qris: Array.isArray(promos.qris) ? promos.qris : [],
      hotline: Array.isArray(promos.hotline) ? promos.hotline : [],
      review: Array.isArray(promos.review) ? promos.review : [],
    },
  };
}

export function CustomerDisplay({ initial }: { initial: CustomerDisplaySnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const revision = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++revision.current;
    try {
      const response = await fetch("/api/display", { cache: "no-store" });
      if (!response.ok || ticket !== revision.current) return;
      const next = normalizeSnapshot((await response.json()) as CustomerDisplaySnapshot);
      if (!next || ticket !== revision.current) return;
      setSnapshot(next);
    } catch {
      // Layar tetap menampilkan snapshot terakhir saat jaringan sesaat putus.
    }
  }, []);

  const rememberPromos = useCallback((slot: DisplayPromoSlot, photos: DisplayPromoSlide[]) => {
    revision.current += 1;
    setSnapshot((current) => ({
      ...current,
      promos: {
        ...current.promos,
        [slot]: [
          ...current.promos[slot],
          ...photos.filter((photo) => !current.promos[slot].some((item) => item.id === photo.id)),
        ],
      },
    }));
    void reload();
  }, [reload]);

  const forgetPromo = useCallback((slot: DisplayPromoSlot, photoId: string) => {
    revision.current += 1;
    setSnapshot((current) => ({
      ...current,
      promos: {
        ...current.promos,
        [slot]: current.promos[slot].filter((photo) => photo.id !== photoId),
      },
    }));
    void reload();
  }, [reload]);

  useEffect(() => {
    function loadWhenVisible() {
      if (document.visibilityState === "visible") void reload();
    }

    const poll = window.setInterval(loadWhenVisible, POLL_MS);
    const ticker = window.setInterval(() => setClock(formatClock(new Date())), 1000);
    document.addEventListener("visibilitychange", loadWhenVisible);
    return () => {
      revision.current += 1;
      window.clearInterval(poll);
      window.clearInterval(ticker);
      document.removeEventListener("visibilitychange", loadWhenVisible);
    };
  }, [reload]);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-ivory text-ink">
      <header className="flex items-end justify-between gap-4 px-6 pt-6 sm:px-10">
        <div>
          <p className="text-sm tracking-[0.22em] text-gold-deep uppercase">Rosaura Skin Clinic</p>
          <h1 className="font-display text-4xl sm:text-5xl">{snapshot.bill ? "Pembayaran" : "Selamat datang"}</h1>
        </div>
        <p className="font-display text-4xl tabular-nums sm:text-5xl">{clock}</p>
      </header>

      {snapshot.bill ? (
        <BillView snapshot={snapshot} onAdded={rememberPromos} onRemoved={forgetPromo} />
      ) : (
        <LobbyView snapshot={snapshot} onAdded={rememberPromos} onRemoved={forgetPromo} />
      )}
    </main>
  );
}

interface PromoControls {
  onAdded: (slot: DisplayPromoSlot, photos: DisplayPromoSlide[]) => void;
  onRemoved: (slot: DisplayPromoSlot, photoId: string) => void;
}

function LobbyView({ snapshot, onAdded, onRemoved }: { snapshot: CustomerDisplaySnapshot } & PromoControls) {
  return (
    <>
      <section className="grid min-h-0 flex-1 gap-4 px-6 py-4 sm:px-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="min-h-0 overflow-auto rounded-[2rem] border border-line bg-paper p-6 sm:p-8">
          <h2 className="font-display text-3xl">Antrian</h2>
          {snapshot.queue.length === 0 ? (
            <p className="mt-8 text-2xl text-muted">Belum ada antrian.</p>
          ) : (
            <ol className="mt-6 space-y-4">
              {snapshot.queue.map((entry) => (
                <li key={entry.id} className="flex items-baseline justify-between gap-4 border-b border-line pb-4 last:border-0">
                  <span className="font-display text-4xl capitalize">{entry.name}</span>
                  <span className="text-2xl tabular-nums text-brown">{entry.time}</span>
                </li>
              ))}
            </ol>
          )}
        </article>

        <div className="grid min-h-0 gap-4 overflow-auto">
          {snapshot.beds.map((bed) => (
            <article key={bed.name} className="flex items-center justify-between gap-4 rounded-[2rem] border border-line bg-paper px-6 py-5">
              <h2 className="font-display text-3xl">{bed.name}</h2>
              <p className={`text-right text-3xl capitalize ${bed.clientName ? "font-display" : "text-muted"}`}>
                {bed.clientName ?? "Kosong"}
              </p>
            </article>
          ))}
        </div>
      </section>
      <SupportAssets promos={snapshot.promos} onAdded={onAdded} onRemoved={onRemoved} />
    </>
  );
}

function BillView({ snapshot, onAdded, onRemoved }: { snapshot: CustomerDisplaySnapshot } & PromoControls) {
  const bill = snapshot.bill;
  if (!bill) return null;

  return (
    <>
      <section className="grid min-h-0 flex-1 gap-4 px-6 py-4 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)]">
        <article className="flex flex-col rounded-[2rem] border border-line bg-paper p-6 sm:p-8">
          <p className="text-sm tracking-[0.18em] text-gold-deep uppercase">Tagihan</p>
          <h2 className="font-display mt-2 text-5xl capitalize">{bill.clientName}</h2>
          <ul className="mt-8 space-y-3">
            {bill.lines.map((line, index) => (
              <li key={`${line.name}-${index}`} className="flex items-baseline justify-between gap-4 text-xl">
                <span>
                  {line.name}
                  {line.quantity > 1 ? <span className="text-muted"> × {line.quantity}</span> : null}
                </span>
                <span className="tabular-nums">{formatRupiah(line.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t border-line pt-6">
            <p className="text-sm tracking-[0.18em] text-gold-deep uppercase">Total</p>
            <p className="font-display text-6xl tabular-nums sm:text-7xl">{formatRupiah(bill.total)}</p>
            <p className="mt-3 max-w-xl text-lg text-brown">Pindai QRIS, lalu masukkan nominal ini di aplikasi pembayaran.</p>
          </div>
        </article>

        <article className="flex min-h-0 flex-col items-center justify-center rounded-[2rem] border border-line bg-white p-4">
          <img src={QRIS} alt="QRIS Rosaura Skin Clinic" className="h-full max-h-full w-full object-contain" />
          <p className="mt-2 shrink-0 text-center text-sm text-brown">QRIS · NMID ID1025379344944</p>
        </article>
      </section>
      <SupportAssets hideQris promos={snapshot.promos} onAdded={onAdded} onRemoved={onRemoved} />
    </>
  );
}

function SupportAssets({
  hideQris = false,
  promos,
  onAdded,
  onRemoved,
}: {
  hideQris?: boolean;
  promos: CustomerDisplaySnapshot["promos"];
} & PromoControls) {
  return (
    <footer className={`grid h-[42vh] shrink-0 gap-4 px-6 pb-4 sm:px-10 ${hideQris ? "grid-cols-2" : "grid-cols-3"}`}>
      {hideQris ? null : (
        <QrCard
          slot="qris"
          src={QRIS}
          alt="QRIS Rosaura Skin Clinic"
          caption="Bayar dengan QRIS"
          promos={promos.qris}
          onAdded={onAdded}
          onRemoved={onRemoved}
        />
      )}
      <QrCard
        slot="hotline"
        src={HOTLINE}
        alt="QR kritik dan saran Rosaura, 0812-1117-2228"
        caption="Kritik dan saran · 0812-1117-2228"
        promos={promos.hotline}
        onAdded={onAdded}
        onRemoved={onRemoved}
      />
      <QrCard
        slot="review"
        src={REVIEW}
        alt="QR ulasan Google Rosaura Skin Clinic"
        caption="Ulasan Google"
        promos={promos.review}
        onAdded={onAdded}
        onRemoved={onRemoved}
      />
    </footer>
  );
}

function QrCard({
  slot,
  src,
  alt,
  caption,
  promos,
  onAdded,
  onRemoved,
}: {
  slot: DisplayPromoSlot;
  src: string;
  alt: string;
  caption: string;
  promos: DisplayPromoSlide[];
} & PromoControls) {
  const slides: Slide[] = [
    { key: "qr", src, alt, promoId: null },
    ...promos.map((promo) => ({
      key: promo.id,
      src: promo.url,
      alt: "Foto promosi Rosaura Skin Clinic",
      promoId: promo.id,
    })),
  ];
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previousCount = useRef(promos.length);
  const safeIndex = slides.length === 0 ? 0 : index % slides.length;
  const current = slides[safeIndex];

  useEffect(() => {
    if (promos.length > previousCount.current) setIndex(promos.length);
    previousCount.current = promos.length;
  }, [promos.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, PROMO_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("slot", slot);
    for (const file of files) body.append("photo", file);
    try {
      const result = await addDisplayPromoAction(body);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onAdded(slot, result.photos);
    } catch {
      setError("Foto gagal disimpan");
    } finally {
      setBusy(false);
    }
  }

  async function removeCurrent() {
    if (!current?.promoId || busy) return;
    const photoId = current.promoId;
    setBusy(true);
    setError("");
    try {
      const result = await removeDisplayPromoAction(photoId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onRemoved(slot, photoId);
    } catch {
      setError("Foto gagal dihapus");
    } finally {
      setBusy(false);
    }
  }

  return (
    <figure className="flex min-h-0 flex-col rounded-[1.5rem] border border-line bg-white px-3 pt-3 pb-2">
      <div className="relative min-h-0 flex-1">
        {slides.map((slide, slideIndex) => (
          <img
            key={slide.key}
            src={slide.src}
            alt={slideIndex === safeIndex ? slide.alt : ""}
            aria-hidden={slideIndex !== safeIndex}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${
              slideIndex === safeIndex ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}
        {slides.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center">
            <div className="flex gap-1 rounded-full bg-white/85 px-2 py-1">
              {slides.map((slide, slideIndex) => (
                <span
                  key={slide.key}
                  className={`h-1.5 w-1.5 rounded-full ${slideIndex === safeIndex ? "bg-ink" : "bg-ink/25"}`}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="absolute top-1 right-1 z-10 flex gap-1">
          {current?.promoId ? (
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white/95 text-brown shadow-sm transition hover:border-[#8a3d36] hover:text-[#8a3d36] disabled:opacity-50"
              aria-label="Hapus foto promosi"
              title="Hapus foto promosi"
              disabled={busy}
              onClick={() => void removeCurrent()}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white/95 text-brown shadow-sm transition hover:border-gold hover:text-ink disabled:opacity-50"
            aria-label="Tambah foto promosi"
            title="Tambah foto promosi"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <figcaption className="shrink-0 pt-2 text-center text-sm text-brown">{caption}</figcaption>
      {error ? <p className="shrink-0 truncate text-center text-xs text-[#8a3d36]">{error}</p> : null}
    </figure>
  );
}
