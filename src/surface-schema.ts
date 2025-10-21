import { assertNever, type SurfaceSchemaLayoutDefinition } from '@companion-surface/base'
import type { LoupedeckDevice } from '@loupedeck/node'

export function createSurfaceSchema(device: LoupedeckDevice): SurfaceSchemaLayoutDefinition {
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
				// Not supported currently
				break
			default:
				assertNever(control)
				break
		}
	}

	return surfaceLayout
}
