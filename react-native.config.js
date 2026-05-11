// react-native.config.js
// Exclude react-native-reanimated from native Android auto-linking.
// Reanimated v4 is incompatible with React Native 0.73 at the native level.
// We use react-native-worklets-core directly for worklet execution instead.

module.exports = {
  dependencies: {
    'react-native-reanimated': {
      platforms: {
        android: null, // Disable native Android linking
      },
    },
  },
};
