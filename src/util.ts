import { LoupedeckDisplayId } from '@loupedeck/node'

export const SideStripXPadding = 6 // Hidden space on either side of the side strip lcds
export const SideStripYPadding = 6 // Hidden space above and below the side strip lcds

export type StripId = 'left' | 'right'

/**
 * Build the synthetic control id for a single cell of a split lcd-segment strip.
 * eg `left-0`, `right-2`. These must not collide with the device's own control ids
 * (`button-0-2`, `encoder-0-0`, `wheel`, `left`, `right`).
 */
export function getStripCellControlId(stripId: StripId, cellIndex: number): string {
	return `${stripId}-${cellIndex}`
}

/**
 * Parse a synthetic strip cell control id back into its strip and cell index.
 * Returns null if the id is not a strip cell id.
 */
export function parseStripCellControlId(controlId: string): { stripId: StripId; cellIndex: number } | null {
	const match = /^(left|right)-(\d+)$/.exec(controlId)
	if (!match) return null
	return { stripId: match[1] as StripId, cellIndex: Number(match[2]) }
}

/**
 * Map a loupedeck display id to the corresponding strip id, or null if it is not a strip display.
 */
export function stripIdFromScreen(screen: LoupedeckDisplayId): StripId | null {
	if (screen === LoupedeckDisplayId.Left) return 'left'
	if (screen === LoupedeckDisplayId.Right) return 'right'
	return null
}
