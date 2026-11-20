import PptxGenJS from 'pptxgenjs'
import type { LocationGroup } from '@/types/asset'
import { planDeck } from './plan'
import { addLocationSlide, addOverviewSlide, addTitleSlide } from './slides'
import { PPTX_STRINGS } from './strings'

export interface BuildPptxInput {
  groups: LocationGroup[]
  sourceName: string
  generatedOn?: Date
}

export async function buildPptx({
  groups,
  sourceName,
  generatedOn = new Date(),
}: BuildPptxInput): Promise<ArrayBuffer> {
  const plan = planDeck(groups)
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = PPTX_STRINGS.deckTitle
  addTitleSlide(pptx, plan, { sourceName, generatedOn })
  addOverviewSlide(pptx, plan)
  for (const s of plan.slides) addLocationSlide(pptx, plan, s, generatedOn)
  return (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
}
