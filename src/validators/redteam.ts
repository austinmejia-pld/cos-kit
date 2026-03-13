import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "../../skills/redteam/schemas");

interface ValidationError {
  path: string;
  message: string;
  keyword: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function loadSchema(filename: string): object {
  const raw = readFileSync(resolve(SKILL_ROOT, filename), "utf-8");
  return JSON.parse(raw);
}

function createAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

import type { ValidateFunction } from "ajv";

function normalizeErrors(validate: ValidateFunction): ValidationError[] {
  if (!validate.errors) return [];
  return validate.errors.map((err) => ({
    path: err.instancePath || "/",
    message: err.message ?? "Unknown validation error",
    keyword: err.keyword,
  }));
}

const ajv = createAjv();
const inputSchema = loadSchema("input.schema.json");
const outputSchema = loadSchema("output.schema.json");
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

export function validateRedteamInput(payload: unknown): ValidationResult {
  const valid = validateInput(payload);
  return {
    valid: valid as boolean,
    errors: valid ? [] : normalizeErrors(validateInput),
  };
}

export function validateRedteamOutput(payload: unknown): ValidationResult {
  const valid = validateOutput(payload);
  return {
    valid: valid as boolean,
    errors: valid ? [] : normalizeErrors(validateOutput),
  };
}
