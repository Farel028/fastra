const { withAndroidManifest } = require("expo/config-plugins");

const BOOT_RECEIVER =
  "com.lesimoes.androidnotificationlistener.BootUpReceiver";

module.exports = function withAndroidNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const applications = manifest.application ?? [];
    const mainApplication = applications[0];

    if (!mainApplication) {
      return config;
    }

    const receivers = mainApplication.receiver ?? [];
    const filteredReceivers = receivers.filter((receiver) => {
      const name = receiver?.$?.["android:name"];
      return name !== BOOT_RECEIVER;
    });

    filteredReceivers.push({
      $: {
        "android:name": BOOT_RECEIVER,
        "tools:node": "remove",
      },
    });

    mainApplication.receiver = filteredReceivers;
    manifest.application = applications;

    return config;
  });
};

