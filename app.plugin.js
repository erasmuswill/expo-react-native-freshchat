const plugins = require("@expo/config-plugins");
const {
  mergeContents,
} = require("@expo/config-plugins/build/utils/generateCode");
const { readFileSync, writeFileSync } = require("node:fs");

// https://regex101.com/r/nHrTa9/1/
// if the above regex fails, we can use this one as a fallback:
const fallbackInvocationLineMatcher =
  /-\s*\(BOOL\)\s*application:\s*\(UIApplication\s*\*\s*\)\s*\w+\s+didFinishLaunchingWithOptions:/g;

function withAndroidFileProvider(config) {
  const withStrings = plugins.withStringsXml(config, (config) => {
    if (
      !config.modResults.resources.string.find(
        (v) =>
          v["$"] &&
          v["$"].name &&
          v["$"].name === "freshchat_file_provider_authority",
      )
    )
      config.modResults.resources.string.push({
        $: {
          name: "freshchat_file_provider_authority",
        },
        _: `${config.android.package}.provider`,
      });
    return config;
  });
  return plugins.withAndroidManifest(withStrings, (config) => {
    config.modResults.manifest.application[0].provider = {
      $: {
        "android:name": "androidx.core.content.FileProvider",
        "android:authorities": `${config.android.package}.provider`,
        "android:exported": "false",
        "android:grantUriPermissions": "true",
      },
      "meta-data": [
        {
          $: {
            "android:name": "android.support.FILE_PROVIDER_PATHS",
            "android:resource": "@xml/freshchat_file_provider_paths",
          },
        },
      ],
    };

    return config;
  });
}

function withiOSAppDelegateH(config) {
  return plugins.withAppDelegate(config, async (config) => {
    let path = config.modResults.path;
    if (path.includes("AppDelegate.mm"))
      path = path.replace("AppDelegate.mm", "AppDelegate.h");
    else path = path.replace("AppDelegate.m", "AppDelegate.h");

    let contents = readFileSync(path, "utf8");
    if (contents.includes("EXAppDelegateWrapper"))
      contents = contents.replaceAll(
        "EXAppDelegateWrapper",
        "EXAppDelegateWrapper<RCTBridgeDelegate, UNUserNotificationCenterDelegate>",
      );
    else
      plugins.WarningAggregator.addWarningIOS(
        "expo-react-native-freshchat",
        "Could not implement app delegate interface",
      );
    writeFileSync(path, contents);
    return config;
  });
}

function withiOSAppDelegateM(config) {
  return plugins.withAppDelegate(config, (config) => {
    let { contents } = config.modResults;
    contents =
      "#import <FreshchatSDK/FreshchatSDK.h>\n" +
      "#import <UserNotifications/UserNotifications.h>\n" +
      contents;
    const multilineMatcher = new RegExp(
      fallbackInvocationLineMatcher.source + ".+\\n*{",
    );
    const isHeaderMultiline = multilineMatcher.test(contents);

    const notificationCenterResult = mergeContents({
      tag: "expo-react-native-freshchat/app-didFinishLaunchingWithOptions",
      src: contents,
      newSrc:
        "UNUserNotificationCenter.currentNotificationCenter.delegate = self;",
      anchor: fallbackInvocationLineMatcher,
      // new line will be inserted right below matched anchor
      // or two lines, if the `{` is in the new line
      offset: isHeaderMultiline ? 2 : 1,
      comment: "//",
    });
    if (!notificationCenterResult.didMerge)
      plugins.WarningAggregator.addWarningIOS(
        "expo-react-native-freshchat",
        "Could not implement Notification Center",
      );
    else contents = notificationCenterResult.contents;

    const additionalMethodResult = mergeContents({
      tag: "expo-react-native-freshchat/app-notification-handling",
      src: contents,
      newSrc:
        "- (void)userNotificationCenter:(UNUserNotificationCenter *)center\n" +
        "       willPresentNotification:(UNNotification *)notification withCompletionHandler:(nonnull void (^)(UNNotificationPresentationOptions))completionHandler{\n" +
        "  \n" +
        "  if ([[Freshchat sharedInstance]isFreshchatNotification:notification.request.content.userInfo]) {\n" +
        "          [[Freshchat sharedInstance]handleRemoteNotification:notification.request.content.userInfo andAppstate:[[UIApplication sharedApplication] applicationState]];\n" +
        "         completionHandler( UNAuthorizationOptionSound );\n" +
        "      } else {\n" +
        "          completionHandler( UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge );\n" +
        "      }\n" +
        "}\n" +
        "\n" +
        "- (void)userNotificationCenter:(UNUserNotificationCenter *)center\n" +
        "didReceiveNotificationResponse:(UNNotificationResponse *)response\n" +
        "         withCompletionHandler:(void (^)(void))completionHandler {\n" +
        "    if ([[Freshchat sharedInstance]isFreshchatNotification:response.notification.request.content.userInfo]) {\n" +
        "        [[Freshchat sharedInstance]handleRemoteNotification:response.notification.request.content.userInfo andAppstate:[[UIApplication sharedApplication] applicationState]];\n" +
        "        completionHandler();\n" +
        "    } else {\n" +
        "        completionHandler();\n" +
        "    }\n" +
        "}",
      anchor: /@end/g,
      offset: 0, // new line will be inserted right above matched anchor
      comment: "//",
    });

    if (!additionalMethodResult.didMerge)
      plugins.WarningAggregator.addWarningIOS(
        "expo-react-native-freshchat",
        "Could not implement notification handlers",
      );
    else contents = additionalMethodResult.contents;

    config.modResults.contents = contents;
    return config;
  });
}

function withiOSNotifications(config) {
  return plugins.withPlugins(config, [
    withiOSAppDelegateH,
    withiOSAppDelegateM,
  ]);
}

module.exports = function withFreshChat(config) {
  return plugins.withPlugins(config, [
    withAndroidFileProvider,
    withiOSNotifications,
  ]);
};
