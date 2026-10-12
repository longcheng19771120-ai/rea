import type { Logger } from "pino";
import { Cli } from "incur";

import { snapshotEnvironment } from "./process/snapshotEnvironment.js";
import type { DirectAnalysis } from "./composition/directAnalysis.js";
import { createLogger, parseLogLevel } from "./logger.js";
import { PRODUCT_IDENTITY } from "./identity.js";
import { npxRegistrationCommand } from "./application/ClientRegistrationIdentity.js";
import { presentOmittableDefaults } from "./cli/omittableDefaults.js";
import type { CliInstance } from "./cli/types.js";
import {
  streamCliCommandResults,
  type CliResultOutput,
} from "./cli/streamedJsonOutput.js";

type Environment = Readonly<Record<string, string | undefined>>;

type RegisterCommands = (
  cli: CliInstance,
  logger: Logger,
  environment: Environment,
) => void;

/** One registrar and the exact command names it adds. */
export interface CliCommandGroup {
  readonly commands: readonly string[];
  readonly load: (
    loadAnalysis: () => Promise<DirectAnalysis>,
  ) => Promise<RegisterCommands>;
}

/**
 * Registrars in help order. Each owns its module graph, so a one-shot
 * invocation of a known command imports only the registrar that adds it.
 * `cliCommandGroups.test.ts` keeps every command list exact.
 */
