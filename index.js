const plugins = require("@expo/config-plugins");
const {
  mergeContents,
} = require("@expo/config-plugins/build/utils/generateCode");
const fs = require("fs");
const path = require("path");
module.exports = function withFreshChat(config) {
  const withStrings = plugins.withStringsXml(config, (config) => {
    // console.log("withStringsXml", JSON.stringify(config.modResults, null, 2));
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
};
