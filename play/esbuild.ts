import { build, Plugin } from 'esbuild';
// @ts-ignore
import flowRemoveTypes from '@mapbox/flow-remove-types';
import path from 'path';
import fs from 'fs';


(async () => {
    const defaultPlatforms = ['android', 'ios'];
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
            ? ['ios', 'android']
            : getFilePlatform(importer) === 'android'
                ? ['android', 'ios']
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
        name: 'example',
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
        name: 'flow',
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

    await build({
        entryPoints: ['index.js'],
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
    });
})();
