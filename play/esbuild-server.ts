import { build, Plugin } from 'esbuild';
// @ts-ignore
import flowRemoveTypes from '@mapbox/flow-remove-types';
import path from 'path';
import fs from 'fs';
import express from 'express'

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

app.get('/index.bundle', async (req, res) => {

    const defaultPlatforms = req.query!.platform === 'ios' ? ['ios', 'android', 'native'] : ['android', 'ios', 'native'];
    const jsExtensions = ['js', 'ts', 'jsx', 'tsx'];
    
    const getFilePlatform = (name: string) => {
        if (/\.ios\.(j|t)sx?$/g.test(name)) {
            return 'ios';
        } else if (/\.android\.(j|t)sx?$/g.test(name)) {
            return 'android';
        }
    }
    
    const resolvePath = (p: string, importer: string) => {
        const platforms = getFilePlatform(importer) === 'ios'
            ? ['ios', 'android', 'native']
            : getFilePlatform(importer) === 'android'
                ? ['android', 'ios', 'native']
                : defaultPlatforms;
    
        for (const platform of platforms) {
            for (const extension of jsExtensions) {
                if (fs.existsSync(`${p}.${platform}.${extension}`)) {
                    return `${p}.${platform}.${extension}`;
                }
            }
        }
    }
    
    let rnResolvePlugin: Plugin = {
        name: 'rnResolvePlugin',
        setup(build) {
            // Redirect all paths starting with "images/" to "./public/images/"
            build.onResolve({ filter: /.*/g }, args => {
                const resolved = resolvePath(path.join(args.resolveDir, args.path), args.importer);
                if (resolved) {
                    return {
                        path: resolved,
                    };
                } else {
                    return {}
                }
            });
        },
    }
    
    const createFlowStripTypePlugin = (regexp: RegExp): Plugin => ({
        name: 'createFlowStripTypePlugin',
        setup(build) {
            build.onLoad({ filter: regexp }, async (args) => {
                const source = await fs.promises.readFile(args.path, 'utf8');
                let contents = flowRemoveTypes(source, { pretty: true, all: true }).toString();
    
                contents = contents.replace(/static\s+\+/g, 'static ');
    
                return {
                    contents,
                    loader: 'jsx',
                }
            })
        },
    });

    const result = await build({
        stdin: {
            contents: stdinContent,
            resolveDir: '.',
            sourcefile: 'stdin.js',
            loader: 'js',
        },
        outdir: 'play/build',
        bundle: true,
        plugins: [
            createFlowStripTypePlugin(/node_modules\/react-native.*\.jsx?$/g),
            rnResolvePlugin,
        ],
        loader: {
            '.png': 'file',
            '.jpg': 'file',
        },
        banner: {
            'js': banner,
        },
    });

    res.setHeader('content-type', 'application/javascript');
    res.sendFile(path.join(__dirname, './build/stdin.js'));
})

app.listen(8081, () => {
    console.info('Running...');
})
