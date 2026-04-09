module.exports = ({ config }) => ({
  ...config,
  owner: "octopus67",
  slug: "hypertrophy-os",
  extra: {
    ...config.extra,
    eas: {
      projectId: "1b9df205-27f5-4724-9981-c12d4a4b700b",
    },
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "626243275639-vh8mmvdbnp4ufgihga0bme2gd2j39ghp.apps.googleusercontent.com",
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "626243275639-sd7og2jmth1018gtj6eha858o262hf24.apps.googleusercontent.com",
  },
});
