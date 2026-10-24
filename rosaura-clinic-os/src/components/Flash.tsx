export function Flash({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <p
      className={`rounded-2xl px-4 py-3 text-sm ${error ? "bg-[#f8e8e4] text-[#8a3d36]" : "bg-[#e7f0e6] text-[#2f5d3a]"}`}
    >
      {error ?? notice}
    </p>
  );
}
