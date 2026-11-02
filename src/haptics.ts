import type { ModuleLogger, SomeCompanionInputField } from '@companion-surface/base'
import { LoupedeckDevice, LoupedeckVibratePattern } from '@loupedeck/node'

const PatternChoices = [
	{ id: 'none', label: 'None' },
	...Object.entries(LoupedeckVibratePattern)
		.filter(([name, value]) => typeof value === 'number' && name !== 'VERY_LONG')
		.map(([name]) => ({ id: name, label: name })),
]

export function buildHapticConfigFields(): SomeCompanionInputField[] {
	return [
		{
			id: 'hapticPressPattern',
			type: 'dropdown',
			label: 'Haptic on press',
			tooltip: 'Vibrate when a button, encoder or touch key is pressed',
			default: 'none',
			choices: PatternChoices,
		},
		{
			id: 'hapticHoldMs',
			type: 'number',
			label: 'Haptic on hold (ms)',
			tooltip: 'Vibrate again once a control has been held this long, eg to match a long press action. 0 to disable',
			default: 0,
			min: 0,
			max: 10000,
			isVisibleExpression: `$(options:hapticPressPattern) != 'none'`,
		},
	]
}

function parsePattern(id: unknown): LoupedeckVibratePattern | null {
	if (typeof id !== 'string' || id === 'none') return null
	const pattern = LoupedeckVibratePattern[id as keyof typeof LoupedeckVibratePattern]
	return typeof pattern === 'number' ? pattern : null
}

export class Haptics {
	readonly #deck: LoupedeckDevice
	readonly #logger: ModuleLogger
	readonly #holdTimers = new Map<string, NodeJS.Timeout>()

	#pressPattern: LoupedeckVibratePattern | null = null
	#holdMs = 0

	constructor(deck: LoupedeckDevice, logger: ModuleLogger) {
		this.#deck = deck
		this.#logger = logger
	}

	updateConfig(config: Record<string, any>): void {
		this.#pressPattern = parsePattern(config.hapticPressPattern)
		this.#holdMs = Number(config.hapticHoldMs) || 0
	}

	press(controlId: string): void {
		const pattern = this.#pressPattern
		if (pattern === null) return
		this.#vibrate(pattern)

		this.release(controlId)
		if (this.#holdMs > 0) {
			this.#holdTimers.set(
				controlId,
				setTimeout(() => {
					this.#holdTimers.delete(controlId)
					this.#vibrate(pattern)
				}, this.#holdMs),
			)
		}
	}

	release(controlId: string): void {
		clearTimeout(this.#holdTimers.get(controlId))
		this.#holdTimers.delete(controlId)
	}

	close(): void {
		for (const timer of this.#holdTimers.values()) clearTimeout(timer)
		this.#holdTimers.clear()
	}

	#vibrate(pattern: LoupedeckVibratePattern): void {
		this.#deck.vibrate(pattern).catch((e) => this.#logger.warn(`Vibrate failed: ${e}`))
	}
}
