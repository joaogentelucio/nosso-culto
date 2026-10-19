const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
module.exports = mergeConfig(getDefaultConfig(__dirname), {});
// A inicialização oficial RNW pode atualizar este arquivo para suporte ao Windows.
