import { svgToPng } from '../rasterize'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#0076ce"/><text x="6" y="24" font-family="Inter" font-size="14" fill="#fff">Hi</text></svg>'

describe('svgToPng', () => {
  it('renders a non-empty PNG at the requested zoom', async () => {
    const { data, width, height } = await svgToPng(SVG, 2)
    expect(data.byteLength).toBeGreaterThan(100)
    expect(width).toBe(240)
    expect(height).toBe(80)
    // PNG magic bytes
    expect(Array.from(data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 30000)
})
