"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { fieldClass, labelClass, secondaryButton } from "@/lib/styles";

const DEBOUNCE_MS = 350;

interface SearchBoxProps {
  basePath: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  preserveParams?: Record<string, string>;
}

function buildHref(basePath: string, query: string, preserveParams: Record<string, string>) {
  const search = new URLSearchParams(preserveParams);
  const term = query.trim();
  if (term) search.set("q", term);
  const text = search.toString();
  return text ? `${basePath}?${text}` : basePath;
}

export function SearchBox({ basePath, label, placeholder, defaultValue, preserveParams = {} }: SearchBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const lastSubmitted = useRef(defaultValue.trim());
  const preserveKey = JSON.stringify(preserveParams);

  useEffect(() => {
    const term = value.trim();
    if (term === lastSubmitted.current) return;
    const timer = window.setTimeout(() => {
      lastSubmitted.current = term;
      const params = JSON.parse(preserveKey) as Record<string, string>;
      startTransition(() => router.replace(buildHref(basePath, term, params), { scroll: false }));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, basePath, preserveKey, router]);

  return (
    <form method="get" action={basePath} role="search" className="flex flex-wrap items-end gap-3">
      {Object.entries(preserveParams).map(([key, paramValue]) => (
        <input key={key} type="hidden" name={key} value={paramValue} />
      ))}
      <label className="min-w-64 flex-1">
        <span className={labelClass}>{label}</span>
        <input
          className={fieldClass}
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={80}
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>
      <button className={secondaryButton} type="submit">
        {isPending ? "Mencari..." : "Cari"}
      </button>
    </form>
  );
}
