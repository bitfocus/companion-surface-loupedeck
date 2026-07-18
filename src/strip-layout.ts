import { getStripCellControlId, parseStripCellControlId, type StripId } from './util.js'

export type StripButtonLayout = 'native' | 'separated'

export interface ParsedStripButtonControlId {
	stripId: StripId
	cellIndex: number
	layout: StripButtonLayout
}

export function getStripButtonControlId(stripId: StripId, cellIndex: number, layout: StripButtonLayout): string {
	if (layout === 'native') return getStripCellControlId(stripId, cellIndex)

	return `strip-${stripId}-separated-${cellIndex}`
}

export function parseStripButtonControlId(controlId: string): ParsedStripButtonControlId | null {
	const nativeControl = parseStripCellControlId(controlId)
	if (nativeControl) {
		return {
			...nativeControl,
			layout: 'native',
		}
	}

	const separatedMatch = /^strip-(left|right)-separated-(\d+)$/.exec(controlId)
	if (!separatedMatch) return null

	return {
		stripId: separatedMatch[1] as StripId,
		cellIndex: Number.parseInt(separatedMatch[2], 10),
		layout: 'separated',
	}
}
