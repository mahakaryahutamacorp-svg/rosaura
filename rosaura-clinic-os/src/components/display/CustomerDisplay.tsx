"use client";

import { useEffect, useState } from "react";
import type { CustomerDisplaySnapshot } from "@/lib/display";
import { formatRupiah } from "@/lib/format";
import { formatClock } from "@/lib/time";

const QRIS = "/display/qris.jpg?v=2";
const HOTLINE = "/display/hotline.jpg?v=2";
const REVIEW = "/display/review.jpg?v=2";

export function CustomerDisplay({ initial }: { initial: CustomerDisplaySnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    let stopped = false;

    async function load() {
      try {
        const response = await fetch("/api/display", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const data = (await response.json()) as CustomerDisplaySnapshot;
        if (!stopped && data && Array.isArray(data.queue) && Array.isArray(data.beds)) {
          setSnapshot(data);
        }
      } catch {
        // Layar tetap menampilkan snapshot terakhir saat jaringan sesaat putus.
      }
    }

    const poll = window.setInterval(() => void load(), 2000);
    const ticker = window.setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => {
      stopped = true;
      window.clearInterval(poll);
      window.clearInterval(ticker);
    };
  }, []);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-ivory text-ink">
      <header className="flex items-end justify-between gap-4 px-6 pt-6 sm:px-10">
        <div>
          <p className="text-sm tracking-[0.22em] text-gold-deep uppercase">Rosaura Skin Clinic</p>
          <h1 className="font-display text-4xl sm:text-5xl">{snapshot.bill ? "Pembayaran" : "Selamat datang"}</h1>
        </div>
        <p className="font-display text-4xl tabular-nums sm:text-5xl">{clock}</p>
      </header>

      {snapshot.bill ? <BillView snapshot={snapshot} /> : <LobbyView snapshot={snapshot} />}
    </main>
  );
}

function LobbyView({ snapshot }: { snapshot: CustomerDisplaySnapshot }) {
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
      <SupportAssets />
    </>
  );
}

function BillView({ snapshot }: { snapshot: CustomerDisplaySnapshot }) {
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
      <SupportAssets hideQris />
    </>
  );
}

function SupportAssets({ hideQris = false }: { hideQris?: boolean }) {
  return (
    <footer className={`grid h-[42vh] shrink-0 gap-4 px-6 pb-4 sm:px-10 ${hideQris ? "grid-cols-2" : "grid-cols-3"}`}>
      {hideQris ? null : <QrCard src={QRIS} alt="QRIS Rosaura Skin Clinic" caption="Bayar dengan QRIS" />}
      <QrCard src={HOTLINE} alt="QR kritik dan saran Rosaura, 0812-1117-2228" caption="Kritik dan saran · 0812-1117-2228" />
      <QrCard src={REVIEW} alt="QR ulasan Google Rosaura Skin Clinic" caption="Ulasan Google" />
    </footer>
  );
}

function QrCard({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="flex min-h-0 flex-col rounded-[1.5rem] border border-line bg-white px-3 pt-3 pb-2">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      </div>
      <figcaption className="shrink-0 pt-2 text-center text-sm text-brown">{caption}</figcaption>
    </figure>
  );
}
