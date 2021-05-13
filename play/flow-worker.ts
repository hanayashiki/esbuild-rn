// @ts-ignore
import * as babelCore from '@babel/core';


module.exports = async function (
    options: { path: string },
    callback: (err: Error | null, content: string) => void
) {


    let contents = babelCore.transformFileSync(options.path, {
        plugins: ['@babel/plugin-transform-flow-strip-types'],
    })



    callback(null, contents! && contents.code!);
};