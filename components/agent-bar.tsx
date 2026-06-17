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
    <div className="border-b border-turf-800 bg-turf-900 px-4 py-2 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 sm:px-2 lg:px-4">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">
          Acting for
        </span>
        <select
          value={selectedId}
          onChange={handleChange}
          className="rounded-lg border border-turf-700 bg-turf-950 px-3 py-1.5 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-gold-400"
        >
          {jockeys.map((j) => (
            <option key={j.id} value={j.id}>
              {j.full_name ?? "Unnamed jockey"}
            </option>
          ))}
        </select>
        <span className="hidden text-xs text-turf-200/60 sm:block">
          Switch to manage a different jockey&apos;s calendar and requests.
        </span>
      </div>
    </div>
  );
}
