import { writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import openapi, { astToString } from "openapi-typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const baseUrl = "https://example.com/";

export async function compile(schema: any, output: string) {
	const source = typeof schema === "string" ? schema : JSON.stringify(schema);
	const ast = await openapi(source);
	const code = astToString(ast);
	await writeFile(path.join(__dirname, output), code);
}
