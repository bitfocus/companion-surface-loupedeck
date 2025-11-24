// @ts-check

// eslint-disable-next-line n/no-extraneous-import
import { DEVICE_MODELS } from '@loupedeck/core/internal'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
// eslint-disable-next-line n/no-unpublished-import
import prettier from 'prettier'

const manifestPath = path.join(import.meta.dirname, '../companion/manifest.json')

/** @type {Map<number, import('@companion-surface/base').SurfaceModuleManifestUsbIds>} */
const usbIdsMap = new Map()

for (const element of Object.values(DEVICE_MODELS)) {
	if (!element) continue

	const entry = usbIdsMap.get(element.vendorId)
	if (!entry) {
		usbIdsMap.set(element.vendorId, {
			vendorId: element.vendorId,
			productIds: [element.productId],
		})
	} else {
		entry.productIds.push(element.productId)
	}
}

/** @type {import('@companion-surface/base').SurfaceModuleManifest} */
const manifest = JSON.parse(await readFileSync(manifestPath, 'utf8'))

const manifestStr = JSON.stringify({
	...manifest,
	usbIds: Array.from(usbIdsMap.values()),
})

const prettierConfig = await prettier.resolveConfig(manifestPath)

const formatted = await prettier.format(manifestStr, {
	...prettierConfig,
	parser: 'json',
})

writeFileSync(manifestPath, formatted)
