import type PptxGenJS from 'pptxgenjs'
import type { ContractStatus } from '@/types/asset'
import { contractStatus } from '@/utils/colors'
import { dateToFraction } from './axis'
import type { DeckPlan, LocationSlidePlan } from './plan'
import { PPTX_STRINGS as S } from './strings'
import { FONT, SLIDE_H, SLIDE_W, statusColor, THEME } from './theme'

type Slide = ReturnType<PptxGenJS['addSlide']>

const OVERVIEW_ROWS = 14
const LABEL_X = 0.5
const LABEL_W = 3.6
const CHART_X = 4.3
const CHART_W = 8.5
const AXIS_Y = 1.15
const ROWS_Y = 1.5
const ROW_H = 0.34
const BAR_H = 0.22
const MAX_LABELLED_TICKS = 16

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const rect = (slide: Slide, x: number, y: number, w: number, h: number, color: string) =>
  slide.addShape('rect', { x, y, w, h, fill: { color }, line: { color, width: 0 } })

export function addTitleSlide(
  pptx: PptxGenJS,
  plan: DeckPlan,
  meta: { sourceName: string; generatedOn: Date },
): void {
  const slide = pptx.addSlide()
  rect(slide, 0, 0, SLIDE_W, SLIDE_H, THEME.navy)
  rect(slide, 0, 6.75, SLIDE_W, 0.18, THEME.gold)
  const text = (t: string, y: number, h: number, size: number, color: string, bold: boolean) =>
    slide.addText(t, {
      x: 0.7,
      y,
      w: 12,
      h,
      fontFace: FONT,
      fontSize: size,
      bold,
      color,
      valign: 'top',
      margin: 0,
    })
  text(S.eyebrow, 0.7, 0.45, 14, THEME.gold, true)
  text(S.deckTitle, 1.4, 1.0, 40, THEME.white, true)
  text(`${meta.sourceName} · ${ymd(meta.generatedOn)}`, 2.6, 0.5, 18, THEME.ice, false)

  const { totals } = plan
  const tiles = [
    [totals.locations, S.kpi.locations],
    [totals.assets, S.kpi.assets],
    [totals.underOneYear, S.kpi.underOneYear],
    [totals.expired, S.kpi.expired],
  ] as const
  const gap = 0.15
  const w = (12 - gap * (tiles.length - 1)) / tiles.length
  for (const [i, [value, label]] of tiles.entries()) {
    const x = 0.7 + i * (w + gap)
    slide.addShape('rect', {
      x,
      y: 4.9,
      w,
      h: 1.55,
      fill: { color: THEME.white, transparency: 90 },
      line: { color: THEME.ice, width: 0.75 },
    })
    slide.addText(String(value), {
      x,
      y: 5.0,
      w,
      h: 0.8,
      align: 'center',
      fontFace: FONT,
      fontSize: 36,
      bold: true,
      color: THEME.white,
      margin: 0,
    })
    slide.addText(label, {
      x,
      y: 5.85,
      w,
      h: 0.4,
      align: 'center',
      fontFace: FONT,
      fontSize: 12,
      color: THEME.ice,
      margin: 0,
    })
  }
}

function header(slide: Slide, title: string, subtitle?: string): void {
  rect(slide, 0, 0, SLIDE_W, 1.0, THEME.lightBg)
  slide.addText(title, {
    x: LABEL_X,
    y: 0.15,
    w: 12.3,
    h: 0.45,
    fontFace: FONT,
    fontSize: 24,
    bold: true,
    color: THEME.navy,
    margin: 0,
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: LABEL_X,
      y: 0.62,
      w: 12.3,
      h: 0.3,
      fontFace: FONT,
      fontSize: 12,
      color: THEME.grey,
      margin: 0,
    })
  }
}

