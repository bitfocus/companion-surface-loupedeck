import { assertNever, type HostCapabilities, type SurfaceSchemaLayoutDefinition } from '@companion-surface/base'
import type { LoupedeckDevice } from '@loupedeck/node'
import { getStripButtonControlId, type StripButtonLayout } from './strip-layout.js'
import { SideStripXPadding, SideStripYPadding } from './util.js'

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
			case 'lcd-segment': {
				const stripDisplay = control.id === 'right' ? device.displayRightStrip : device.displayLeftStrip

				if (capabilities.supportsNonSquareButtons && stripDisplay) {
					// Register both layouts at the same grid coordinates. Their different control ids let the
					// runtime select which bitmap size is drawn and which ids receive touch events.
					const nativeWidth = stripDisplay.width - SideStripXPadding * 2
					const nativeCellHeight = Math.floor((stripDisplay.height - SideStripYPadding * 2) / control.rowSpan)

					// The custom separated layout intentionally preserves the original 60 x 60
					// artwork and touch target used by the earlier split-strip implementation.
					const separatedWidth = stripDisplay.width
					const physicalCellHeight = Math.floor(stripDisplay.height / control.rowSpan)
					const separatedCellHeight = Math.min(separatedWidth, physicalCellHeight)

					const layouts: Array<{ layout: StripButtonLayout; width: number; height: number }> = [
						{ layout: 'native', width: nativeWidth, height: nativeCellHeight },
						{ layout: 'separated', width: separatedWidth, height: separatedCellHeight },
					]

					for (const { layout, width, height } of layouts) {
						const presetId = `strip_${layout}_${width}x${height}`
						if (!surfaceLayout.stylePresets[presetId]) {
							surfaceLayout.stylePresets[presetId] = {
								bitmap: {
									w: width,
									h: height,
									format: 'rgb',
								},
								// Also request the background colour for legacy fader/slider mode.
								colors: 'hex',
							}
						}

						for (let i = 0; i < control.rowSpan; i++) {
							surfaceLayout.controls[getStripButtonControlId(control.id, i, layout)] = {
								row: row + i,
								column,
								stylePreset: presetId,
							}
						}
					}
				} else {
					// Older host without non-square button support: single control, driven as a fader/slider.
					// Fetch rgb for the touch interaction.
					surfaceLayout.controls[control.id] = {
						row,
						column,
						stylePreset: 'button',
					}
				}
				break
			}
			default:
				assertNever(control)
				break
		}
	}

	return surfaceLayout
}
