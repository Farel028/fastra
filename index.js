const { AppRegistry } = require("react-native");
const {
  registerAndroidNotificationHeadlessTask,
} = require("./services/notificationImportService");

registerAndroidNotificationHeadlessTask(AppRegistry);

require("expo-router/entry");

