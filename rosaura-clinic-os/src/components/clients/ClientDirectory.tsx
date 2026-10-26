"use client";

import Link from "next/link";
import { setClientActiveAction } from "@/app/actions/operations";

export interface ClientRow {
  id: string;
  fullName: string;
  clientCode: string;
  birth: string;
  visits: number;
  isActive: boolean;
  phone?: string;
}

export function ClientDirectory({ clients, canEdit }: { clients: ClientRow[]; canEdit: boolean }) {
  const visible = clients;
  const showPhone = clients.some((client) => client.phone !== undefined);

  return (
    <section className="space-y-3">
      <div className="max-h-[70vh] overflow-auto rounded-3xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Kode</th>
              <th className="px-3 py-3 font-medium">Nama</th>
              {showPhone ? <th className="px-3 py-3 font-medium">Telepon</th> : null}
              <th className="px-3 py-3 font-medium">Lahir</th>
              <th className="px-3 py-3 font-medium">Kunjungan</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-muted" colSpan={showPhone ? 6 : 5}>
                  Klien tidak ditemukan.
                </td>
              </tr>
            ) : null}
            {visible.map((client) => (
              <tr key={client.id} className="border-b border-line/70 last:border-0">
                <td className="px-5 py-3">{client.clientCode}</td>
                <td className="px-3 py-3 font-medium capitalize">
                  <Link href={`/clients/${client.id}`}>{client.fullName}</Link>
                </td>
                {showPhone ? <td className="px-3 py-3">{client.phone || "-"}</td> : null}
                <td className="px-3 py-3">{client.birth}</td>
                <td className="px-3 py-3">{client.visits}</td>
                <td className="px-5 py-3">
                  {canEdit ? (
                    <form action={setClientActiveAction}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="isActive" value={client.isActive ? "false" : "true"} />
                      <button className="text-gold-deep" type="submit">
                        {client.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </form>
                  ) : client.isActive ? (
                    "Aktif"
                  ) : (
                    "Nonaktif"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
