# Google Maps MCP Server

A hosted Model Context Protocol (MCP) server that gives Claude, Cursor, Windsurf and any other MCP client six read-only Google Maps tools. Search places, read a place in full, pull its reviews, photos and posts, and walk a single reviewer's history, all as structured JSON, with no Google Cloud project and no billing to enable.

```
https://mcp.hasdata.com/api/mcp?apis=google_maps
```

[![tool contract](https://github.com/HasData/google-maps-mcp/actions/workflows/contract.yml/badge.svg)](https://github.com/HasData/google-maps-mcp/actions/workflows/contract.yml)
[![MCP](https://img.shields.io/badge/MCP-remote%20%7C%20streamable%20HTTP-6366f1?style=flat-square)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/tools-6-10b981?style=flat-square)](#tools)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

## Contents

- [What you need](#what-you-need)
- [Quick start](#quick-start)
- [Example prompts](#example-prompts)
- [Tools](#tools)
- [Errors and failure paths](#errors-and-failure-paths)
- [Pricing, free tier and limits](#pricing-free-tier-and-limits)
- [Tool selection](#tool-selection)
- [How it compares](#how-it-compares)
- [FAQ](#faq)
- [HasData links](#hasdata-links)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## What you need

An MCP client that speaks streamable HTTP with custom headers. A HasData API key from the [dashboard](https://app.hasdata.com/sign-up?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp), free to create with no card, and the trial covers about 200 calls at the 5-credit rate. Nothing else. This is a remote server. There is no package to install, no container to run, and no Google Cloud project or API key anywhere in the flow.

## Quick start

| | |
| :--- | :--- |
| URL | `https://mcp.hasdata.com/api/mcp?apis=google_maps` |
| Transport | HTTP, streamable |
| Auth header | `x-api-key: HASDATA_API_KEY` |

The server URL is the same for every client. We run it hands-on in Claude Code and Claude Desktop. The other blocks follow each client's own documented format for a remote server.

Clients with OAuth support can add the same URL as a connector and sign in without putting a key in a config file.

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add --transport http google-maps "https://mcp.hasdata.com/api/mcp?apis=google_maps" \
  --header "x-api-key: HASDATA_API_KEY"
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Claude Desktop loads only local (stdio) servers from its config file, so a remote server is reached through the `mcp-remote` bridge. Node has to be on the machine.

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-maps": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.hasdata.com/api/mcp?apis=google_maps",
        "--header",
        "x-api-key:HASDATA_API_KEY"
      ]
    }
  }
}
```

The `x-api-key:` value carries no space after the colon. Claude Desktop passes the argument without a shell, and a space splits the header. A client with OAuth support can instead add the URL as a custom connector and skip the bridge.

</details>

<details>
<summary><b>Cursor</b></summary>

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "google-maps": {
      "url": "https://mcp.hasdata.com/api/mcp?apis=google_maps",
      "headers": { "x-api-key": "HASDATA_API_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf</b></summary>

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "google-maps": {
      "serverUrl": "https://mcp.hasdata.com/api/mcp?apis=google_maps",
      "headers": { "x-api-key": "HASDATA_API_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Cline</b></summary>

```json
{
  "mcpServers": {
    "google-maps": {
      "url": "https://mcp.hasdata.com/api/mcp?apis=google_maps",
      "type": "streamableHttp",
      "headers": { "x-api-key": "HASDATA_API_KEY" },
      "disabled": false
    }
  }
}
```

</details>

<details>
<summary><b>VS Code</b></summary>

`.vscode/mcp.json`:

```json
{
  "servers": {
    "google-maps": {
      "type": "http",
      "url": "https://mcp.hasdata.com/api/mcp?apis=google_maps",
      "headers": { "x-api-key": "HASDATA_API_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

`~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "google-maps": {
      "httpUrl": "https://mcp.hasdata.com/api/mcp?apis=google_maps",
      "headers": { "x-api-key": "HASDATA_API_KEY" }
    }
  }
}
```

</details>

## Example prompts

Each of these is one tool call unless the count says otherwise.

> Search Google Maps for coffee near downtown Seattle and give me the top ten with their rating, review count and website.

*One call, 5 credits. Search returns the places with `placeId` and `dataId` already attached, and the follow-ups below need no lookup step.*

> Pull the full details for `ChIJAb0KE0RrkFQRuI4X0By5Mcw`: hours, service options, price level and the menu link.

*One call, 5 credits.*

> Read the latest reviews for that place, sorted newest first, and tell me which topics come up most.

*One call, 5 credits. The response carries Google's own topic clusters with a mention count each, and the ranking is in the data.*

> Take the author of the top review and list every other place they have reviewed, with the rating they left.

*One call, 5 credits. A review carries its author's `contributorId`, which is exactly what the contributor tool takes.*

> Get the photo feed for that place and the business's recent posts.

*Two calls. Photos cost 5 credits, posts cost 10.*

Two things make these chains cheap. Search hands back `placeId` and `dataId` on every result, and the detail, review, photo and post calls need no separate resolve step. And a review carries the author's `contributorId`, which turns "who left this review" into a one-call jump to that person's whole history.

## Tools

Six tools, all read-only. Samples below are trimmed from real calls, and the numbers in them move as places gain reviews. Read them as shapes. Each tool name links to its endpoint reference.

The samples are the payload, not the whole response. A `tools/call` result carries one text block, and that text is itself JSON holding `url`, `status`, `text` and `json`, with the scraped data under `json`. From a raw JSON-RPC response the path is `result.content[0].text`, parsed, then `.json`. A chat client unwraps that for you and code talking to the endpoint directly does not.

Four of the tools accept a place by either `placeId` or `dataId`. Search returns both on every result. The usual flow is one search followed by detail, review, photo or post calls that reuse whichever id you kept.

### Search Google Maps

[`hasdata_google_maps_search_performMapSearch`](https://docs.hasdata.com/apis/google-maps/search?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp)

Places for a query, ranked as Google Maps ranks them.

| Parameter | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `q` | string | yes | Free-text query, for example `coffee` or `plumber` |
| `ll` | string | | Map centre and zoom as `@lat,lng,zoomz`, for example `@47.6062,-122.3321,14z`. This is how you pin the search to a place |
| `gl` / `hl` | string | | Two-letter country and language codes |
| `domain` | string | | Google domain to query, for example `google.com` |
| `start` | number | | Result offset for paging, in steps of 20. Requires `ll` to be set as well |

Each result carries `position`, `title`, `placeId`, `dataId`, `address`, `gpsCoordinates`, `rating`, `reviews`, `type`, `types`, `price`, `website`, `thumbnail`, `openState`, `workingHours`, `serviceOptions` and, where Google shows one, a `menu` link.

> Location lives in `ll`, not in the query. Put the map centre and zoom there, because "coffee" alone returns wherever Google decides you are. The zoom digit widens or narrows the area the results are drawn from.

```json
{
  "localResults": [
    {
      "position": 1,
      "title": "Howdy Y'all Coffee (Central Library)",
      "placeId": "ChIJAb0KE0RrkFQRuI4X0By5Mcw",
      "dataId": "0x54906b44130abd01:0xcc31b91cd0178eb8",
      "address": "1000 4th Ave Fl 3, Seattle, WA 98104",
      "rating": 4.9,
      "reviews": 117,
      "type": "Coffee shop",
      "website": "https://howdyyallcoffee.com/",
      "workingHours": {
        "timezone": "America/Los_Angeles",
        "days": [ { "day": "Friday", "time": "10 AM–4 PM" } ]
      }
    }
  ]
}
```

### Get place details

[`hasdata_google_maps_place_getPlaceDetails`](https://docs.hasdata.com/apis/google-maps/place?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp)

One place in full by `placeId`.

| Parameter | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `placeId` | string | yes | The `placeId` from a search result |
| `hl` | string | | Language code |
| `domain` | string | | Google domain |

Returns a single `placeResults` object with the same fields a search result carries, plus an `images` array. It is the way to get one place's full record without running a search you do not need.

### Get place reviews

[`hasdata_google_maps_reviews_getMapReviews`](https://docs.hasdata.com/apis/google-maps/reviews?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp)

The review feed for a place, page by page.

| Parameter | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `placeId` | string | | The place. Either `placeId` or `dataId` has to be present |
| `dataId` | string | | The place as a `dataId` instead |
| `sortBy` | string | | `mostRelevant` by default, plus `newestFirst`, `ratingHigh` and `ratingLow` |
| `topicId` | string | | Filter to one topic, using an `id` from the `topics` array |
| `hl` | string | | Language code |
| `nextPageToken` | string | | The `pagination.nextPageToken` from the previous response |

Returns `placeInfo`, a `topics` array, a `reviews` array and `pagination`. Each review carries `reviewId`, `rating`, `snippet`, `date`, `isoDate`, `link`, `images`, a `user` object and, where the owner replied, a `response`.

> `topics` is Google's own clustering of what reviews mention, each with a `keyword` and a `mentions` count, and the themes come pre-counted rather than needing you to read every review. Feed a topic's `id` back as `topicId` to read only the reviews that mention it.

> Each review's `user` carries a `contributorId`. That is the input the contributor tool takes, so "who wrote this" is one call away from "everything they wrote".

```json
{
  "placeInfo": { "title": "Howdy Y'all Coffee (Central Library)", "rating": 4.9, "reviews": 117 },
  "topics": [
    { "keyword": "earl grey matcha", "mentions": 26, "id": "bew1w_KAk5U" },
    { "keyword": "friendly baristas", "mentions": 17, "id": "FOw-91tYieQ" }
  ],
  "reviews": [
    {
      "reviewId": "…",
      "rating": 5,
      "snippet": "…",
      "isoDate": "2026-07-06T19:49:00.657Z",
      "user": { "name": "Angela Li", "contributorId": "106033685843245983748" },
      "response": { "isoDate": "2026-07-07T04:44:34.000Z", "snippet": "Thank you!! 🥺☺️" }
    }
  ],
  "pagination": { "nextPageToken": "…" }
}
```

### Get a contributor's reviews

[`hasdata_google_maps_contributor_reviews_getMapReviews`](https://docs.hasdata.com/apis/google-maps/contributor-reviews?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp)

Every review one person has written, across all the places they rated.

| Parameter | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `contributorId` | string | yes | The `contributorId` from a review's `user` object |
| `num` | number | | How many reviews to return |
| `gl` / `hl` | string | | Country and language codes |
| `nextPageToken` | string | | Token from the previous response |

Returns a `contributor` object with `name`, `level`, `points` and a `contributions` breakdown, and a `reviews` array where every entry carries its own `placeInfo`, and you see which place each review is about without a second lookup. This is the tool behind reviewer-credibility and review-network work that the review feed alone cannot do. It reads one person's public review history, so use the results within Google's terms and the law that applies to you.

### Get place photos

[`hasdata_google_maps_photos_getMapPhotos`](https://docs.hasdata.com/apis/google-maps/photos?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp)

The photo feed for a place.

| Parameter | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `placeId` | string | | The place. Either `placeId` or `dataId` has to be present |
| `dataId` | string | | The place as a `dataId` instead |
| `categoryId` | string | | Filter to one category, using an `id` from the `categories` array |
| `hl` | string | | Language code |
| `nextPageToken` | string | | Token from the previous response |

Returns a `categories` array (`All`, `Latest`, `Videos`, `Menu` and place-specific ones), a `photos` array where each entry has `image` and `thumbnail` URLs, and `pagination`.

### Get place posts

[`hasdata_google_maps_posts_getMapPosts`](https://docs.hasdata.com/apis/google-maps/posts?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp)

The business's own posts and updates on its Google listing.

| Parameter | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `placeId` | string | | The place. Either `placeId` or `dataId` has to be present |
| `dataId` | string | | The place as a `dataId` instead |
| `hl` | string | | Language code |
| `nextPageToken` | string | | Token from the previous response |

Returns a `posts` array.

> Most places post nothing, so an empty `posts` array is the common case. Read the length before assuming a post is there.

## Errors and failure paths

Your client almost never sees an HTTP error code from a tool call. The MCP layer answers 200 and puts the failure inside the result, with `isError` set to `true` and the reason as text. The agent reads a message where you might expect a status line.

**A wrong key surfaces as tool output, not as a failed connection.** Listing tools accepts any non-empty key, and the client completes its handshake and shows green. The first tool call then comes back with `isError: true` and the text `HasData API error: 401 Unauthorized`. Watch for that string, because nothing earlier in the flow reports the problem.

The one real HTTP error is a **missing key**. Authorization runs before any tool, and the connection itself fails with 401.

**An argument that breaks the schema is rejected before it becomes a request.** A search with no `q` comes back with `isError: true` and the text `MCP error -32602: Input validation error`, naming the field. Nothing is fetched and nothing is charged.

**A review, photo or post call needs a place.** Those three take `placeId` or `dataId`, and sending neither returns 422 naming both fields, because the requirement is conditional and the schema cannot express it as a plain required list. Pass one.

**A place id that does not resolve is a clean error, not empty data.** It returns `isError: true` with `HasData API error: 400 Bad Request` and `requestMetadata.status` set to `error`. Test the flag rather than the array length.

**Empty `posts` is real data.** Most listings carry no posts, so the call succeeds with `status` `ok` and an empty array. The place simply has nothing posted.

Results that carry data also carry a `requestMetadata.id` worth quoting in support, plus `html` and `json` links to the stored artifact of that exact call.

## Pricing, free tier and limits

Search, place details, reviews, contributor reviews and photos cost **5 credits per successful call**. Posts cost **10**. Response size does not change the price. A full page of reviews costs the same as a page with one.

The free trial is **1,000 credits over 30 days with no card**, which is 200 calls at the 5-credit rate. After that an active account keeps getting 100 credits topped up each day whenever its balance drops below 100, so a low-volume agent runs on the free tier indefinitely.

Paid plans start at **$49 a month** for 200,000 credits, which is 40,000 five-credit calls. The price per credit falls with volume, and current numbers live on the [pricing page](https://hasdata.com/prices?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp).

Your plan also sets concurrency. The free trial allows 1 request at a time, Startup 15, Business 30, Growth 50, and the high-volume plans run from 200 to 1,500. Concurrency is the only throttle. There is no separate requests-per-minute cap, and the trial is not slowed or trimmed in any other way. Handle the overflow case defensively in anything unattended, because an agent that fans out across places will reach the ceiling before you do.

Paging costs a call each time. Reviews come about ten to a page, so a hundred reviews is roughly ten calls and 50 credits, while photos come twenty to a page. The trial goes a long way before you feel it.

## Tool selection

`?apis=google_maps` exposes exactly these six tools. The parameter takes a list, and `?apis=google_maps,google_serp` adds Google search alongside the maps tools. Drop the parameter and you get everything HasData exposes, which is currently 57 tools.

A narrow list is usually the better default. A model choosing among six tools picks correctly more often than one choosing among fifty-seven, and the tool descriptions themselves cost context on every turn.

## How it compares

Almost every other Google Maps MCP server wraps the official Google Maps Platform, and that is the real choice to weigh.

Those servers call the Places, Routes and Geocoding APIs with your own Google Cloud credentials. To run one you create a Google Cloud project, enable billing with a card, turn on each API, and manage a key and its quotas. That is the right tool when you want routing, geocoding and address validation, which this server does not do.

This server reads what Google Maps shows a visitor, and returns it parsed. There is no Google Cloud project, no billing to enable, and no per-API quota to manage. It also reaches data the Places API does not hand out: the full review feed rather than a small fixed sample, a single reviewer's whole history, the photo feed, and the business's posts.

| | Official Platform wrapper | This server |
| :--- | :--- | :--- |
| What you set up | A Google Cloud project, billing, per-API keys and quotas | One API key, once |
| Routing, geocoding, address validation | Yes | Not offered |
| Reviews | A small fixed sample per place | The feed, paged, with topic clusters |
| A reviewer's history | Not available | Yes, by `contributorId` |
| Photos and posts | Limited | Photo feed and the business's posts |
| Output | JSON per the Platform schema | JSON parsed from what a visitor sees |
| Cost | Google's per-call pricing on your bill | 5 credits a call, 10 for posts |

The decision comes down to two rows. If you need directions or to turn an address into coordinates, this server cannot help you and the Platform can. If you need the reviews behind the first few, or who a reviewer is across every place they rated, the Platform cannot help you and this can.

**What this server does not do.** No routing, no geocoding, no address validation, no distance matrix, and nothing that writes. It reads the map.

## FAQ

### What is a Google Maps MCP server?

A server that exposes Google Maps data as tools an AI client can call. The client sends a tool call over the Model Context Protocol, the server fetches the data and returns structured JSON, and the model works with the result and never sees a page of HTML. This one exposes six read-only tools and runs remotely. The client connects to a URL and starts no local process.

### Is there an official Google Maps MCP server?

Google publishes no general-purpose one. There is the Google Maps Platform, a set of paid APIs you call with your own Cloud project, and several community MCP servers wrap it. This server is a hosted alternative that needs no Cloud project.

### Do I need a Google Cloud project or a Maps API key?

No. The only credential is your HasData key. There is no Google Cloud project to create, no billing to enable and no per-API quota to manage.

### What is the difference between `placeId` and `dataId`?

They are two ids Google uses for the same place. Search returns both on every result, and the detail, review, photo and post tools accept either. Keep whichever you like from the search result and reuse it.

### How do I get every review, not just the first page?

Read `pagination.nextPageToken` from each response and pass it back as `nextPageToken` until it stops coming. Each page is one call.

### Do I need to host or run anything?

No. This is a remote MCP server on streamable HTTP. Nothing to install, no Python environment, no process to restart.

### Is the data live or cached?

Live. Each call fetches at request time and carries its own `requestMetadata.id`. Two identical calls are two separate fetches and not a replay of a stored copy.

### Can I use one server for several Google surfaces?

Yes. The `apis` parameter takes a list, and `?apis=google_maps,google_serp` gives your agent the maps tools plus Google search at once.

### Does the API key expire?

No. The key does not expire. Rotate it in the dashboard whenever you need to.

### Is this affiliated with Google?

No. HasData is an independent service and is not affiliated with, endorsed by, or sponsored by Google. Google and Google Maps are trademarks of their respective owner. The tools work with publicly available data only, and you are responsible for using the results in line with Google's terms and the law that applies to you.

## HasData links

| | |
| :--- | :--- |
| Product pages | [Search](https://hasdata.com/apis/google-maps-search-api?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp), [Reviews](https://hasdata.com/apis/google-maps-reviews-api?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp), [Photos](https://hasdata.com/apis/google-maps-photos-api?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp) and [Posts](https://hasdata.com/apis/google-maps-posts-api?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp) |
| Server documentation | [MCP server docs](https://docs.hasdata.com/mcp-server?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp) |
| All 57 tools in one server | [HasData/hasdata-mcp](https://github.com/HasData/hasdata-mcp) |
| Client walkthroughs | [MCP clients and integrations](https://hasdata.com/integrations/mcp?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp) |
| The other surfaces we parse | [53 more scraper APIs](https://hasdata.com/apis/?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp) |
| Plans and credit costs | [Plans and credit costs](https://hasdata.com/prices?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp) |
| Keys and usage | [HasData dashboard](https://app.hasdata.com?utm_source=github&utm_medium=syndication&utm_campaign=google-maps-mcp) |

## Development

This repository is configuration and documentation for a remote server. There is no build step and nothing to containerize.

It does carry a contract test. The README promises six tools with specific parameters, and the upstream tool list can change without a commit here, which would leave this file quietly lying to you. The test asserts the promise and runs weekly in CI as well as on every push.

```bash
HASDATA_API_KEY=your_key_here npm test
```

On PowerShell:

```powershell
$env:HASDATA_API_KEY = "your_key_here"; npm test
```

The last check makes a real call and costs 5 credits, which is the price of a canary that can fail for the right reason. Listing tools succeeds with any non-empty key, and a test that only lists tools stays green with a revoked one.

## Contributing

Corrections to the tool tables and the response samples are the most useful contribution, because those are the parts that drift. Include the call you made and the response you got. Pull requests from forks run the suite without a key, and the live checks skip instead of going red.

## License

MIT. See [LICENSE](LICENSE).
