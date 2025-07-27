import type { HttpMethod, PathsWithMethod } from "openapi-typescript-helpers";

type StringLiteralUnion<T> = T | (string & Record<never, never>);
type NumberLiteralUnion<T> = T | (number & Record<never, never>);
type PromiseOr<T> = Promise<T> | T;

type JsonResponse<Operation, Status extends number> = Operation extends {
	responses: {
		[S in Status]: {
			content: { [Mime in `${string}/${string}json`]: infer T };
		};
	};
}
	? T
	: never;
type StatusCode<Operation> = Operation extends {
	responses: Record<infer K, any>;
}
	? K & number
	: never;
type RequestBody<Operation> = Operation extends {
	requestBody: { content: { [Mime in `${string}/${string}json`]: infer T } };
}
	? T
	: never;
type PathParams<Operation> = Operation extends {
	parameters: { path: infer T };
}
	? T
	: never;
type KeyedSearchParams<Key> = Omit<URLSearchParams, "get" | "getAll"> & {
	get: (name: StringLiteralUnion<Key>) => string | null;
	getAll: (name: StringLiteralUnion<Key>) => string[];
};
type QueryParams<Operation> = Operation extends {
	parameters: { query: Record<string, any> };
}
	? KeyedSearchParams<keyof Operation["parameters"]["query"]>
	: never;
export type EntryHandler<Operation> = (
	request: Omit<Request, "json"> & { json: Promise<RequestBody<Operation>> },
	context: {
		params: { path: PathParams<Operation>; query: QueryParams<Operation> };
		jsonResponse: <Status extends StatusCode<Operation>>(
			status: NumberLiteralUnion<Status>,
			body: JsonResponse<Operation, Status>,
			init?: ResponseInit,
		) => Promise<Response>;
		delay: (ms: number) => Promise<void>;
	},
) => PromiseOr<Response>;
type ResolvedEntry = {
	handler: Handler;
	pathSegments: readonly PathSegment[];
};
type Entry = (resolvedOptions: ResolvedHandlerOptions) => ResolvedEntry;
export type CreateEntry<
	Paths extends Record<string, any>,
	Method extends HttpMethod,
> = <Path extends PathsWithMethod<Paths, Method> & string>(
	path: Path,
	handler: EntryHandler<Paths[Path][Method]>,
) => Entry;
export type GenContext<Paths extends Record<string, any>> = Readonly<{
	GET: CreateEntry<Paths, "get">;
	PUT: CreateEntry<Paths, "put">;
	POST: CreateEntry<Paths, "post">;
	DELETE: CreateEntry<Paths, "delete">;
	OPTIONS: CreateEntry<Paths, "options">;
	HEAD: CreateEntry<Paths, "head">;
	PATCH: CreateEntry<Paths, "patch">;
	TRACE: CreateEntry<Paths, "trace">;
}>;
const context: GenContext<any> = Object.freeze({
	GET: getCreateEntry("get"),
	PUT: getCreateEntry("put"),
	POST: getCreateEntry("post"),
	DELETE: getCreateEntry("delete"),
	OPTIONS: getCreateEntry("options"),
	HEAD: getCreateEntry("head"),
	PATCH: getCreateEntry("patch"),
	TRACE: getCreateEntry("trace"),
});
export type Gen<Paths extends Record<string, any>> = (
	context: GenContext<Paths>,
) => Entry[];
export type Handler = (request: Request) => Promise<Response | undefined>;
export type NormalHandler = (request: Request) => Promise<Response>;
export type HandlerOptions = {
	/**
	 * The base URL for the API, used to match incoming requests.
	 * @default `/`
	 */
	baseUrl?: `/${string}`;
	/**
	 * If true, the handler will return `undefined` for unmatched requests instead of 404 Not Found.
	 * @default false
	 */
	returnUndefined?: boolean;
};
type ResolvedHandlerOptions = {
	baseUrlPathSegments: string[];
};

/**
 * Create a request handler
 * @param gen A generator function that defines the API endpoints.
 * @param options Handler options to customize the behavior.
 * @example
 * ```js
 * import type { paths } from "./schema.ts";
 * const users = [];
 * const handler = createHandler<paths>((ctx) => [
 *   ctx.GET("/users", (_, c) => c.jsonResponse(200, { users })),
 *   ctx.POST("/users", async (req, c) => {
 *     const user = await req.json();
 *     users.push(user);
 *     return c.jsonResponse(201, user);
 *   }),
 *   ctx.GET("/users/{id}", (req, c) => {
 *     const { id } = c.params.path;
 *     const user = users.find((u) => u.id === id);
 *     if (!user) return c.jsonResponse(404, { error: "User not found" });
 *     return c.jsonResponse(200, user);
 *   }),
 * ]);
 * // Node.js
 * import { createServer } from "http";
 * import { createRequestListener } from "@remix-run/node-fetch-server";
 * const server = createServer(createRequestListener(handler));
 * server.listen(3000);
 * // Deno
 * Deno.serve(handler);
 * // Bun
 * Bun.serve({ fetch: handler });
 */
