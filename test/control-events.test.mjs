import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { LoupedeckModelId, LoupedeckVibratePattern } from '@loupedeck/node'
// eslint-disable-next-line n/no-unpublished-import
import { buildHapticFeedbackConfigFields, HapticFeedbackConfigId } from '../dist/config-fields.js'
// eslint-disable-next-line n/no-unpublished-import
import { LoupedeckWrapper } from '../dist/instance.js'
import { supportsHapticFeedback } from '../dist/main.js'

class FakeDeck extends EventEmitter {
	modelName = 'Test Loupedeck'
	controls = []
	vibrateCalls = []
	vibrateResult = undefined
	onBlank = undefined

	async blankDevice() {
		this.onBlank?.()
	}
	async close() {}
	async vibrate(pattern, options) {
		this.vibrateCalls.push({ pattern, options })
		await this.vibrateResult
	}
}

function createWrapper({ supportsHapticFeedback = true } = {}) {
	const deck = new FakeDeck()
	const context = {
		keyDownById() {},
		keyUpById() {},
		rotateLeftById() {},
		rotateRightById() {},
		disconnect() {},
	}
	const wrapper = new LoupedeckWrapper('test-surface', deck, context, false, false, supportsHapticFeedback)
	return { deck, wrapper }
}

test('allowlists motor-capable models and exposes the default-on setting without touch strips', () => {
	assert.equal(supportsHapticFeedback(LoupedeckModelId.LoupedeckCtV1), true)
	assert.equal(supportsHapticFeedback(LoupedeckModelId.LoupedeckCtV2), true)
	assert.equal(supportsHapticFeedback(LoupedeckModelId.LoupedeckLive), true)
	assert.equal(supportsHapticFeedback(LoupedeckModelId.LoupedeckLiveS), true)
	assert.equal(supportsHapticFeedback(LoupedeckModelId.RazerStreamController), true)
	assert.equal(supportsHapticFeedback(LoupedeckModelId.RazerStreamControllerX), false)
	const enabledField = buildHapticFeedbackConfigFields(true).find((field) => field.id === HapticFeedbackConfigId)
	assert.equal(enabledField?.default, true)
	assert.deepEqual(buildHapticFeedbackConfigFields(false), [])
})

function pulse(afterMs) {
	return {
		pattern: LoupedeckVibratePattern.SHARP_CLICK_MEDIUM,
		options: { bestEffort: true, interrupt: { afterMs, pattern: LoupedeckVibratePattern.SHARP_CLICK_LOW } },
	}
}

test('intensity selects the interrupt delay and unknown values fall back to medium', async () => {
	const { deck, wrapper } = createWrapper()
	await wrapper.ready()

	for (const intensity of ['light', 'medium', 'strong', 'toString', undefined, null, 3, {}]) {
		await wrapper.updateConfig({ hapticFeedbackIntensity: intensity })
		await wrapper.controlEvent('0/0', 'press')
	}
	assert.deepEqual(deck.vibrateCalls, [pulse(3), pulse(5), pulse(8), ...Array.from({ length: 5 }, () => pulse(5))])
})

test('uses an interrupted best-effort click only after ready and never from raw input', async () => {
	const { deck, wrapper } = createWrapper()

	await wrapper.controlEvent('0/0', 'press')
	deck.emit('down', { id: '0/0' })
	assert.equal(deck.vibrateCalls.length, 0)

	await wrapper.ready()
	await wrapper.controlEvent('0/0', 'press')
	assert.deepEqual(deck.vibrateCalls, [pulse(5)])
})

test('defaults missing haptic configuration to on and preserves explicit off', async () => {
	const { deck, wrapper } = createWrapper()
	await wrapper.ready()

	await wrapper.updateConfig({})
	await wrapper.controlEvent('0/0', 'press')
	assert.equal(deck.vibrateCalls.length, 1)

	await wrapper.updateConfig({ hapticFeedback: false })
	await wrapper.controlEvent('0/0', 'press')
	assert.equal(deck.vibrateCalls.length, 1)

	await wrapper.updateConfig({ hapticFeedback: true })
	await wrapper.controlEvent('0/0', 'press')
	assert.equal(deck.vibrateCalls.length, 2)
})

test('drops requests while a haptic submission is in flight and never replays them', async () => {
	const { deck, wrapper } = createWrapper()
	await wrapper.ready()
	let resolveVibrate
	deck.vibrateResult = new Promise((resolve) => {
		resolveVibrate = resolve
	})

	const first = wrapper.controlEvent('0/0', 'press')
	await wrapper.controlEvent('0/0', 'press')
	assert.equal(deck.vibrateCalls.length, 1)

	resolveVibrate()
	await first
	await wrapper.controlEvent('0/0', 'press')
	assert.equal(deck.vibrateCalls.length, 2)
})

test('contains device errors and rejects requests after close or on unsupported devices', async () => {
	const { deck, wrapper } = createWrapper()
	await wrapper.ready()
	deck.vibrateResult = Promise.reject(new Error('transport failed'))
	await assert.doesNotReject(wrapper.controlEvent('0/0', 'press'))
	assert.equal(deck.vibrateCalls.length, 1)

	await wrapper.close()
	await wrapper.controlEvent('0/0', 'press')
	assert.equal(deck.vibrateCalls.length, 1)

	const unsupported = createWrapper({ supportsHapticFeedback: false })
	await unsupported.wrapper.ready()
	await unsupported.wrapper.controlEvent('0/0', 'press')
	assert.equal(unsupported.deck.vibrateCalls.length, 0)
})

test('an error before or during init permanently disables haptics for that instance', async () => {
	const beforeInit = createWrapper()
	beforeInit.deck.emit('error', new Error('disconnected'))
	await beforeInit.wrapper.ready()
	await beforeInit.wrapper.controlEvent('0/0', 'press')
	assert.equal(beforeInit.deck.vibrateCalls.length, 0)

	const duringInit = createWrapper()
	duringInit.deck.onBlank = () => duringInit.deck.emit('error', new Error('disconnected'))
	await duringInit.wrapper.init()
	await duringInit.wrapper.ready()
	await duringInit.wrapper.controlEvent('0/0', 'press')
	assert.equal(duringInit.deck.vibrateCalls.length, 0)
})

test('press and hold on any control click, and unknown events are ignored', async () => {
	const { deck, wrapper } = createWrapper()
	await wrapper.ready()

	await wrapper.controlEvent('0/0', 'press')
	await wrapper.controlEvent('2/3', 'hold')
	await wrapper.controlEvent('0/0', 'flash')
	assert.equal(deck.vibrateCalls.length, 2)
	assert.deepEqual(deck.vibrateCalls[0], pulse(5))
})

test('a hold plays the same click cut later than a press, at every intensity', async () => {
	const { deck, wrapper } = createWrapper()
	await wrapper.ready()

	for (const intensity of ['light', 'medium', 'strong']) {
		await wrapper.updateConfig({ hapticFeedbackIntensity: intensity })
		deck.vibrateCalls = []
		await wrapper.controlEvent('0/0', 'press')
		await wrapper.controlEvent('0/0', 'hold')
		const [press, hold] = deck.vibrateCalls
		assert.equal(hold.pattern, press.pattern)
		assert.equal(hold.options.interrupt.pattern, press.options.interrupt.pattern)
		assert.ok(hold.options.interrupt.afterMs > press.options.interrupt.afterMs, intensity)
	}
})
