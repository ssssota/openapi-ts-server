import petstore from "@readme/oas-examples/3.1/json/petstore.json";
import { beforeAll, expect, it } from "vitest";
import { createContext, createHandler } from "../dist";
import type { paths } from "./petstore.gen";
import { baseUrl, compile } from "./utils.js";

beforeAll(async () => {
	await compile(petstore, "./petstore.gen.ts");
});

it("should handle request", async () => {
	const handler = createHandler<paths>((ctx) => [
		ctx.GET("/pet/{petId}", (_, c) => {
			return c.jsonResponse(200, {
				name: "Mocked Pet",
				photoUrls: [],
			});
		}),
		createContext<paths>().GET("/pet/findByStatus", (_, c) => {
			return c.jsonResponse(200, [
				{
					name: `Mocked Pet (${c.params.query.get("status")})`,
					photoUrls: [],
				},
			]);
		}),
	]);
	const res1 = await handler(new Request(`${baseUrl}pet/123`));
	expect(res1.status).toBe(200);
	expect(await res1.json()).toEqual({
		name: "Mocked Pet",
		photoUrls: [],
	});

	const res2 = await handler(
		new Request(`${baseUrl}pet/findByStatus?status=available`),
	);
	expect(res2.status).toBe(200);
	expect(await res2.json()).toEqual([
		{
			name: "Mocked Pet (available)",
			photoUrls: [],
		},
	]);

	const res3 = await handler(
		new Request(`${baseUrl}not-found`),
	);
	expect(res3.status).toBe(404);
});
