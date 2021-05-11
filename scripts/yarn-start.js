const Metro = require("metro");
const metroConfig = require('../metro.config.js');
const {
    createDevServerMiddleware,
    indexPageMiddleware,
} = require('@react-native-community/cli-server-api');

(async () => {
    const { middleware, attachToServer } = createDevServerMiddleware({
        host: 'localhost',
        port: 8081,
        watchFolders: metroConfig.watchFolders,
    });
    middleware.use(indexPageMiddleware);

    metroConfig.resetCache = true;

    const customEnhanceMiddleware = metroConfig.server.enhanceMiddleware;
    metroConfig.server.enhanceMiddleware = (
        metroMiddleware,
        server,
    ) => {
        if (customEnhanceMiddleware) {
            metroMiddleware = customEnhanceMiddleware(metroMiddleware, server);
        }
        return middleware.use(metroMiddleware);
    };

    const serverInstance = await Metro.runServer(metroConfig, {
        host: 'localhost',
        secure: false,
        secureCert: undefined,
        secureKey: undefined,
        hmrEnabled: true,
    });

    attachToServer(serverInstance);
})();