export const CLI_COMMAND_GROUPS: readonly CliCommandGroup[] = [
  {
    commands: ["setup", "doctor", "uninstall", "update"],
    load: async () => {
      const { registerSetupCommands } = await import("./cli/setupCommands.js");
      return (cli, logger, environment) =>
        registerSetupCommands(cli, logger, environment);
    },
  },
  {
    commands: [
      "analyze",
      "inspect",
      "decompile",
      "function",
      "instructions",
      "search",
      "xrefs",
      "trace",
      "annotate-native-function",
      "inspect-native-load-image",
      "read-bytes",
      "address-to-file-offset",
      "trace-native-values",
      "inspect-native-data-type",
      "inspect-native-instruction",
      "resolve-native-call-targets",
      "inspect-native-api",
      "trace-native-ui-action",
      "inspect-native-dispatch-metadata",
    ],
    load: async (loadAnalysis) => {
      const [{ registerCoreAnalysisCommands }, analysis] = await Promise.all([
        import("./cli/coreAnalysisCommands.js"),
        loadAnalysis(),
      ]);
      return (cli, logger) =>
        registerCoreAnalysisCommands(cli, logger, analysis.runDirectAnalysis);
    },
  },
  {
    commands: [
      "capabilities",
      "providers",
      "inspect-macho",
      "inspect-signature",
      "list-architectures",
      "inspect-plist",
      "demangle-swift",
      "observe-native-calls",
      "observe-native-ui",
      "capture-native-ui-scenario",
      "import-reference-source",
    ],
    load: async (loadAnalysis) => {
      const [{ registerUtilityCommands }, analysis] = await Promise.all([
        import("./cli/utilityCommands.js"),
        loadAnalysis(),
      ]);
      return (cli, logger, environment) =>
        registerUtilityCommands(cli, logger, environment, analysis);
    },
  },
  {
    commands: ["inspect-wasm-artifact"],
    load: async () => {
      const { registerWasmCommands } = await import("./cli/wasmCommands.js");
      return (cli, logger, environment) =>
        registerWasmCommands(cli, logger, environment);
    },
  },
  {
    commands: ["inspect-evm-interface"],
    load: async () => {
      const { registerEvmCommands } = await import("./cli/evmCommands.js");
      return (cli, logger, environment) =>
        registerEvmCommands(cli, logger, environment);
    },
  },
  {
    commands: [
      "inspect-artifact",
      "extract-artifact",
      "decode-interface-builder",
      "inspect-asset-catalog",
      "trace-dylib-resolution",
      "inspect-keyed-archive",
    ],
    load: async (loadAnalysis) => {
      const [{ registerArtifactCommands }, analysis] = await Promise.all([
        import("./cli/artifactCommands.js"),
        loadAnalysis(),
      ]);
      return (cli, logger) =>
        registerArtifactCommands(cli, logger, analysis.runProviderAnalysis);
    },
  },
  {
    commands: [
      "inspect-managed-artifact",
      "inspect-managed-members",
      "inspect-managed-native-boundaries",
      "compare-managed-members",
      "import-managed-reconstruction",
      "verify-managed-native-boundaries",
      "project-managed-application-graph",
    ],
    load: async (loadAnalysis) => {
      const [{ registerManagedCommands }, analysis] = await Promise.all([
        import("./cli/managedCommands.js"),
        loadAnalysis(),
      ]);
      return (cli, logger) =>
        registerManagedCommands(cli, logger, analysis.runProviderAnalysis);
    },
  },
  {
    commands: [
      "inspect-android-package",
      "search-android-classes",
      "inspect-android-class",
      "inspect-android-method",
      "trace-android-references",
    ],
    load: async () => {
      const { registerAndroidCommands } =
        await import("./cli/androidCommands.js");
      return (cli, logger, environment) =>
        registerAndroidCommands(cli, logger, environment);
    },
  },
  {
    commands: ["inspect-apktool-client", "decode-android-resources"],
    load: async () => {
      const { registerApktoolCommands } =
        await import("./cli/apktoolCommands.js");
      return (cli, logger, environment) =>
        registerApktoolCommands(cli, logger, environment);
    },
  },
  {
    commands: [
      "inspect-jeb-client",
      "open-jeb-project",
      "list-jeb-units",
      "decompile-jeb-item",
    ],
    load: async () => {
      const { registerJebCommands } = await import("./cli/jebCommands.js");
      return (cli, logger, environment) =>
        registerJebCommands(cli, logger, environment);
    },
  },
  {
    commands: [
      "inspect-adb-client",
      "list-adb-devices",
      "inspect-adb-device",
      "list-adb-packages",
      "pull-adb-package",
      "read-adb-logcat",
      "inspect-adb-package",
      "pull-adb-file",
      "push-adb-file",
      "capture-adb-screen",
      "list-adb-processes",
      "list-adb-directory",
      "list-adb-features",
      "list-adb-services",
      "inspect-adb-display",
      "inspect-adb-window",
      "read-adb-setting",
      "collect-adb-bugreport",
      "resolve-adb-packages",
      "install-adb-package",
      "uninstall-adb-package",
      "start-adb-app",
      "start-adb-activity",
      "stop-adb-app",
    ],
    load: async () => {
      const { registerAdbCommands } = await import("./cli/adbCommands.js");
      return (cli, logger, environment) =>
        registerAdbCommands(cli, logger, environment);
    },
  },
  {
    commands: ["inspect-firmware-regions", "extract-firmware"],
    load: async () => {
      const { registerFirmwareCommands } =
        await import("./cli/firmwareCommands.js");
      return (cli, logger, environment) =>
        registerFirmwareCommands(cli, logger, environment);
    },
  },
  {
    commands: [
      "inspect-pe-resources",
      "inspect-binary-layout",
      "inspect-recorded-crash",
    ],
    load: async () => {
      const { registerBinaryDiagnosticsCommands } =
        await import("./cli/binaryDiagnosticsCommands.js");
      return (cli, logger, environment) =>
        registerBinaryDiagnosticsCommands(cli, logger, environment);
    },
  },
  {
    commands: ["inspect-evidence-bundle", "inspect-analysis-view"],
    load: async () => {
      const { registerAnalysisViewCommands } =
        await import("./cli/analysisViewCommands.js");
      return (cli, logger) => registerAnalysisViewCommands(cli, logger);
    },
  },
  {
    commands: ["evidence-import", "evidence-export", "compare"],
    load: async () => {
      const { registerEvidenceCommands } =
        await import("./cliEvidenceCommands.js");
      return (cli, logger) => registerEvidenceCommands(cli, logger);
    },
  },
  {
    commands: ["capture-process", "compare-process-captures"],
    load: async () => {
      const { registerProcessCommands } =
        await import("./cli/processCommands.js");
      return (cli, logger, environment) =>
        registerProcessCommands(cli, logger, environment);
    },
  },
  {
    commands: [
      "list-browser-targets",
      "inspect-web-page",
      "analyze-web-bundle",
      "observe-web-session",
    ],
    load: async () => {
      const { registerBrowserCommands } =
        await import("./cli/browserCommands.js");
      return (cli, logger) => registerBrowserCommands(cli, logger);
    },
  },
  {
    commands: ["export-web-scripts"],
    load: async () => {
      const { registerWebScriptCommands } =
        await import("./cli/webScriptCommands.js");
      return (cli, logger) => registerWebScriptCommands(cli, logger);
    },
  },
  {
    commands: ["trace-web-module-imports"],
    load: async () => {
      const { registerWebModuleCommands } =
        await import("./cli/webModuleCommands.js");
      return (cli, logger, environment) =>
        registerWebModuleCommands(cli, logger, environment);
    },
  },
  {
    commands: ["trace-web-source-location"],
    load: async () => {
      const { registerWebSourceLocationCommands } =
        await import("./cli/webSourceLocationCommands.js");
      return (cli, logger, environment) =>
        registerWebSourceLocationCommands(cli, logger, environment);
    },
  },
  {
    commands: ["observe-web-execution", "inspect-web-event-listeners"],
    load: async () => {
      const { registerWebRuntimeCommands } =
        await import("./cli/webRuntimeCommands.js");
      return (cli, logger) => registerWebRuntimeCommands(cli, logger);
    },
  },
  {
    commands: ["inspect-web-network-capture"],
    load: async () => {
      const { registerWebNetworkCaptureCommands } =
        await import("./cli/webNetworkCaptureCommands.js");
      return (cli, logger, environment) =>
        registerWebNetworkCaptureCommands(cli, logger, environment);
    },
  },
  {
    commands: ["recover-javascript-sources"],
    load: async () => {
      const { registerJavaScriptRecoveryCommands } =
        await import("./cli/javascriptRecoveryCommands.js");
      return (cli, logger, environment) =>
        registerJavaScriptRecoveryCommands(cli, logger, environment);
    },
  },
  {
    commands: [
      "discover-webmcp-tools",
      "compare-web-captures",
      "capture-web-screenshot",
      "compare-web-screenshots",
    ],
    load: async () => {
      const { registerAdvancedBrowserCommands } =
        await import("./cli/browserAdvancedCommands.js");
      return (cli, logger) => registerAdvancedBrowserCommands(cli, logger);
    },
  },
  {
    commands: ["capture-browser-scenario"],
    load: async () => {
      const { registerBrowserScenarioCommands } =
        await import("./cliBrowserScenarioCommands.js");
      return (cli, logger, environment) =>
        registerBrowserScenarioCommands(cli, logger, environment);
    },
  },
  {
    commands: [
      "list-electron-targets",
      "inspect-electron-page",
      "capture-electron-scenario",
      "analyze-javascript-application",
      "reconcile-javascript-runtime",
    ],
    load: async () => {
      const { registerElectronCommands } =
        await import("./cli/electronCommands.js");
      return (cli, logger, environment) =>
        registerElectronCommands(cli, logger, environment);
    },
  },
  {
    commands: ["list-javascript-runtime-targets", "observe-javascript-runtime"],
    load: async () => {
      const { registerJavaScriptRuntimeObservationCommands } =
        await import("./cliJavaScriptRuntimeCommands.js");
      return (cli, logger) =>
        registerJavaScriptRuntimeObservationCommands(cli, logger);
    },
  },
  {
    commands: [
      "trace-application-feature",
      "trace-javascript-semantics",
      "compare-application-versions",
      "compare-source-to-bundle",
      "compare-javascript-export-shapes",
      "build-reconstruction-obligation-ledger",
      "evaluate-reconstruction-coverage",
      "project-android-application-graph",
      "project-apple-application-graph",
      "project-harmony-application-graph",
    ],
    load: async () => {
      const { registerApplicationCommands } =
        await import("./cli/applicationCommands.js");
      return (cli, logger) => registerApplicationCommands(cli, logger);
    },
  },
];

