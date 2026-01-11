import type { DetectionSurfaceInfo, OpenSurfaceResult, SurfaceContext, SurfacePlugin } from '@companion-surface/base'
import { getModelName, listLoupedecks, LoupedeckDeviceInfo, LoupedeckModelId, openLoupedeck } from '@loupedeck/node'
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

	scanForSurfaces: async (): Promise<DetectionSurfaceInfo<LoupedeckDeviceInfo>[]> => {
		const surfaceInfos = await listLoupedecks()

		const result: DetectionSurfaceInfo<LoupedeckDeviceInfo>[] = []
		for (const surfaceInfo of surfaceInfos) {
			if (!surfaceInfo.serialNumber) continue

			result.push({
				deviceHandle: surfaceInfo.path,
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

		const useTouchStrips =
			pluginInfo.model === LoupedeckModelId.LoupedeckCtV1 ||
			pluginInfo.model === LoupedeckModelId.LoupedeckCtV2 ||
			pluginInfo.model === LoupedeckModelId.LoupedeckLive ||
			pluginInfo.model === LoupedeckModelId.RazerStreamController

		return {
			surface: new LoupedeckWrapper(surfaceId, loupedeck, context, useTouchStrips),
			registerProps: {
				brightness: true,
				surfaceLayout: createSurfaceSchema(loupedeck),
				pincodeMap: generatePincodeMap(loupedeck.modelId),
				configFields: useTouchStrips
					? [
							{
								id: 'invertFaderValues',
								type: 'checkbox',
								default: false,
								label: 'Invert Fader Values',
								tooltip: 'If set, the fader values will be inverted, with the value being between 256 and 0.',
							},
						]
					: null,
				transferVariables: useTouchStrips
					? [
							{
								id: 'leftFaderValueVariable',
								type: 'input',
								name: 'Variable to store Left Fader value to',
								description:
									'This will be a value between 0 and 256 representing the position of the last touch on the left strip.',
							},
							{
								id: 'rightFaderValueVariable',
								type: 'input',
								name: 'Variable to store Right Fader value to',
								description:
									'This will be a value between 0 and 256 representing the position of the last touch on the right strip.',
							},
						]
					: undefined,
				location: null,
			},
		}
	},
}
export default StreamDeckPlugin
