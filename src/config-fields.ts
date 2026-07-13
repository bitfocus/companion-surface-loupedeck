import type { SomeCompanionInputField } from '@companion-surface/base'

/**
 * Build the per-surface config fields for models with touch strips.
 *
 * The left/right strips can either behave as 3 stacked buttons ("split buttons", only when the host
 * supports non-square buttons) or as a legacy touch fader/slider. The layout is fixed when the surface
 * is registered, so when split buttons are supported the button cells are always registered and the
 * fader mode simply routes them to a black hole at runtime. The fader value variables and invert option
 * therefore always exist regardless of mode - the static-text explains when each field actually applies.
 */
export function buildTouchStripConfigFields(supportsSplitButtons: boolean): SomeCompanionInputField[] {
	const fields: SomeCompanionInputField[] = []

	if (supportsSplitButtons) {
		fields.push(
			{
				id: 'lcdStripInfo',
				type: 'static-text',
				label: 'LCD strips',
				value:
					'The left and right LCD strips can be used either as 3 stacked buttons, or as a legacy touch fader/slider. ' +
					'Choose the behaviour below. In "Split buttons" mode the 3 button slots for each strip can be drawn to and ' +
					'pressed, and the fader value variables/invert option below do nothing. In "Fader / slider" mode the strip ' +
					'acts as a single touch fader, the 3 button slots do nothing, and the fader value variables and invert ' +
					'option below apply.',
			},
			{
				id: 'lcdStripMode',
				type: 'dropdown',
				label: 'LCD strip mode',
				default: 'buttons',
				choices: [
					{ id: 'buttons', label: 'Split buttons' },
					{ id: 'slider', label: 'Fader / slider (legacy)' },
				],
			},
		)
	} else {
		fields.push({
			id: 'lcdStripInfo',
			type: 'static-text',
			label: 'LCD strips',
			value:
				'The left and right LCD strips act as touch faders/sliders on this version of Companion. Touching a strip ' +
				'sends its position to the fader value variables below. Upgrade Companion (to a version that supports ' +
				'non-square buttons) to instead use each strip as 3 stacked buttons. The invert option below applies to the ' +
				'fader values.',
		})
	}

	fields.push({
		id: 'invertFaderValues',
		type: 'checkbox',
		default: false,
		label: 'Invert Fader Values',
		tooltip: 'If set, the fader values will be inverted, with the value being between 256 and 0.',
		// On capable hosts this only applies in fader/slider mode
		isVisibleExpression: supportsSplitButtons ? `$(options:lcdStripMode) == 'slider'` : undefined,
	})

	return fields
}
