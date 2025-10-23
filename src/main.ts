import type { DiscoveredSurfaceInfo, OpenSurfaceResult, SurfaceContext, SurfacePlugin } from '@companion-surface/base'
import { getModelName, listLoupedecks, LoupedeckDeviceInfo, openLoupedeck } from '@loupedeck/node'
import { generatePincodeMap } from './pincode.js'
import { LoupedeckWrapper } from './instance.js'
import { createSurfaceSchema } from './surface-schema.js'

const StreamDeckPlugin: SurfacePlugin<LoupedeckDeviceInfo> = {
	init: async (): Promise<void> => {
		// Nothing to do
	},
	destroy: async (): Promise<void> => {
		// Nothing to do
	},

	scanForSurfaces: async (): Promise<DiscoveredSurfaceInfo<LoupedeckDeviceInfo>[]> => {
		const surfaceInfos = await listLoupedecks()

		const result: DiscoveredSurfaceInfo<LoupedeckDeviceInfo>[] = []
		for (const surfaceInfo of surfaceInfos) {
			if (!surfaceInfo.serialNumber) continue

			result.push({
				surfaceId: `loupedeck:${surfaceInfo.serialNumber}`,
				description: getModelName(surfaceInfo.model),
				pluginInfo: surfaceInfo,
			})
		}

		return result
	},

	openSurface: async (
		surfaceId: string,
		pluginInfo: LoupedeckDeviceInfo,
		context: SurfaceContext,
	): Promise<OpenSurfaceResult> => {
		const loupedeck = await openLoupedeck(pluginInfo.path)

		return {
			surface: new LoupedeckWrapper(surfaceId, loupedeck, context),
			registerProps: {
				brightness: true,
				surfaceLayout: createSurfaceSchema(loupedeck),
				pincodeMap: generatePincodeMap(loupedeck.modelId),
			},
		}
	},
}
export default StreamDeckPlugin
