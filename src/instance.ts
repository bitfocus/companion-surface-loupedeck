import {
	CardGenerator,
	HostCapabilities,
	SurfaceDrawProps,
	SurfaceContext,
	SurfaceInstance,
	parseColor,
	ModuleLogger,
	createModuleLogger,
} from '@companion-surface/base'
import { LoupedeckBufferFormat, LoupedeckDevice, LoupedeckDisplayId, RGBColor } from '@loupedeck/node'
import { getStripButtonControlId, parseStripButtonControlId, type StripButtonLayout } from './strip-layout.js'
import { SideStripXPadding, SideStripYPadding, stripIdFromScreen, type StripId } from './util.js'
import { ImageWriteQueue } from './write-queue.js'

interface DisplayFaderValue {
	color: RGBColor
	value: number
}

interface StripCellDrawItem {
	stripId: StripId
	cellIndex: number
	layout: StripButtonLayout
	image: Uint8Array
}

type StripDisplayId = LoupedeckDisplayId.Left | LoupedeckDisplayId.Right

type LcdStripMode = 'buttons' | 'slider' | 'none'

export class LoupedeckWrapper implements SurfaceInstance {
	readonly #logger: ModuleLogger
	readonly #deck: LoupedeckDevice
	readonly #surfaceId: string
	readonly #useTouchStrips: boolean
	readonly #supportsSplitButtons: boolean

