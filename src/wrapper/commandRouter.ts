import type { ParsedCommand, CommandFlags } from "./types.js";

export function parseCommand(
  input: string,
  commands: Record<string, string>,
): ParsedCommand {
  const trimmed = input.trim();
  const commandMatch = trimmed.match(/^(\/[\w-]+)/);

  if (!commandMatch) {
    return {
      recognized: false,
      flags: {},
      error: `No command found. Commands start with /. Available: ${Object.keys(commands).join(", ")}`,
    };
  }

  const command = commandMatch[1];
  const skillName = commands[command];

  if (!skillName) {
    return {
      recognized: false,
      command,
      flags: {},
      error: `Unknown command: ${command}. Available: ${Object.keys(commands).join(", ")}`,
    };
  }

  const flagText = trimmed.slice(commandMatch[0].length);
  const flags = parseFlags(flagText);

  return { recognized: true, command, skillName, flags };
}

function parseFlags(text: string): CommandFlags {
  const flags: CommandFlags = {};

  if (/--raw\b/.test(text)) {
    flags.raw = true;
  }

  const focusMatch = text.match(/--focus\s+(?:"([^"]+)"|(\S+))/);
  if (focusMatch) {
    flags.focus = focusMatch[1] ?? focusMatch[2];
  }

  const depthMatch = text.match(/--depth\s+(quick|standard|deep)/);
  if (depthMatch) {
    flags.depth = depthMatch[1];
  }

  return flags;
}
