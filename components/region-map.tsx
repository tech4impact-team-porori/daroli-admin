"use client"

import { useState } from "react"
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"

import type { RegionStat } from "@/lib/types"

const GEO_URL = "/geo/cheongdo.geojson"

// dataviz 스킬 sequential blue 램프의 step100(#cde2fb)~step700(#0d366b) 사이를 보간
const FILL_LIGHT = { r: 0xcd, g: 0xe2, b: 0xfb }
const FILL_DARK = { r: 0x0d, g: 0x36, b: 0x6b }

function fillColor(intensity: number) {
  const t = Math.min(1, Math.max(0, intensity))
  const r = Math.round(FILL_LIGHT.r + (FILL_DARK.r - FILL_LIGHT.r) * t)
  const g = Math.round(FILL_LIGHT.g + (FILL_DARK.g - FILL_LIGHT.g) * t)
  const b = Math.round(FILL_LIGHT.b + (FILL_DARK.b - FILL_LIGHT.b) * t)
  return `rgb(${r}, ${g}, ${b})`
}

/** 지도 채움색 기준 — 수요 보기(대상자 수) / 매니저 보기(활동가능 매니저 수) */
export type RegionMapMetric = "demand" | "manager"

/**
 * 통합 지역 지도 (기획서 2-9) — `/managers` 화면 전용 (Phase 14)
 * 채움색 = metric 에 따라 대상자 수 또는 활동가능 매니저 수, 붉은 테두리 = 매니저 부족 지역
 */
export function RegionMap({ regions, metric }: { regions: RegionStat[]; metric: RegionMapMetric }) {
  const [hovered, setHovered] = useState<{ region: string; x: number; y: number } | null>(null)

  const byName = new Map(regions.map((r) => [r.region as string, r]))
  const maxRecipients = Math.max(...regions.map((r) => r.recipientCount), 0)
  const maxActiveManagers = Math.max(...regions.map((r) => r.activeManagerCount), 0)
  const hoveredStat = hovered ? byName.get(hovered.region) : undefined

  return (
    <div className="relative">
      <div className="mx-auto w-full max-w-xl">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [128.787, 35.706], scale: 52000 }}
          width={560}
          height={400}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) => (
              <>
                {geographies.map((geo) => {
                  const name = geo.properties.regionName as string
                  const stat = byName.get(name)
                  const intensity =
                    metric === "demand"
                      ? maxRecipients > 0
                        ? (stat?.recipientCount ?? 0) / maxRecipients
                        : 0
                      : maxActiveManagers > 0
                        ? (stat?.activeManagerCount ?? 0) / maxActiveManagers
                        : 0
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fillColor(intensity)}
                      stroke={stat?.isShortage ? "#d03b3b" : "#c3c2b7"}
                      strokeWidth={stat?.isShortage ? 2 : 0.75}
                      onMouseEnter={(evt) => setHovered({ region: name, x: evt.clientX, y: evt.clientY })}
                      onMouseMove={(evt) => setHovered({ region: name, x: evt.clientX, y: evt.clientY })}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", filter: "brightness(0.94)", cursor: "pointer" },
                        pressed: { outline: "none" },
                      }}
                    />
                  )
                })}
                {geographies.map((geo) => {
                  const name = geo.properties.regionName as string
                  const stat = byName.get(name)
                  return (
                    <Marker key={`label-${geo.rsmKey}`} coordinates={geo.properties.centroid as [number, number]}>
                      <text textAnchor="middle" style={{ fontSize: 9, fill: "#0b0b0b", pointerEvents: "none" }}>
                        {name}
                      </text>
                      <text y={11} textAnchor="middle" style={{ fontSize: 8, fill: "#52514e", pointerEvents: "none" }}>
                        {stat ? `수요 ${stat.recipientCount} · 매니저 ${stat.activeManagerCount}` : ""}
                      </text>
                    </Marker>
                  )
                })}
              </>
            )}
          </Geographies>
        </ComposableMap>
      </div>

      {hoveredStat && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-border bg-popover px-3 py-2 text-xs whitespace-nowrap shadow-md"
          style={{ left: (hovered?.x ?? 0) + 12, top: (hovered?.y ?? 0) + 12 }}
        >
          <p className="font-medium">{hoveredStat.region}</p>
          <p>대상자 {hoveredStat.recipientCount}명</p>
          <p>
            활동가능 매니저 {hoveredStat.activeManagerCount}명 · 배정 매니저 {hoveredStat.assignedManagerCount}명
          </p>
          <p>이달 활동 {hoveredStat.monthlyLogCount}건</p>
          {hoveredStat.isShortage && <p className="mt-1 font-medium text-rose-600">도움이 더 필요한 지역</p>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-10 rounded-sm"
            style={{ background: `linear-gradient(to right, ${fillColor(0)}, ${fillColor(1)})` }}
          />
          <span>{metric === "demand" ? "대상자 적음 → 많음" : "매니저 적음 → 많음"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border-2 border-rose-600" />
          <span>매니저 부족(배치 필요) 지역</span>
        </div>
      </div>
    </div>
  )
}
