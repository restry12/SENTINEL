"use client";

import type { Glacier } from "@/lib/glacier-types";

interface Props {
  glaciers: Glacier[];
}

function formatDate(value: string | undefined): string {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function GlacierKPIBar({ glaciers }: Props) {
  if (glaciers.length === 0) return null;

  const avgArea = glaciers.reduce((sum, glacier) => sum + glacier.area, 0) / glaciers.length;
  const largest = glaciers.reduce((current, glacier) => (glacier.area > current.area ? glacier : current), glaciers[0]);
  const criticalCount = glaciers.filter((glacier) => glacier.cat === "Critico").length;
  const inNorthernHemisphere = glaciers.filter((glacier) => glacier.lat >= 0).length;
  const inSouthernHemisphere = glaciers.length - inNorthernHemisphere;

  const latestDate = glaciers
    .map((glacier) => glacier.srcDate)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  const blocks = [
    { label: "Monitoreados", value: String(glaciers.length), unit: "en vista", color: "#46b8ff" },
    { label: "Area promedio", value: avgArea.toFixed(2), unit: "km2", color: "#8be2ff" },
    { label: "Mayor glaciar", value: largest.area.toFixed(1), unit: "km2", color: "#1dd38a" },
    { label: "Criticos", value: String(criticalCount), unit: "riesgo alto", color: "#ff5a5a" },
    { label: "Norte / Sur", value: `${inNorthernHemisphere}/${inSouthernHemisphere}`, unit: "hemisferio", color: "#ff9a3d" },
    { label: "Ultima observacion", value: formatDate(latestDate), unit: "GLIMS", color: "#d0d7e5" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
      {blocks.map((block) => (
        <div
          key={block.label}
          className="min-w-0 rounded-lg border border-white/10 bg-[#0a0d14]/88 p-2.5 shadow-2xl backdrop-blur-xl"
        >
          <p className="truncate text-[8px] font-bold uppercase tracking-widest text-white/40">{block.label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="truncate text-[1.05rem] font-black leading-none" style={{ color: block.color }}>
              {block.value}
            </span>
            <span className="truncate text-[8px] font-mono text-white/35">{block.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
