const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro resolves browser-compatible builds for packages that ship
// both Node.js and browser entry points (e.g. axios v1.x).
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
