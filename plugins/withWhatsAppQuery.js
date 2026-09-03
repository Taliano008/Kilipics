const { withAndroidManifest } = require("@expo/config-plugins");

// Android 11+ package visibility: without this, Linking.canOpenURL for the
// whatsapp:// scheme always returns false even when WhatsApp is installed,
// silently hiding the WhatsApp contact channel on real devices. A bare
// "queries" key under app.json's android object isn't a recognized Expo
// config field and does nothing — this has to inject the manifest element.
const PACKAGE_NAME = "com.whatsapp";

function addQueriesPackage(androidManifest, packageName) {
  if (!Array.isArray(androidManifest.manifest.queries)) {
    androidManifest.manifest.queries = [];
  }
  let queries = androidManifest.manifest.queries[0];
  if (!queries) {
    queries = {};
    androidManifest.manifest.queries.push(queries);
  }
  if (!Array.isArray(queries.package)) {
    queries.package = [];
  }
  const alreadyExists = queries.package.some((entry) => entry.$["android:name"] === packageName);
  if (!alreadyExists) {
    queries.package.push({ $: { "android:name": packageName } });
  }
  return androidManifest;
}

module.exports = function withWhatsAppQuery(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = addQueriesPackage(config.modResults, PACKAGE_NAME);
    return config;
  });
};
