// 전국 행정동 GeoJSON에서 청도군 9개 읍·면만 잘라낸다.
// 원본: HangJeongDong_ver20250701.geojson (프로젝트 루트, git 추적 안 함)
// 출력: public/geo/cheongdo.geojson

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const srcPath = join(root, "HangJeongDong_ver20250701.geojson")
const outDir = join(root, "public", "geo")
const outPath = join(outDir, "cheongdo.geojson")

const raw = JSON.parse(readFileSync(srcPath, "utf-8"))

const filtered = raw.features.filter(
  (f) => f.properties.sidonm === "경상북도" && f.properties.sggnm === "청도군",
)

if (filtered.length === 0) {
  throw new Error("청도군 데이터를 찾지 못했습니다. sidonm/sggnm 필드명을 다시 확인하세요.")
}

// 외곽 링 정점 평균으로 근사 중심점 계산 — 라벨/툴팁 위치용 (지도용 정밀 무게중심 아님)
function approxCentroid(geometry) {
  const rings = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0])
  let biggest = rings[0]
  for (const ring of rings) {
    if (ring.length > biggest.length) biggest = ring
  }
  let sumLng = 0
  let sumLat = 0
  for (const [lng, lat] of biggest) {
    sumLng += lng
    sumLat += lat
  }
  return [sumLng / biggest.length, sumLat / biggest.length]
}

const features = filtered.map((f) => {
  const regionName = f.properties.adm_nm.replace("경상북도 청도군 ", "")
  return {
    type: "Feature",
    properties: {
      regionName,
      centroid: approxCentroid(f.geometry),
    },
    geometry: f.geometry,
  }
})

console.log(
  `청도군 ${features.length}개 읍·면 추출:`,
  features.map((f) => f.properties.regionName).sort(),
)

const out = {
  type: "FeatureCollection",
  name: "Cheongdo",
  crs: raw.crs,
  features,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(outPath, JSON.stringify(out))

console.log(`저장 완료: ${outPath}`)