export function createHandler<Paths extends Record<string, any>>(
	handlers: Gen<Paths>,
	options?: HandlerOptions,
): NormalHandler;
export function createHandler<Paths extends Record<string, any>>(
	handlers: Gen<Paths>,
	options: HandlerOptions & { returnUndefined: true },
): Handler;
export function createHandler<Paths extends Record<string, any>>(
	handlers: Gen<Paths> | Entry[],
	options: HandlerOptions = {},
): NormalHandler {
	const resolvedOptions: ResolvedHandlerOptions = {
		baseUrlPathSegments: options.baseUrl?.split("/").filter(Boolean) ?? [],
	};
	const context = createContext<Paths>();
	const generated =
		typeof handlers === "function" ? handlers(context) : handlers;
	const entries = generated
		.map((resolve) => resolve(resolvedOptions))
		.sort(compareByPathSegments);
	return async (request) => {
		for (const entry of entries) {
			const response = await entry.handler(request);
			if (response !== undefined) return response;
		}
		// biome-ignore lint/style/noNonNullAssertion: `returnUndefined` is checked above
		if (options.returnUndefined) return undefined!;
		return new Response("Not Found", { status: 404 });
	};
}
/**
 * Create a context for defining API endpoints.
 * This function allows you to separate the file where you define the API endpoints from the file where you create the handler.
 * ```js
 * import type { paths } from "./schema.ts";
 * const ctx = createContext<paths>();
 * const listUsers = ctx.GET("/users", (_, c) => c.jsonResponse(200, { users: [] }));
 * const handler = createHandler([listUsers]);
 *
 * // Equivalent to:
 * const handler = createHandler<paths>((ctx) => [
 *   ctx.GET("/users", (_, c) => c.jsonResponse(200, { users: [] })),
 * ]);
 * ```
 */
export function createContext<
	Paths extends Record<string, any>,
>(): GenContext<Paths> {
	return context;
}
function getCreateEntry<
	Paths extends Record<string, any>,
	Method extends HttpMethod,
>(method: Method): CreateEntry<Paths, Method> {
	return (path, handler) => {
		return (resolvedOptions) => {
			const pathSegments = [
				...resolvedOptions.baseUrlPathSegments,
				...parsePathTemplate(path),
			];
			return {
				pathSegments,
				handler: async (request) => {
					if (request.method.toLowerCase() !== method) return undefined;
					const requestUrl = new URL(request.url);
					const requestPath = requestUrl.pathname;
					const pathParams = matchPath(requestPath, pathSegments);
					if (!pathParams) return undefined;

					return (
						handler as unknown as (
							r: Request,
							ctx: {
								params: { path: Record<string, any>; query: URLSearchParams };
								jsonResponse: (
									status: number,
									body: Record<string, any>,
									init?: ResponseInit,
								) => Promise<Response>;
								delay: (ms: number) => Promise<void>;
							},
						) => Response
					)(request, {
						params: { path: pathParams, query: requestUrl.searchParams },
						jsonResponse,
						delay,
					});
				},
			};
		};
	};
}

type PathSegment =
	| string
	| { name: string; type: "simple" | "label" | "matrix"; explode: boolean };
function parsePathTemplate(path: string): PathSegment[] {
	return path
		.split("/")
		.filter(Boolean)
		.map((segment) => {
			const match = segment.match(/^{(|\.|;)(.+?)(\*)?}$/);
			if (!match) return segment;
			const [, type, name, explode] = match;
			return {
				name,
				type: type === "." ? "label" : type === ";" ? "matrix" : "simple",
				explode: explode === "*",
			} as const;
		});
}

function compareByPathSegments(a: ResolvedEntry, b: ResolvedEntry): number {
	const aSegments = a.pathSegments;
	const bSegments = b.pathSegments;
	if (aSegments.length !== bSegments.length)
		return bSegments.length - aSegments.length;
	const aStrLen = aSegments.filter((s) => typeof s === "string").length;
	const bStrLen = bSegments.filter((s) => typeof s === "string").length;
	if (aStrLen !== bStrLen) return bStrLen - aStrLen;
	for (let i = 0; i < aSegments.length; i++) {
		const aSegment = aSegments[i];
		const bSegment = bSegments[i];
		if (typeof aSegment === "string" && typeof bSegment === "string") continue; // both are strings, equal segments
		if (typeof aSegment === "string") return 1; // string segments come first
		if (typeof bSegment === "string") return -1; // string segments come first
	}
	return 0; // all segments are equal, respect the original order
}

function matchPath(
	requestPath: string,
	pathSegments: readonly PathSegment[],
): Record<string, string> | undefined {
	const requestSegments = requestPath.split("/").filter(Boolean);
	if (requestSegments.length !== pathSegments.length) return undefined;

	const params: Record<string, string> = Object.create(null);
	for (let i = 0; i < pathSegments.length; i++) {
		const segment = pathSegments[i];
		const requestSegment = requestSegments[i];

		if (typeof segment === "string") {
			if (segment !== requestSegment) return undefined;
		} else {
			params[segment.name] = requestSegment;
		}
	}
	return params;
}

async function jsonResponse(
	status: number,
	body: Record<string, any>,
	init?: ResponseInit,
): Promise<Response> {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...init?.headers },
		...init,
	});
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
