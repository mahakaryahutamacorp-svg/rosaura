"use client";

import { useState } from "react";

export interface ProgressPhoto {
  id: string;
  label: string;
  caption: string;
}

export function PhotoProgress({ photos }: { photos: ProgressPhoto[] }) {
  const [index, setIndex] = useState(Math.max(photos.length - 1, 0));
  if (photos.length === 0) {
    return (
      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display text-2xl">Perkembangan</h2>
        <p className="mt-2 text-sm text-muted">
          Belum ada foto. Tambahkan foto pada setiap kunjungan agar urutannya bisa dibandingkan.
        </p>
      </section>
    );
  }

  const safeIndex = Math.min(index, photos.length - 1);
  const photo = photos[safeIndex];

  return (
    <section className="rounded-3xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Perkembangan</h2>
          <p className="text-sm text-muted">
            {safeIndex + 1} dari {photos.length}, dari kunjungan paling lama ke paling baru.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="h-10 rounded-xl border border-line px-3 text-sm disabled:opacity-40"
            type="button"
            disabled={safeIndex === 0}
            onClick={() => setIndex(safeIndex - 1)}
          >
            Sebelumnya
          </button>
          <button
            className="h-10 rounded-xl border border-line px-3 text-sm disabled:opacity-40"
            type="button"
            disabled={safeIndex === photos.length - 1}
            onClick={() => setIndex(safeIndex + 1)}
          >
            Berikutnya
          </button>
        </div>
      </div>
      <img
        className="mt-4 max-h-[28rem] w-full rounded-2xl bg-ivory object-contain"
        src={`/clinical-photos/${photo.id}`}
        alt={`Foto kunjungan ${photo.label}`}
      />
      <p className="mt-3 text-sm">
        <span className="font-medium">{photo.label}</span>
        {photo.caption ? <span className="text-muted"> · {photo.caption}</span> : null}
      </p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {photos.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            className={`shrink-0 rounded-xl border p-1 ${itemIndex === safeIndex ? "border-gold" : "border-line"}`}
            aria-pressed={itemIndex === safeIndex}
            aria-label={`Lihat foto ${item.label}`}
            onClick={() => setIndex(itemIndex)}
          >
            <img className="h-20 w-20 rounded-lg object-cover" src={`/clinical-photos/${item.id}`} alt="" />
          </button>
        ))}
      </div>
    </section>
  );
}
