import { build, Plugin } from 'esbuild';
// @ts-ignore
import path from 'path';
import express from 'express'
import workerFarm from 'worker-farm';
import fs from 'fs';

const flowWorkers = workerFarm(require.resolve('./flow-worker'));

const app = express()

app.get('/status', (req, res) => {
    res.send('packager-status:running');
});

const banner = `
var __BUNDLE_START_TIME__=this.nativePerformanceNow?nativePerformanceNow():Date.now(),__DEV__=true,process=this.process||{};process.env=process.env||{};process.env.NODE_ENV=process.env.NODE_ENV||"development";
var window = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this;
var global = window, require = function() {};
`;

const stdinContent = `
require('react-native/Libraries/polyfills/console.js');
require('react-native/Libraries/polyfills/error-guard.js');
require('react-native/Libraries/polyfills/Object.es7.js');
require('react-native/Libraries/Core/InitializeCore');
require('./index');
`;


if (!fs.existsSync('play/cache')) {
    fs.mkdirSync('play/cache');
}

let cache = new Map<string, string>();

if (fs.existsSync('play/cache/cache.json')) {
    cache = new Map<string, string>(JSON.parse(fs.readFileSync('play/cache/cache.json').toString()));
}

app.get('/index.bundle', async (req, res) => {
    const { platform } = req.query! as any;

    let flowTime = 0;

    const createFlowRemoveTypesPlugin = (regexp: RegExp): Plugin => ({
        name: 'createFlowRemoveTypesPlugin',
        setup(build) {
            build.onLoad({ filter: regexp }, async (args) => {
                const relpath = path.relative(process.cwd(), args.path);

                const cacheResult = cache.get(relpath);
                if (cacheResult) {
                    return {
                        contents: cacheResult,
                        loader: 'jsx',
                    };
                } 

                const contents: string = await new Promise((resolve, reject) => {
                    flowWorkers({
                        path: relpath,
                    },
                    (err: Error | null, content: string) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(content);
                        }
                    });
                });

                cache.set(relpath, contents);

                flowTime += Date.now() - t0;
                return {
                    contents,
                    loader: 'jsx',
                }
            })
        },
    });

    const t0 = Date.now();

    await build({
        stdin: {
            contents: stdinContent,
            resolveDir: '.',
            sourcefile: 'stdin.js',
            loader: 'js',
        },
        outdir: 'play/build',
        bundle: true,
        plugins: [
            createFlowRemoveTypesPlugin(/node_modules\/react-native\/.*\.jsx?$/g),
            // rnResolvePlugin,
        ],
        loader: {
            '.png': 'file',
            '.jpg': 'file',
        },
        banner: {
            'js': banner,
        },
        resolveExtensions: [
            `.${platform}.tsx`,
            `.${platform}.ts`,
            `.${platform}.jsx`,
            `.${platform}.js`,
            '.native.tsx',
            '.native.ts',
            '.native.jsx',
            '.native.js',
            '.tsx',
            '.ts',
            '.jsx',
            '.js',
        ],
    });

    res.setHeader('content-type', 'application/javascript');
    res.sendFile(path.join(__dirname, './build/stdin.js'));

    console.log(`Compiled using ${Date.now() - t0}ms`, `flow: ${flowTime}ms`);
    
    fs.writeFileSync('play/cache/cache.json', JSON.stringify([...cache.entries()]));
})

app.listen(8081, () => {
    console.info('Running...');
})
