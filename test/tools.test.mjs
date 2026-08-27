// Tool contract test.
//
// The README promises six tools and a specific parameter set for each. Any of those can change
// upstream without a commit here, and the README would start lying silently. These checks catch
// that before a user does.
//
// One test makes a real call. Listing tools accepts any non-empty key, so a contract check that
// only lists tools stays green with a revoked or mistyped key. That single search call costs
// 5 credits, which is the price of a canary that can fail for the right reason.
//
// Run: HASDATA_API_KEY=your_key_here npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ENDPOINT = 'https://mcp.hasdata.com/api/mcp?apis=google_maps';
const KEY = process.env.HASDATA_API_KEY;
const TIMEOUT_MS = 60_000;

const SEARCH = 'hasdata_google_maps_search_performMapSearch';
const PLACE = 'hasdata_google_maps_place_getPlaceDetails';
const REVIEWS = 'hasdata_google_maps_reviews_getMapReviews';
const CONTRIBUTOR = 'hasdata_google_maps_contributor_reviews_getMapReviews';
const PHOTOS = 'hasdata_google_maps_photos_getMapPhotos';
const POSTS = 'hasdata_google_maps_posts_getMapPosts';

// Parameters the README documents, and whether it documents them as required.
const PARAMS = {
    [SEARCH]: { q: true, ll: false, gl: false, hl: false, domain: false, start: false },
    [PLACE]: { placeId: true, hl: false, domain: false },
    [REVIEWS]: { placeId: false, dataId: false, sortBy: false, topicId: false, hl: false, nextPageToken: false },
    [CONTRIBUTOR]: { contributorId: true, num: false, gl: false, hl: false, nextPageToken: false },
    [PHOTOS]: { placeId: false, dataId: false, categoryId: false, hl: false, nextPageToken: false },
    [POSTS]: { placeId: false, dataId: false, hl: false, nextPageToken: false },
};

// A streamable HTTP body arrives either as plain JSON or as server-sent events. One SSE event
// can span several data: lines, several events can share one response, and a server is free to
// send progress notifications before the answer. So collect every event and pick the message
// carrying our request id.
function parseRpc(raw, id) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);

    const messages = [];
    for (const event of trimmed.split(/\r?\n\r?\n+/)) {
        const data = event
            .split(/\r?\n/)
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).replace(/^ /, ''))
            .join('\n');
        if (!data || data === '[DONE]') continue;
        try {
            messages.push(JSON.parse(data));
        } catch {
            // A keep-alive or a partial event is not our response.
        }
    }
    assert.ok(messages.length, `no JSON-RPC message in the response: ${raw.slice(0, 300)}`);
    const match = messages.find((m) => m.id === id);
    assert.ok(match, `no message with id ${id} in the response: ${raw.slice(0, 300)}`);
    return match;
}

let nextId = 1;

async function rpc(method, params = {}) {
    // The CI key sits on the free plan, where concurrency is 1. When several of
    // these repos are pushed at once their contract runs collide, and HasData
    // answers 429 with code concurrency_limit straight away rather than queueing.
    // That is a plan limit, not a broken contract, so the call is retried before
    // the test gives up. A 401 still fails on the first attempt.
    for (let attempt = 1; ; attempt++) {
        const id = nextId++;
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'x-api-key': KEY,
                'Content-Type': 'application/json',
                // The server answers over streamable HTTP, so accept both a plain body and a stream.
                Accept: 'application/json, text/event-stream',
            },
            body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        assert.equal(res.status, 200, `${method} returned ${res.status}`);
        const raw = await res.text();
        if (raw.includes('concurrency_limit') && attempt < 5) {
            await new Promise((r) => setTimeout(r, attempt * 4000));
            continue;
        }
        return { raw, body: parseRpc(raw, id) };
    }
}

// A tools/call result wraps the payload in a single text block holding url, status, text and json.
// The scraped data is under json. Anything the README says about field names is a claim about
// that object, so unwrap before asserting.
async function callTool(name, args) {
    const { raw, body } = await rpc('tools/call', { name, arguments: args });
    assert.ok(!raw.includes('401 Unauthorized'), 'HasData rejected the key');
    assert.ok(!raw.includes('"isError":true'), `${name} failed: ${raw.slice(0, 300)}`);
    const text = body.result?.content?.[0]?.text;
    assert.ok(text, `${name} returned no text block`);
    const envelope = JSON.parse(text);
    assert.ok(envelope.json, `${name} returned an envelope with no json payload`);
    return envelope.json;
}

let toolsPromise;
function listTools() {
    toolsPromise ??= rpc('tools/list').then(({ body }) => {
        assert.ok(body.result?.tools, 'the response carried no result.tools');
        return body.result.tools;
    });
    return toolsPromise;
}

const live = { skip: KEY ? false : 'HASDATA_API_KEY is not set, skipping the live checks' };

test('apis=google_maps exposes exactly the six documented tools', live, async () => {
    const tools = await listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(
        names,
        [SEARCH, PLACE, REVIEWS, CONTRIBUTOR, PHOTOS, POSTS].sort(),
        `the tool list is now ${names.join(', ')}`
    );
});

test('every documented parameter still exists, and required stays required', live, async () => {
    const tools = await listTools();
    for (const [name, params] of Object.entries(PARAMS)) {
        const tool = tools.find((t) => t.name === name);
        assert.ok(tool, `${name} is missing upstream`);
        const props = tool.inputSchema?.properties ?? {};
        const required = tool.inputSchema?.required ?? [];
        for (const [param, isRequired] of Object.entries(params)) {
            assert.ok(props[param], `${name}.${param} is in the README but missing upstream`);
            assert.equal(
                required.includes(param),
                isRequired,
                `${name}.${param} required is now ${!isRequired}, the README says ${isRequired}`
            );
        }
    }
});

test('every tool carries a description', live, async () => {
    const tools = await listTools();
    for (const tool of tools) {
        assert.ok(
            (tool.description || '').trim().length > 15,
            `${tool.name} has an empty or near-empty description`
        );
    }
});

// One live search. It exercises the auth path and the documented result shape, and it returns the
// placeId and dataId the README says every result carries, which is what the other five tools
// consume. Keeping it to one call holds the canary at 5 credits.
test('a search returns results carrying the documented fields', live, async () => {
    const search = await callTool(SEARCH, { q: 'coffee', ll: '@47.6062,-122.3321,14z', gl: 'us', hl: 'en' });
    assert.ok(Array.isArray(search.localResults), 'localResults is documented as an array');
    const [first] = search.localResults;
    assert.ok(first, 'the search came back empty for a query that always has results');
    for (const field of ['position', 'title', 'placeId', 'dataId', 'address', 'rating', 'type']) {
        assert.ok(field in first, `search results no longer carry ${field}`);
    }
    // The README's example chains lean on both ids being present on every result.
    assert.ok(first.placeId && first.dataId, 'a result is missing placeId or dataId');
});
