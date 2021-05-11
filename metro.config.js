// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

console.log(config.serializer.getRunModuleStatement())

module.exports = config;