/** The registrar that owns a leading command name, or every registrar. */
const selectedGroups = (
  argv: readonly string[] | undefined,
): readonly CliCommandGroup[] => {
  const command = argv?.[0];
  const owner =
    command === undefined
      ? undefined
      : CLI_COMMAND_GROUPS.find((group) => group.commands.includes(command));
  return owner === undefined ? CLI_COMMAND_GROUPS : [owner];
};

/**
 * Build the one-shot Incur CLI without starting Hopper at import time.
 * Analysis commands acquire and close their own sessions; bare `mcp` and
 * `--mcp` are intercepted by the executable dispatcher before this module loads.
 * With `argv` naming a known command first, only that command's registrar is
 * loaded; otherwise every command is registered.
 */
export const createCli = async (
  selectedEnvironment: Environment = process.env,
  resultOutput?: CliResultOutput,
  argv?: readonly string[],
): Promise<CliInstance> => {
  // Snapshot before any await so later caller mutation cannot leak in.
  const environment = snapshotEnvironment(selectedEnvironment);
  let analysis: Promise<DirectAnalysis> | undefined;
  const loadAnalysis = (): Promise<DirectAnalysis> =>
    (analysis ??= import("./composition/directAnalysis.js").then(
      ({ createDirectAnalysis }) => createDirectAnalysis(environment),
    ));
  const registrars = await Promise.all(
    selectedGroups(argv).map((group) => group.load(loadAnalysis)),
  );
  const logger = createLogger(
    "cli",
    environment.REA_LOG_LEVEL === undefined
      ? "silent"
      : parseLogLevel(environment.REA_LOG_LEVEL),
  );
  const cli = Cli.create(PRODUCT_IDENTITY.cliBinary, {
    version: PRODUCT_IDENTITY.packageVersion,
    description: "Reverse engineer anything from your terminal or agent.",
    mcp: {
      command: npxRegistrationCommand().join(" "),
      instructions:
        "Ask what software, artifact, protocol, or behavior the user wants to understand, then choose the available investigation capabilities that can produce evidence.",
    },
    sync: false,
  });
  for (const register of registrars) register(cli, logger, environment);
  presentOmittableDefaults(cli);
  if (resultOutput !== undefined) streamCliCommandResults(cli, resultOutput);
  return cli;
};
