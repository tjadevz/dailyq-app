const {
  withInfoPlist,
  withAppDelegate,
  withXcodeProject,
  withFinalizedMod,
  createRunOncePlugin,
} = require("expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");
const fs = require("fs");
const path = require("path");

const FACEBOOK_APP_ID = "1532476241627010";
const FACEBOOK_URL_SCHEME = `fb${FACEBOOK_APP_ID}`;
const FACEBOOK_SDK_REPO = "https://github.com/facebook/facebook-ios-sdk";
const FACEBOOK_SDK_REPO_NAME = "facebook-ios-sdk";
const FACEBOOK_SDK_MIN_VERSION = "17.0.0";
const FACEBOOK_CORE_PRODUCT = "FacebookCore";

function addFacebookCoreSwiftPackage(xcodeProject) {
  const objects = xcodeProject.hash.project.objects;

  const packageReferences = objects.XCRemoteSwiftPackageReference ?? {};
  for (const key of Object.keys(packageReferences)) {
    const ref = packageReferences[key];
    if (ref?.repositoryURL === FACEBOOK_SDK_REPO) {
      return xcodeProject;
    }
  }

  if (!objects.XCRemoteSwiftPackageReference) {
    objects.XCRemoteSwiftPackageReference = {};
  }
  if (!objects.XCSwiftPackageProductDependency) {
    objects.XCSwiftPackageProductDependency = {};
  }

  const packageReferenceUUID = xcodeProject.generateUuid();
  const packageProductUUID = xcodeProject.generateUuid();
  const buildFileUUID = xcodeProject.generateUuid();

  const packageRefKey = `${packageReferenceUUID} /* XCRemoteSwiftPackageReference "${FACEBOOK_SDK_REPO_NAME}" */`;
  objects.XCRemoteSwiftPackageReference[packageRefKey] = {
    isa: "XCRemoteSwiftPackageReference",
    repositoryURL: FACEBOOK_SDK_REPO,
    requirement: {
      kind: "upToNextMajorVersion",
      minimumVersion: FACEBOOK_SDK_MIN_VERSION,
    },
  };

  const productDepKey = `${packageProductUUID} /* ${FACEBOOK_CORE_PRODUCT} */`;
  objects.XCSwiftPackageProductDependency[productDepKey] = {
    isa: "XCSwiftPackageProductDependency",
    package: packageRefKey,
    productName: FACEBOOK_CORE_PRODUCT,
  };

  const projectSection = objects.PBXProject;
  const projectKey = Object.keys(projectSection).find(
    (key) => projectSection[key]?.isa === "PBXProject"
  );
  const project = projectSection[projectKey];
  if (!project.packageReferences) {
    project.packageReferences = [];
  }
  project.packageReferences.push(packageRefKey);

  const nativeTargetSection = objects.PBXNativeTarget;
  const targetKey = Object.keys(nativeTargetSection).find((key) => {
    const target = nativeTargetSection[key];
    return (
      target?.isa === "PBXNativeTarget" &&
      String(target.productType).includes("com.apple.product-type.application")
    );
  });
  const target = nativeTargetSection[targetKey];
  if (!target) {
    throw new Error("Could not find iOS application target for FacebookCore SPM linking.");
  }
  if (!target.packageProductDependencies) {
    target.packageProductDependencies = [];
  }
  target.packageProductDependencies.push(productDepKey);

  const buildFileKey = `${buildFileUUID} /* ${FACEBOOK_CORE_PRODUCT} in Frameworks */`;
  objects.PBXBuildFile[buildFileKey] = {
    isa: "PBXBuildFile",
    productRef: `${packageProductUUID} /* ${FACEBOOK_CORE_PRODUCT} */`,
  };

  const frameworksSection = objects.PBXFrameworksBuildPhase;
  const frameworksKey = Object.keys(frameworksSection).find(
    (key) => frameworksSection[key]?.isa === "PBXFrameworksBuildPhase"
  );
  const frameworks = frameworksSection[frameworksKey];
  if (!frameworks.files) {
    frameworks.files = [];
  }
  frameworks.files.push(buildFileKey);

  return xcodeProject;
}

function withFacebookInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.FacebookAppID = FACEBOOK_APP_ID;
    config.modResults.FacebookClientToken =
      config.modRawConfig.ios?.infoPlist?.FacebookClientToken ?? "";

    const urlTypes = config.modResults.CFBundleURLTypes ?? [];
    const hasFacebookScheme = urlTypes.some((entry) =>
      (entry.CFBundleURLSchemes ?? []).includes(FACEBOOK_URL_SCHEME)
    );

    if (!hasFacebookScheme) {
      if (urlTypes.length > 0) {
        const firstEntry = urlTypes[0];
        firstEntry.CFBundleURLSchemes = [
          ...(firstEntry.CFBundleURLSchemes ?? []),
          FACEBOOK_URL_SCHEME,
        ];
      } else {
        urlTypes.push({
          CFBundleURLSchemes: [FACEBOOK_URL_SCHEME],
        });
      }
      config.modResults.CFBundleURLTypes = urlTypes;
    }

    return config;
  });
}

function withFacebookAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes("import FacebookCore")) {
      const importResult = mergeContents({
        src: contents,
        newSrc: "import FacebookCore",
        tag: "facebook-core-import",
        anchor: /import ReactAppDependencyProvider/,
        offset: 1,
        comment: "//",
      });
      contents = importResult.contents;
    }

    const initResult = mergeContents({
      src: contents,
      newSrc: [
        "    ApplicationDelegate.shared.application(",
        "      application,",
        "      didFinishLaunchingWithOptions: launchOptions",
        "    )",
      ].join("\n"),
      tag: "facebook-core-init",
      anchor: /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
      offset: -1,
      comment: "//",
    });
    contents = initResult.contents;

    config.modResults.contents = contents;
    return config;
  });
}

function withFacebookCoreSwiftPackage(config) {
  return withXcodeProject(config, (config) => {
    config.modResults = addFacebookCoreSwiftPackage(config.modResults);
    return config;
  });
}

function withFacebookCorePbxprojFix(config) {
  return withFinalizedMod(config, [
    "ios",
    async (config) => {
      const pbxprojPath = path.join(
        config.modRequest.platformProjectRoot,
        `${config.modRequest.projectName}.xcodeproj/project.pbxproj`
      );
      let contents = await fs.promises.readFile(pbxprojPath, "utf8");
      const unquotedUrl =
        "repositoryURL = https://github.com/facebook/facebook-ios-sdk;";
      const quotedUrl =
        'repositoryURL = "https://github.com/facebook/facebook-ios-sdk";';

      if (contents.includes(unquotedUrl)) {
        contents = contents.replace(unquotedUrl, quotedUrl);
        await fs.promises.writeFile(pbxprojPath, contents);
      }

      return config;
    },
  ]);
}

function withFacebookCore(config) {
  config = withFacebookInfoPlist(config);
  config = withFacebookAppDelegate(config);
  config = withFacebookCoreSwiftPackage(config);
  config = withFacebookCorePbxprojFix(config);
  return config;
}

module.exports = createRunOncePlugin(
  withFacebookCore,
  "with-facebook-core",
  "1.0.0"
);
