/**
 * One-off generator for bulky test CSVs (run: node scripts/gen-large-samples.mjs).
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const pub = join(root, '..', 'public')

function writeEvents12k() {
  const lines = [
    'event_id,user_id,session_min,page_views,add_to_cart,revenue_usd,device_score,region_id,day_of_week,hour_utc,anomaly_score',
  ]
  let id = 1
  for (let i = 0; i < 12000; i++) {
    const u = 1000 + (i % 800)
    const sm = 2 + (i % 45)
    const pv = 1 + (i % 120) + ((i * 7) % 19)
    const cart = i % 11 === 0 ? 1 : 0
    const rev = ((i * 17.31) % 890) / 10
    const dev = ((i * 13) % 100) / 100
    const r = 1 + (i % 12)
    const dow = i % 7
    const h = i % 24
    const base = Math.sin(i * 0.02) * 0.15 + Math.cos(i * 0.011) * 0.12
    const spike = i % 997 === 0 ? 0.55 : 0
    const anomaly = Math.min(0.99, Math.max(0.01, 0.12 + base + spike))
    lines.push(
      [
        id++,
        u,
        sm,
        pv,
        cart,
        rev.toFixed(2),
        dev.toFixed(2),
        r,
        dow,
        h,
        anomaly.toFixed(3),
      ].join(','),
    )
  }
  writeFileSync(join(pub, 'sample-events-12k.csv'), lines.join('\n'), 'utf8')
  console.log('Wrote sample-events-12k.csv')
}

function writeHourly720() {
  const lines = [
    'ts,power_kw,vibration_mm_s,temp_inlet_c,pressure_kpa,defect_risk',
  ]
  const start = Date.parse('2026-01-01T00:00:00Z')
  for (let h = 0; h < 720; h++) {
    const t = new Date(start + h * 3600000).toISOString()
    const cycle = Math.sin(h / 24) * 8 + Math.cos(h / 168) * 3
    const power = 420 + cycle + (h % 17) * 0.4 + (h % 211 === 0 ? 40 : 0)
    const vib = 0.12 + (h % 13) * 0.004 + (h % 401 === 0 ? 0.35 : 0)
    const temp = 58 + (h % 9) * 0.6 + Math.sin(h / 12) * 2
    const press = 210 + (h % 5) * 1.2
    const risk = Math.min(
      1,
      Math.max(
        0,
        0.05 +
          (h % 353 === 0 ? 0.45 : 0) +
          (vib > 0.28 ? 0.2 : 0) +
          (power > 455 ? 0.15 : 0),
      ),
    )
    lines.push(
      [
        t,
        power.toFixed(2),
        vib.toFixed(4),
        temp.toFixed(2),
        press.toFixed(2),
        risk.toFixed(3),
      ].join(','),
    )
  }
  writeFileSync(join(pub, 'sample-iot-hourly-720.csv'), lines.join('\n'), 'utf8')
  console.log('Wrote sample-iot-hourly-720.csv')
}

function writeWideTelemetry() {
  const metrics = [
    'm01',
    'm02',
    'm03',
    'm04',
    'm05',
    'm06',
    'm07',
    'm08',
    'm09',
    'm10',
    'm11',
    'm12',
  ]
  const lines = [['sample_idx', 'batch', ...metrics].join(',')]
  for (let i = 0; i < 400; i++) {
    const vals = metrics.map((_, j) => {
      const v =
        Math.sin((i + j) * 0.07) * 10 +
        Math.cos(i * 0.03 + j) * 4 +
        (j + 1) * 0.5 +
        (i % 97 === 0 ? 18 : 0)
      return v.toFixed(4)
    })
    lines.push([i, 1 + (i % 8), ...vals].join(','))
  }
  writeFileSync(join(pub, 'sample-wide-telemetry-400.csv'), lines.join('\n'), 'utf8')
  console.log('Wrote sample-wide-telemetry-400.csv')
}

writeEvents12k()
writeHourly720()
writeWideTelemetry()
