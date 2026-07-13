import { assertNever, type HostCapabilities, type SurfaceSchemaLayoutDefinition } from '@companion-surface/base'
import type { LoupedeckDevice } from '@loupedeck/node'
import { getStripCellControlId } from './util.js'

export function createSurfaceSchema(
	capabilities: HostCapabilities,
	device: LoupedeckDevice,
): SurfaceSchemaLayoutDefinition {
	const surfaceLayout: SurfaceSchemaLayoutDefinition = {
		stylePresets: {
			default: {
				bitmap: {
					w: device.lcdKeySize,
					h: device.lcdKeySize,
					format: 'rgb',
				},
			},
			button: {
				colors: 'hex',
			},
			empty: {},
		},
		controls: {},
	}

	for (const control of device.controls) {
		const { row, column } = control

		switch (control.type) {
			case 'button':
				surfaceLayout.controls[control.id] = {
					row,
					column,
					stylePreset: control.feedbackType === 'rgb' ? 'button' : 'default',
				}
				break
			case 'encoder':
				surfaceLayout.controls[control.id] = { row, column, stylePreset: 'empty' }
				break
			case 'wheel':
				if (device.displayWheel) {
					surfaceLayout.stylePresets.wheel = {
						bitmap: {
							w: device.displayWheel.width,
							h: device.displayWheel.height,
							format: 'rgb',
						},
					}
					surfaceLayout.controls[control.id] = { row, column, stylePreset: 'wheel' }
				}
				break
			case 'lcd-segment':
				if (capabilities.supportsNonSquareButtons) {
					// Register each strip as a column of non-square (drawable/pressable) button cells.
					// The runtime fader/slider mode reuses this same layout, routing the cells to a black hole.
					const cellWidth = device.displayLeftStrip?.width ?? 60
					const cellHeight = (device.displayLeftStrip?.height ?? 270) / control.rowSpan

					const presetId = `strip_${cellWidth}x${cellHeight}`
					if (!surfaceLayout.stylePresets[presetId]) {
						surfaceLayout.stylePresets[presetId] = {
							bitmap: {
								w: cellWidth,
								h: cellHeight,
								format: 'rgb',
							},
							// Also request the background colour, so fader/slider mode can tint the fill without
							// having to sample the button bitmap
							colors: 'hex',
						}
					}

					for (let i = 0; i < control.rowSpan; i++) {
						surfaceLayout.controls[getStripCellControlId(control.id, i)] = {
							row: row + i,
							column,
							stylePreset: presetId,
						}
					}
				} else {
					// Older host without non-square button support: single control, driven as a fader/slider.
					// Fetch rgb for the touch interaction
					surfaceLayout.controls[control.id] = {
						row,
						column,
						stylePreset: 'button',
					}
				}
				break
			default:
				assertNever(control)
				break
		}
	}

	return surfaceLayout
}