	/** Configured strip mode. Only meaningful when #supportsSplitButtons is true */
	#configStripMode: 'buttons' | 'slider' = 'buttons'
	#separatedStripButtons = false
	/** Tracks the currently pressed strip cell control id per active touch id, to release the correct cell */
	#pressedStripCells = new Map<number, string>()
	/** Last image supplied for every native and separated strip control, used to redraw after layout changes */
	#stripCellImages = new Map<string, Uint8Array>()
	/** Coalescing queue for fader draws, keyed by strip display, so fast dragging can't fall behind */
	readonly #faderDrawQueue = new ImageWriteQueue<StripDisplayId, DisplayFaderValue>(
		async (display, values) => this.#drawFaderValue(display, values),
		(display, e) => this.#logger.error(`Drawing fader value to ${display} failed: ${e}`),
	)
	/** Coalescing queue for strip button cell draws, keyed by cell control id */
	readonly #stripDrawQueue = new ImageWriteQueue<string, StripCellDrawItem>(
		async (_key, item) => this.#drawStripCellButton(item),
		(key, e) => this.#logger.error(`Drawing strip cell ${key} failed: ${e}`),
	)

	#invertFaderValues = false
	#displayFaderValues = {
		[LoupedeckDisplayId.Left]: { color: { red: 0, green: 0, blue: 0 }, value: 0 } satisfies DisplayFaderValue,
		[LoupedeckDisplayId.Right]: { color: { red: 0, green: 0, blue: 0 }, value: 0 } satisfies DisplayFaderValue,
	}

	public get surfaceId(): string {
		return this.#surfaceId
	}
	public get productName(): string {
		return this.#deck.modelName
	}

	/** The strip behaviour actually in effect, taking host capabilities into account */
	get #effectiveStripMode(): LcdStripMode {
		if (!this.#useTouchStrips) return 'none'
		if (!this.#supportsSplitButtons) return 'slider'
		return this.#configStripMode
	}

	get #activeStripButtonLayout(): StripButtonLayout {
		return this.#separatedStripButtons ? 'separated' : 'native'
	}

	public constructor(
		surfaceId: string,
		deck: LoupedeckDevice,
		context: SurfaceContext,
		useTouchStrips: boolean,
		supportsSplitButtons: boolean,
	) {
		this.#logger = createModuleLogger(`Instance/${surfaceId}`)

		this.#deck = deck
		this.#surfaceId = surfaceId
		this.#useTouchStrips = useTouchStrips
		this.#supportsSplitButtons = supportsSplitButtons

		this.#deck.on('error', (e) => context.disconnect(e))

		this.#deck.on('down', (control) => {
			context.keyDownById(control.id)
		})
		this.#deck.on('up', (control) => {
			context.keyUpById(control.id)
		})
		this.#deck.on('rotate', (control, delta) => {
			if (delta < 0) {
				context.rotateLeftById(control.id)
			} else if (delta > 0) {
				context.rotateRightById(control.id)
			}
		})
		this.#deck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.control !== undefined && touch.target.screen === LoupedeckDisplayId.Center) {
					context.keyDownById(touch.target.control.id)
				} else if (touch.target.screen == LoupedeckDisplayId.Wheel) {
					const wheelControl = this.#deck.controls.find((c) => c.type === 'wheel')
					if (wheelControl) context.keyDownById(wheelControl.id)
				} else if (this.#effectiveStripMode === 'buttons') {
					const stripId = stripIdFromScreen(touch.target.screen)
					const controlId = stripId && this.#stripCellControlIdForTouch(stripId, touch.y)
					if (controlId) {
						this.#pressedStripCells.set(touch.id, controlId)
						context.keyDownById(controlId)
					}
				}
			}
		})
		this.#deck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.control !== undefined && touch.target.screen === LoupedeckDisplayId.Center) {
					context.keyUpById(touch.target.control.id)
				} else if (touch.target.screen == LoupedeckDisplayId.Wheel) {
					const wheelControl = this.#deck.controls.find((c) => c.type === 'wheel')
					if (wheelControl) context.keyUpById(wheelControl.id)
				} else {
					// Release whichever strip cell this touch pressed (if any), regardless of current mode
					const pressedId = this.#pressedStripCells.get(touch.id)
					if (pressedId !== undefined) {
						this.#pressedStripCells.delete(touch.id)
						context.keyUpById(pressedId)
					}
				}
			}
		})

		if (this.#useTouchStrips) {
			this.#deck.on('touchmove', (data) => {
				// The fader/slider only responds to touch movement in slider mode; in buttons mode the strip
				// touches are handled as button presses by touchstart/touchend instead.
				if (this.#effectiveStripMode !== 'slider') return

				const touch = data.changedTouches.find(
					(touch) => touch.target.screen == LoupedeckDisplayId.Right || touch.target.screen == LoupedeckDisplayId.Left,
				)
				if (touch && touch.target.screen == LoupedeckDisplayId.Right) {
					const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels

					context.sendVariableValue('rightFaderValueVariable', this.#invertFaderValues ? 256 - val : val)
					this.#displayFaderValues[LoupedeckDisplayId.Right].value = val

					this.#faderDrawQueue.queue(LoupedeckDisplayId.Right, this.#displayFaderValues[LoupedeckDisplayId.Right])
				} else if (touch && touch.target.screen == LoupedeckDisplayId.Left) {
					const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels

					context.sendVariableValue('leftFaderValueVariable', this.#invertFaderValues ? 256 - val : val)
					this.#displayFaderValues[LoupedeckDisplayId.Left].value = val

					this.#faderDrawQueue.queue(LoupedeckDisplayId.Left, this.#displayFaderValues[LoupedeckDisplayId.Left])
				}
			})
		}
	}

	async init(): Promise<void> {
		// Start with blanking it
		await this.blank()
	}
	async close(): Promise<void> {
		await this.#deck.blankDevice(true, true).catch(() => null)

		await this.#deck.close()
	}

	async updateConfig(config: Record<string, any>): Promise<void> {
		const prevEffectiveMode = this.#effectiveStripMode
		const prevSeparated = this.#separatedStripButtons

		this.#invertFaderValues = !!config.invertFaderValues
		this.#configStripMode = config.lcdStripMode === 'slider' ? 'slider' : 'buttons'

		this.#separatedStripButtons = !!config.separatedStripButtons

		const nextEffectiveMode = this.#effectiveStripMode

		if (nextEffectiveMode === 'slider') {
			this.#faderDrawQueue.queue(LoupedeckDisplayId.Left, this.#displayFaderValues[LoupedeckDisplayId.Left])

			this.#faderDrawQueue.queue(LoupedeckDisplayId.Right, this.#displayFaderValues[LoupedeckDisplayId.Right])
		} else if (
			nextEffectiveMode === 'buttons' &&
			(prevEffectiveMode === 'slider' || prevSeparated !== this.#separatedStripButtons)
		) {
			// Clear the old fader or button layout before repainting from the cached bitmap set.
			await this.#blankStrips()
			this.#redrawStripButtons()
		}
	}

	updateCapabilities(_capabilities: HostCapabilities): void {
		// Not used
	}

	async ready(): Promise<void> {}

	async setBrightness(percent: number): Promise<void> {
		await this.#deck.setBrightness(percent / 100)
	}
	async blank(): Promise<void> {
		await this.#deck.blankDevice(true, true)
	}
	async draw(_signal: AbortSignal, drawProps: SurfaceDrawProps): Promise<void> {
		// Split lcd-segment strip cells use synthetic control ids which are not present in device.controls.
		// Both native full-height and separated square controls are registered at the same grid coordinates.
		const stripCell = parseStripButtonControlId(drawProps.controlId)
		if (stripCell) {
			this.#drawStripCell(stripCell.stripId, stripCell.cellIndex, stripCell.layout, drawProps)
			return
		}

		const control = this.#deck.controls.find((c) => c.id === drawProps.controlId)
		if (!control) return

		if (control.type === 'button') {
			if (control.feedbackType === 'rgb') {
				const color = parseColor(drawProps.color)

				await this.#deck.setButtonColor({
					id: drawProps.controlId,
					red: color.r,
					green: color.g,
					blue: color.b,
				})
			} else if (control.feedbackType === 'lcd') {
				if (drawProps.image) {
					await this.#deck.drawKeyBuffer(drawProps.controlId, drawProps.image, LoupedeckBufferFormat.RGB)
				} else {
					throw new Error(`Cannot draw for Loupedeck without image`)
				}
			}
		} else if (control.type === 'wheel') {
			if (!this.#deck.displayWheel) return

			const width = this.#deck.displayWheel.width
			const height = this.#deck.displayWheel.height

			if (drawProps.image) {
				await this.#deck.drawBuffer(
					LoupedeckDisplayId.Wheel,
					drawProps.image,
					LoupedeckBufferFormat.RGB,
					width,
					height,
					0,
					0,
				)
			} else {
				throw new Error(`Cannot draw for Loupedeck without image`)
			}
		} else if (control.type === 'lcd-segment') {
			const color = parseColor(drawProps.color)

			const controlId = control.id
			switch (control.id) {
				case 'left':
					this.#displayFaderValues[LoupedeckDisplayId.Left].color = { red: color.r, green: color.g, blue: color.b }
					await this.#drawFaderValue(LoupedeckDisplayId.Left, this.#displayFaderValues[LoupedeckDisplayId.Left])
					break
				case 'right':
					this.#displayFaderValues[LoupedeckDisplayId.Right].color = { red: color.r, green: color.g, blue: color.b }
					await this.#drawFaderValue(LoupedeckDisplayId.Right, this.#displayFaderValues[LoupedeckDisplayId.Right])
					break
				default:
					this.#logger.warn(`Unknown lcd-segment control id: ${controlId}`)
					return
			}
		}
	}
	async showStatus(signal: AbortSignal, cardGenerator: CardGenerator): Promise<void> {
		const width = this.#deck.displayMain.width
		const height = this.#deck.displayMain.height

		const buffer = await cardGenerator.generateBasicCard(width, height, 'rgb')

		if (signal.aborted) return

		await this.#deck.drawBuffer(LoupedeckDisplayId.Center, buffer, LoupedeckBufferFormat.RGB, width, height, 0, 0)
	}

	/** Resolve the loupedeck display for a strip, or undefined if the model has no such strip */
	#stripDisplay(stripId: StripId): {
		display: LoupedeckDisplayId.Left | LoupedeckDisplayId.Right
		width: number
		height: number
		rowSpan: number
	} | null {
		const display = stripId === 'left' ? this.#deck.displayLeftStrip : this.#deck.displayRightStrip
		if (!display) return null

		const control = this.#deck.controls.find((c) => c.type === 'lcd-segment' && c.id === stripId)
		const rowSpan = control && control.type === 'lcd-segment' ? control.rowSpan : 3

		return {
			display: stripId === 'left' ? LoupedeckDisplayId.Left : LoupedeckDisplayId.Right,
			width: display.width,
			height: display.height,
			rowSpan,
		}
	}

	/** Map a touch Y coordinate on a strip to the active native or separated control id */
	#stripCellControlIdForTouch(stripId: StripId, y: number): string | null {
		const strip = this.#stripDisplay(stripId)
		if (!strip) return null

		const layout = this.#activeStripButtonLayout

		if (layout === 'native') {
			const clampedY = Math.max(0, Math.min(strip.height - 1, y))
			const cellIndex = Math.max(0, Math.min(strip.rowSpan - 1, Math.floor((clampedY / strip.height) * strip.rowSpan)))

			return getStripButtonControlId(stripId, cellIndex, layout)
		}

		const cellHeight = strip.height / strip.rowSpan
		const clampedY = Math.max(0, Math.min(strip.height - 1, y))
		const cellIndex = Math.max(0, Math.min(strip.rowSpan - 1, Math.floor(clampedY / cellHeight)))
		const activeHeight = Math.min(strip.width, cellHeight)
		const positionInsideCell = clampedY - cellIndex * cellHeight
		const margin = Math.floor((cellHeight - activeHeight) / 2)

		if (positionInsideCell < margin || positionInsideCell >= margin + activeHeight) {
			return null
		}

		return getStripButtonControlId(stripId, cellIndex, layout)
	}

	/** Cache and, when active, draw one native or separated strip control */
	#drawStripCell(stripId: StripId, cellIndex: number, layout: StripButtonLayout, drawProps: SurfaceDrawProps): void {
		const strip = this.#stripDisplay(stripId)
		if (!strip) return

		const controlId = getStripButtonControlId(stripId, cellIndex, layout)

		if (drawProps.image) {
			this.#stripCellImages.set(controlId, drawProps.image)
		}

		if (this.#effectiveStripMode === 'buttons' && layout === this.#activeStripButtonLayout) {
			const sourceImage = this.#stripCellImages.get(controlId)
			if (!sourceImage) return

			this.#stripDrawQueue.queue(controlId, {
				stripId,
				cellIndex,
				layout,
				image: sourceImage,
			})
		} else if (this.#effectiveStripMode === 'slider' && layout === 'native' && cellIndex === 0) {
			const color = parseColor(drawProps.color)

			this.#displayFaderValues[strip.display].color = {
				red: color.r,
				green: color.g,
				blue: color.b,
			}

			this.#faderDrawQueue.queue(strip.display, this.#displayFaderValues[strip.display])
		}
	}

	/** Draw a cached/provided bitmap to the active strip layout, ignoring stale queued draws */
	async #drawStripCellButton(item: StripCellDrawItem): Promise<void> {
		if (this.#effectiveStripMode !== 'buttons' || item.layout !== this.#activeStripButtonLayout) return

		const strip = this.#stripDisplay(item.stripId)
		if (!strip) return

		const nativeWidth = strip.width - SideStripXPadding * 2
		const nativeCellHeight = Math.floor((strip.height - SideStripYPadding * 2) / strip.rowSpan)
		const physicalCellHeight = Math.floor(strip.height / strip.rowSpan)

		const drawWidth = item.layout === 'native' ? nativeWidth : strip.width
		const drawHeight = item.layout === 'native' ? nativeCellHeight : Math.min(strip.width, physicalCellHeight)
		const drawX = item.layout === 'native' ? SideStripXPadding : 0
		const drawY =
			item.layout === 'native'
				? SideStripYPadding + item.cellIndex * nativeCellHeight
				: item.cellIndex * physicalCellHeight + Math.floor((physicalCellHeight - drawHeight) / 2)

		await this.#deck
			.drawBuffer(strip.display, item.image, LoupedeckBufferFormat.RGB, drawWidth, drawHeight, drawX, drawY)
			.catch((e) => {
				this.#logger.error(`Drawing strip cell ${item.stripId}-${item.cellIndex} to loupedeck failed: ${e}`)
			})
	}

	/** Repaint the selected strip layout from the bitmaps Companion last supplied */
	#redrawStripButtons(): void {
		const layout = this.#activeStripButtonLayout

		for (const stripId of ['left', 'right'] as const) {
			const strip = this.#stripDisplay(stripId)
			if (!strip) continue

			for (let cellIndex = 0; cellIndex < strip.rowSpan; cellIndex++) {
				const controlId = getStripButtonControlId(stripId, cellIndex, layout)
				const sourceImage = this.#stripCellImages.get(controlId)
				if (!sourceImage) continue

				this.#stripDrawQueue.queue(controlId, {
					stripId,
					cellIndex,
					layout,
					image: sourceImage,
				})
			}
		}
	}

	/** Blank both touch strip displays (used when switching out of fader/slider mode) */
	async #blankStrips(): Promise<void> {
		const black = { red: 0, green: 0, blue: 0 }
		for (const stripId of ['left', 'right'] as const) {
			const strip = this.#stripDisplay(stripId)
			if (!strip) continue
			await this.#deck.drawSolidColour(strip.display, black, strip.width, strip.height, 0, 0).catch(() => null)
		}
	}

	async #drawFaderValue(display: LoupedeckDisplayId, values: DisplayFaderValue): Promise<void> {
		if (!this.#useTouchStrips) return

		// TODO - this could be fetched from the device probably?
		const width = 60
		const height = 270
		const pad = 7

		try {
			const splitY = values.value + pad
			if (this.#invertFaderValues) {
				// Draw from bottom → up
				await this.#deck.drawSolidColour(display, { red: 0, green: 0, blue: 0 }, width, splitY, 0, 0)
				await this.#deck.drawSolidColour(display, values.color, width, height - splitY, 0, splitY)
			} else {
				// Draw from top → down
				await this.#deck.drawSolidColour(display, { red: 0, green: 0, blue: 0 }, width, height - splitY, 0, splitY)
				await this.#deck.drawSolidColour(display, values.color, width, splitY, 0, 0)
			}
		} catch (e) {
			this.#logger.error('Drawing fader value ' + values.value + ' to loupedeck failed: ' + e)
		}
	}
}
