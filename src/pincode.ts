import type { SurfacePincodeMap } from '@companion-surface/base'
import { LoupedeckModelId } from '@loupedeck/node'

export function generatePincodeMap(model: LoupedeckModelId): SurfacePincodeMap | null {
	let fourCol = true
	let offset = 2
	if (model == LoupedeckModelId.RazerStreamControllerX) {
		offset = 0
		fourCol = false
	} else if (model === LoupedeckModelId.LoupedeckLiveS) {
		offset = 1
		fourCol = false
	}

	return {
		type: 'single-page',
		pincode: getControlIdFromXy(offset + 0, fourCol ? 0 : 1),
		0: fourCol ? getControlIdFromXy(offset + 0, 2) : getControlIdFromXy(offset + 4, 1),
		1: getControlIdFromXy(offset + 1, 2),
		2: getControlIdFromXy(offset + 2, 2),
		3: getControlIdFromXy(offset + 3, 2),
		4: getControlIdFromXy(offset + 1, 1),
		5: getControlIdFromXy(offset + 2, 1),
		6: getControlIdFromXy(offset + 3, 1),
		7: getControlIdFromXy(offset + 1, 0),
		8: getControlIdFromXy(offset + 2, 0),
		9: getControlIdFromXy(offset + 3, 0),
	}
}

function getControlIdFromXy(column: number, row: number): string {
	return `button-${row}-${column}`
}
