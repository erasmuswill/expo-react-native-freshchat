const plugins = require("@expo/config-plugins");

module.exports = function withFreshChat(config) {
  const withStrings = plugins.withStringsXml(config, (config) => {
    // console.log("withStringsXml", JSON.stringify(config.modResults, null, 2));
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
};