export function addOverviewSlide(pptx: PptxGenJS, plan: DeckPlan): void {
  const cell = (text: string, o: object = {}) => ({
    text,
    options: { fontFace: FONT, fontSize: 12, color: THEME.darkText, ...o },
  })
  for (let start = 0; start < plan.overview.length; start += OVERVIEW_ROWS) {
    const slide = pptx.addSlide()
    header(slide, start === 0 ? S.overviewTitle : S.overviewContinued)
    const head = S.overviewHeaders.map((h, i) =>
      cell(h, {
        bold: true,
        color: THEME.white,
        fill: { color: THEME.navy },
        align: i === 0 ? 'left' : 'right',
      }),
    )
    const body = plan.overview.slice(start, start + OVERVIEW_ROWS).map((r, i) => {
      const o = { fill: { color: i % 2 ? THEME.lightBg : THEME.white }, align: 'right' as const }
      return [
        cell(r.location, { ...o, align: 'left' }),
        ...[r.ok, r.warning, r.critical, r.expired, r.total].map((n) => cell(String(n), o)),
      ]
    })
    slide.addTable([head, ...body], {
      x: 0.5,
      y: 1.3,
      w: 12.3,
      colW: [5.3, 1.4, 1.4, 1.4, 1.4, 1.4],
      rowH: 0.34,
    })
  }
}

export function addLocationSlide(
  pptx: PptxGenJS,
  plan: DeckPlan,
  loc: LocationSlidePlan,
  today: Date = new Date(),
): void {
  const slide = pptx.addSlide()
  const { axis } = plan
  header(slide, loc.title, loc.subtitle)
  const bottom = ROWS_Y + OVERVIEW_ROWS * ROW_H
  const lineH = bottom - AXIS_Y - 0.3
  const xAt = (f: number) => CHART_X + Math.min(Math.max(f, 0), 1) * CHART_W

  for (const [i, t] of axis.ticks.entries()) {
    const x = xAt(dateToFraction(t.date, axis))
    slide.addShape('line', {
      x,
      y: AXIS_Y + 0.3,
      w: 0,
      h: lineH,
      line: { color: THEME.ice, width: 0.5 },
    })
    if (axis.ticks.length <= MAX_LABELLED_TICKS || i % 2 === 0) {
      slide.addText(t.label, {
        x: x - 0.45,
        y: AXIS_Y,
        w: 0.9,
        h: 0.3,
        align: 'center',
        fontFace: FONT,
        fontSize: 9,
        color: THEME.grey,
        margin: 0,
      })
    }
  }

  for (const [i, row] of loc.rows.entries()) {
    const y = ROWS_Y + i * ROW_H
    const isGroup = row.kind === 'group'
    if (isGroup) rect(slide, LABEL_X, y, CHART_X + CHART_W - LABEL_X, ROW_H, THEME.lightBg)
    slide.addText(row.label, {
      x: LABEL_X + (isGroup ? 0.1 : 0.3),
      y,
      w: LABEL_W - (isGroup ? 0 : 0.2),
      h: ROW_H,
      fontFace: FONT,
      fontSize: isGroup ? 11 : 10,
      bold: isGroup,
      color: THEME.darkText,
      valign: 'middle',
      margin: 0,
    })
    if (row.kind === 'asset') {
      const a = row.asset
      const x0 = xAt(dateToFraction(a.installDate, axis))
      const x1 = xAt(dateToFraction(a.barEnd, axis))
      const color = statusColor(contractStatus(a.daysRemaining))
      rect(slide, x0, y + (ROW_H - BAR_H) / 2, Math.max(x1 - x0, 0.03), BAR_H, color)
    }
  }

  const tf = dateToFraction(today, axis)
  if (tf >= 0 && tf <= 1) {
    const x = xAt(tf)
    slide.addShape('line', {
      x,
      y: AXIS_Y + 0.3,
      w: 0,
      h: lineH,
      line: { color: THEME.gold, width: 1.5 },
    })
    slide.addText(S.today, {
      x: x - 0.4,
      y: bottom,
      w: 0.8,
      h: 0.25,
      align: 'center',
      fontFace: FONT,
      fontSize: 9,
      bold: true,
      color: THEME.gold,
      margin: 0,
    })
  }

  const statuses: ContractStatus[] = ['ok', 'warning', 'critical', 'expired']
  for (const [i, status] of statuses.entries()) {
    const x = CHART_X + i * 2.0
    rect(slide, x, 6.95, 0.18, 0.18, statusColor(status))
    slide.addText(S.legend[i] ?? status, {
      x: x + 0.26,
      y: 6.9,
      w: 1.6,
      h: 0.28,
      fontFace: FONT,
      fontSize: 10,
      color: THEME.darkText,
      valign: 'middle',
      margin: 0,
    })
  }
}
