// lib/runtime/json-schema.ts
//
// Minimal JSON Schema validator covering exactly the subset used by every
// agent's outputContract.schema in this repo. Same surface as the validator
// inside scripts/test-agent.mjs, ported to TypeScript so the runtime
// LLMAgentRunner can validate model outputs with identical semantics to the
// static agent-definition harness.
//
// Supported keywords:
//   type:         "object" | "array" | "string" | "number" | "integer" | "boolean" | "null"
//   required:     string[]
//   properties:   Record<string, Schema>
//   additionalProperties: boolean (false closes the object; subschema not supported)
//   items:        Schema
//   minItems, maxItems: number
//   minimum, maximum:   number
//   enum:         readonly unknown[]
//
// Returns structured errors. Never throws on bad input data (only on
// catastrophic schema misconfiguration).

export interface JSONSchema {
  type?: string;
  required?: string[];
  properties?: Record<string, JSONSchema>;
  additionalProperties?: boolean | JSONSchema;
  items?: JSONSchema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  enum?: readonly unknown[];
  description?: string;
  [key: string]: unknown;
}

export interface SchemaError {
  path: string;
  message: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaError[];
}

export function validateAgainstSchema(
  value: unknown,
  schema: JSONSchema,
  path = "$",
): SchemaValidationResult {
  const errors: SchemaError[] = [];
  validateInto(value, schema, path, errors);
  return { valid: errors.length === 0, errors };
}

// ---------- internals ----------

function actualTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer-or-number" : "number";
  }
  return typeof value;
}

function typeMatches(declared: string, actual: string): boolean {
  if (declared === "number") return actual === "number" || actual === "integer-or-number";
  if (declared === "integer") return actual === "integer-or-number";
  return declared === actual;
}

function validateInto(
  value: unknown,
  schema: JSONSchema,
  path: string,
  errors: SchemaError[],
): void {
  if (typeof schema.type === "string") {
    const actual = actualTypeOf(value);
    if (!typeMatches(schema.type, actual)) {
      const display = actual === "integer-or-number" ? "number" : actual;
      errors.push({ path, message: `expected ${schema.type}, got ${display}` });
      return; // type mismatch ⇒ subsequent checks would be misleading
    }
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push({
        path,
        message: `value ${JSON.stringify(value)} not in enum [${schema.enum
          .map((v) => JSON.stringify(v))
          .join(", ")}]`,
      });
    }
  }

  if (schema.type === "number" || schema.type === "integer") {
    const n = value as number;
    if (typeof schema.minimum === "number" && n < schema.minimum) {
      errors.push({ path, message: `${n} < minimum ${schema.minimum}` });
    }
    if (typeof schema.maximum === "number" && n > schema.maximum) {
      errors.push({ path, message: `${n} > maximum ${schema.maximum}` });
    }
  }

  if (schema.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push({
            path: `${path}.${key}`,
            message: `required field "${key}" is missing`,
          });
        }
      }
    }

    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in obj) {
          validateInto(obj[key], sub, `${path}.${key}`, errors);
        }
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) {
          errors.push({
            path: `${path}.${key}`,
            message: `unexpected additional property "${key}"`,
          });
        }
      }
    }
  }

  if (schema.type === "array" && Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push({
        path,
        message: `${value.length} items < minItems ${schema.minItems}`,
      });
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `${value.length} items > maxItems ${schema.maxItems}`,
      });
    }
    if (schema.items) {
      const itemSchema = schema.items;
      value.forEach((item, i) => validateInto(item, itemSchema, `${path}[${i}]`, errors));
    }
  }
}
