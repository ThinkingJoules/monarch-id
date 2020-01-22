import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import autoExternal from 'rollup-plugin-auto-external';
import globals from 'rollup-plugin-node-globals';
import builtins from 'rollup-plugin-node-builtins';
import hypothetical from 'rollup-plugin-hypothetical';


import pkg from './package.json';

export default [
	// browser-friendly UMD build
	{
		input: 'src/browser/entry.js',
		output: {
			name: 'Monarch',
			file: pkg.browser,
			format: 'umd',
			sourceMap: 'inline',
			globals : {
				ws: 'WebSockets',
				crypto: 'crypto',
				atob:'atob',
				btoa:'btoa'
			}
		},
		external:['ws','crypto'],
		plugins: [
			hypothetical({
				allowRealFiles: true,
				files: {
				'./src/node/mutil.js': `
					export default {}
				`
				},
				allowFallthrough:true
			}),
			resolve({preferBuiltins: true}), 
			commonjs(),
			builtins({crypto:false}),
			globals(),
		],
		
	},
	
	// CommonJS (for Node) and ES module (for bundlers) build.
	{
        input: 'src/node/entry.js',
		plugins:[
			autoExternal(),
			hypothetical({
				allowRealFiles: true,
				files: {
				'./src/browser/mutil.js': `
					export default {}
				`
				},
				allowFallthrough:true
			})
		],
		external:['crypto'],
		output: [
			{ 
				file: pkg.main, 
				format: 'cjs'
			},
			{ 
				file: pkg.module, 
				format: 'es'
		 	}
		]
	}
];