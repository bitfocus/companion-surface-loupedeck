module.exports = {
	forceRemoveNodeGypFromPkg: true,
	// TODO: Ideally this would use prebuilds instead of externals, but that requires some mangling of the loading as it is looking in ../ for the prebuilds dir
	externals: {
		'@serialport/bindings-cpp': 'commonjs2 @serialport/bindings-cpp',
	},
	// prebuilds: ['@serialport/bindings-cpp'],
}
