import { Cli } from "incur";
import { describe, expect, it } from "vitest";

import { CLI_COMMAND_GROUPS, createCli } from "../../../src/cli.js";
import { createDirectAnalysis } from "../../../src/composition/directAnalysis.js";
import { createLogger } from "../../../src/logger.js";
import { createCliInventory } from "../../../scripts/lib/catalog-cli.mjs";

const registerGroupAlone = async (
  group: (typeof CLI_COMMAND_GROUPS)[number],
): Promise<readonly string[]> => {
  const cli = Cli.create("rea", { sync: false });
  const register = await group.load(() =>
    Promise.resolve(createDirectAnalysis({})),
  );
  register(cli, createLogger("cli", "silent"), {});
  return createCliInventory(cli).primary;
};

describe("CLI command groups", () => {
  it("declares exactly the commands each registrar adds", async () => {
    for (const group of CLI_COMMAND_GROUPS)
      expect(await registerGroupAlone(group)).toEqual(
        [...group.commands].sort((left, right) => left.localeCompare(right)),
      );
  }, 30_000);

  it("partitions the complete command catalog", async () => {
    const declared = CLI_COMMAND_GROUPS.flatMap(({ commands }) => commands);
    expect(new Set(declared).size).toBe(declared.length);
    expect(createCliInventory(await createCli({})).primary).toEqual(
      declared.sort((left, right) => left.localeCompare(right)),
    );
  }, 30_000);

  it("registers only the registrar that owns a leading command", async () => {
    const owner = CLI_COMMAND_GROUPS.find(({ commands }) =>
      commands.includes("read-bytes"),
    );
    expect(
      createCliInventory(await createCli({}, undefined, ["read-bytes", "-h"]))
        .primary,
    ).toEqual(
      [...(owner?.commands ?? [])].sort((left, right) =>
        left.localeCompare(right),
      ),
    );
  });

  it("registers every command when no leading argument names one", async () => {
    const complete = createCliInventory(await createCli({}));
    for (const argv of [[], ["--help"], ["--format", "json", "analyze"]])
      expect(createCliInventory(await createCli({}, undefined, argv))).toEqual(
        complete,
      );
  }, 30_000);
});
