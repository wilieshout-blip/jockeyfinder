"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface ManagedJockey {
  id: string;
  full_name: string | null;
}

/**
 * Sticky bar shown below the main nav for agent users.
 * Lets them pick which jockey they are acting for,
 * persisting the choice across all dashboard pages.
 */
export function AgentBar({ jockeys }: { jockeys: ManagedJockey[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const getInitialId = () => {
    const fromUrl = searchParams.get("jockey");
    if (fromUrl) return fromUrl;
    if (typeof window !== "undefined") {
      return localStorage.getItem("agent_jockey") ?? jockeys[0]?.id ?? "";
    }
    return jockeys[0]?.id ?? "";
  };

  const [selectedId, setSelectedId] = useState<string>(getInitialId);

  // Sync when the URL param changes externally
  useEffect(() => {
    const fromUrl = searchParams.get("jockey");
    if (fromUrl && fromUrl !== selectedId) {
      setSelectedId(fromUrl);
      localStorage.setItem("agent_jockey", fromUrl);
    }
  }, [searchParams]);

  // On mount: inject the saved jockey into the URL if not already there
  useEffect(() => {
    if (!searchParams.get("jockey") && selectedId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("jockey", selectedId);
      router.replace(pathname + "?" + params.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    localStorage.setItem("agent_jockey", id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("jockey", id);
    router.push(pathname + "?" + params.toString());
  }

  if (jockeys.length === 0) return null;

  return (
    <div className="border-b border-turf-100 bg-turf-50 px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.12em] text-turf-700">
          Acting for
        </span>
        <select
          value={selectedId}
          onChange={handleChange}
          className="rounded-lg border border-turf-200 bg-white px-3 py-1.5 text-sm font-medium text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-turf-500"
        >
          {jockeys.map((j) => (
            <option key={j.id} value={j.id}>
              {j.full_name ?? "Unnamed jockey"}
            </option>
          ))}
        </select>
        <span className="hidden text-xs text-zinc-500 sm:block">
          Switch to manage a different jockey&apos;s calendar and requests.
        </span>
      </div>
    </div>
  );
}
