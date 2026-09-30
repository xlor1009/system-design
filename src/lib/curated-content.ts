/** Curated weekly bank: our prompt rewrite + link out. Never paste scraped solutions. */

export const ROADMAP_SOURCE_URL = "https://roadmap.sh/system-design";

export type RoadmapSeed = {
  topic: string;
  notesMd?: string;
  sourceUrl: string;
};

export type CuratedProblemSeed = {
  slug: string;
  title: string;
  sourceUrl: string;
  sourceRoadmapTopic: string;
  timeboxMinutes: number;
  promptMd: string;
  adminOutlineMd: string;
};

export const ROADMAP_TOPICS: RoadmapSeed[] = [
  {
    topic: "Requirements & estimation",
    notesMd: "Clarify functional/non-functional needs; rough capacity math.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "Load balancer & reverse proxy",
    notesMd: "Traffic entry, health checks, TLS termination.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "Caching (CDN + Redis)",
    notesMd: "Hot keys, TTL, cache invalidation.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "Database sharding & replication",
    notesMd: "Read replicas, partition keys, consistency tradeoffs.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "URL shortener deep dive",
    notesMd: "IDs, redirect path, analytics.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "Message queues & async processing",
    notesMd: "Decouple producers/consumers; retries; DLQ.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "Rate limiting",
    notesMd: "Client identity, window algorithms, distributed limiters.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "Consistent hashing",
    notesMd: "Rebalancing with minimal key movement.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "Blob storage & CDN",
    notesMd: "Large objects, upload flow, edge delivery.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
  {
    topic: "Observability & SLOs",
    notesMd: "Metrics, logs, traces; error budgets.",
    sourceUrl: ROADMAP_SOURCE_URL,
  },
];

function deliverablesBlock(minutes: number): string {
  return `## Deliverables
1. Diagram of components and data flow
2. Spoken walkthrough (live interview or transcript)
3. Short caption for the diagram

Timebox: ${minutes} minutes.`;
}

/** ~12 practice weeks from systemdesign.io titles — prompts are ours. */
export const CURATED_PROBLEMS: CuratedProblemSeed[] = [
  {
    slug: "url-shortener-2026-w40",
    title: "Design a URL Shortener",
    sourceUrl:
      "https://systemdesign.io/question/design-url-shortening-service-like-tinyurl",
    sourceRoadmapTopic: "URL shortener deep dive",
    timeboxMinutes: 45,
    promptMd: `# Design a URL Shortener

Build a service that takes long URLs and returns short links.

## Goals
- Create short URLs
- Redirect short URLs to originals
- Track click counts (optional stretch)

## Constraints
- 100M new URLs / month
- Read-heavy (100:1)
- 99.9% availability
- Latency under 100ms for redirects

${deliverablesBlock(45)}`,
    adminOutlineMd: `## Admin outline
- Hash vs base62 counter
- DB schema (short_code, long_url, created_at, clicks)
- Cache hot redirects
- Analytics async via queue`,
  },
  {
    slug: "rate-limiter-2026-w41",
    title: "Design an API Rate Limiter",
    sourceUrl: "https://systemdesign.io/question/design-an-api-rate-limiter",
    sourceRoadmapTopic: "Rate limiting",
    timeboxMinutes: 45,
    promptMd: `# Design an API Rate Limiter

Build a service that limits how often clients can call an API.

## Goals
- Cap requests per client over a time window
- Reject or delay excess traffic with a clear response
- Work across many API servers

## Discuss
- How you identify the client (user, IP, API key)
- Algorithm choice and tradeoffs
- Scaling across a distributed fleet
- What happens if the limiter store fails

${deliverablesBlock(45)}`,
    adminOutlineMd: `## Admin outline
- Token bucket / sliding window / fixed window tradeoffs
- Redis or similar shared counter store
- Sticky vs global limits; race conditions
- Fail open vs fail closed`,
  },
  {
    slug: "pastebin-2026-w42",
    title: "Design Pastebin",
    sourceUrl: "https://systemdesign.io/question/design-pastebin",
    sourceRoadmapTopic: "Blob storage & CDN",
    timeboxMinutes: 45,
    promptMd: `# Design Pastebin

Users paste text (or small files) and get a shareable link that others can read.

## Goals
- Create a paste → unique URL
- Read paste by URL
- Optional expiry and private pastes

## Discuss
- Storage for content vs metadata
- ID generation and URL design
- Hot reads / CDN
- Abuse and size limits

${deliverablesBlock(45)}`,
    adminOutlineMd: `## Admin outline
- Object store for body; DB for metadata
- Short IDs; expiry job
- Cache popular pastes
- Rate limit create`,
  },
  {
    slug: "key-value-store-2026-w43",
    title: "Design a Key-Value Store",
    sourceUrl: "https://systemdesign.io/question/design-a-keyvalue-store",
    sourceRoadmapTopic: "Consistent hashing",
    timeboxMinutes: 50,
    promptMd: `# Design a Key-Value Store

Build a distributed key-value store with get/put (and optional delete).

## Goals
- Low-latency get/put
- Survive machine failures
- Scale by adding nodes

## Discuss
- Data partitioning and replication
- Consistency model you choose and why
- Failure detection and repair
- Hot keys

${deliverablesBlock(50)}`,
    adminOutlineMd: `## Admin outline
- Consistent hashing + virtual nodes
- Quorum reads/writes
- Leader vs leaderless
- Compaction / TTL if mentioned`,
  },
  {
    slug: "dropbox-2026-w44",
    title: "Design Dropbox or Google Drive",
    sourceUrl: "https://systemdesign.io/question/design-dropbox-or-google-drive",
    sourceRoadmapTopic: "Blob storage & CDN",
    timeboxMinutes: 50,
    promptMd: `# Design Dropbox or Google Drive

Users upload files, sync across devices, and share with others.

## Goals
- Upload / download / sync
- Versioning or conflict handling
- Sharing permissions (stretch)

## Discuss
- Chunking and dedup
- Metadata DB vs blob storage
- Sync protocol (delta vs full)
- Large-file and offline cases

${deliverablesBlock(50)}`,
    adminOutlineMd: `## Admin outline
- Chunk store + file metadata
- Block-level sync
- Notification for remote changes
- ACL on shares`,
  },
  {
    slug: "messenger-2026-w45",
    title: "Design Facebook Messenger or WhatsApp",
    sourceUrl:
      "https://systemdesign.io/question/design-facebook-messenger-or-whatsapp",
    sourceRoadmapTopic: "Message queues & async processing",
    timeboxMinutes: 50,
    promptMd: `# Design Facebook Messenger or WhatsApp

1:1 (and optionally group) messaging with near-real-time delivery.

## Goals
- Send and receive messages
- Online and offline delivery
- Read receipts or presence (stretch)

## Discuss
- Connection model (WebSocket / long poll)
- Message storage and fan-out
- Ordering and idempotency
- Scale to millions of concurrent users

${deliverablesBlock(50)}`,
    adminOutlineMd: `## Admin outline
- Gateway + session store
- Per-user inbox / queue
- Push for offline
- Group chat fan-out choices`,
  },
  {
    slug: "twitter-2026-w46",
    title: "Design Twitter for millions of users",
    sourceUrl:
      "https://systemdesign.io/question/design-twitter-for-millions-of-users",
    sourceRoadmapTopic: "Caching (CDN + Redis)",
    timeboxMinutes: 50,
    promptMd: `# Design Twitter for millions of users

Users post short updates and follow others to build a home timeline.

## Goals
- Post a tweet
- Follow / unfollow
- Home timeline and user profile timeline

## Discuss
- Fan-out on write vs read
- Celebrity / hot-user problem
- Caching and ranking (simple is fine)
- Storage schema sketch

${deliverablesBlock(50)}`,
    adminOutlineMd: `## Admin outline
- Tweet + follow graph stores
- Fan-out on write for normal users
- Hybrid for celebrities
- Timeline cache`,
  },
  {
    slug: "youtube-2026-w47",
    title: "Design YouTube or Netflix",
    sourceUrl: "https://systemdesign.io/question/design-youtube-or-netflix",
    sourceRoadmapTopic: "Blob storage & CDN",
    timeboxMinutes: 50,
    promptMd: `# Design YouTube or Netflix

Upload (or ingest) video, process it, and stream playback worldwide.

## Goals
- Upload / ingest
- Transcode to multiple bitrates
- Adaptive streaming to viewers

## Discuss
- Processing pipeline
- CDN and edge caching
- Metadata and search (light touch OK)
- Cost and cold storage

${deliverablesBlock(50)}`,
    adminOutlineMd: `## Admin outline
- Object store + transcode workers
- Manifest / ABR
- CDN as primary read path
- Metadata DB`,
  },
  {
    slug: "typeahead-2026-w48",
    title: "Design Typeahead / Autocomplete",
    sourceUrl:
      "https://systemdesign.io/question/design-typeahead-suggestion-autocomplete",
    sourceRoadmapTopic: "Caching (CDN + Redis)",
    timeboxMinutes: 45,
    promptMd: `# Design Typeahead Suggestion / Autocomplete

As the user types, show ranked suggestions with low latency.

## Goals
- Prefix search suggestions
- Personalization or popularity ranking (stretch)
- Update index as new terms appear

## Discuss
- Trie / inverted index / search service
- Caching at the edge
- Ranking signals
- Handling typos (optional)

${deliverablesBlock(45)}`,
    adminOutlineMd: `## Admin outline
- Prefix index (trie or ES)
- Top-K per prefix cache
- Async index updates
- Latency budget <100ms`,
  },
  {
    slug: "news-feed-2026-w49",
    title: "Design Facebook's News Feed",
    sourceUrl: "https://systemdesign.io/question/design-facebooks-news-feed",
    sourceRoadmapTopic: "Caching (CDN + Redis)",
    timeboxMinutes: 50,
    promptMd: `# Design Facebook's News Feed

Show a personalized stream of posts from friends and pages.

## Goals
- Publish a post
- Fetch a member's feed quickly
- Rough ranking / freshness

## Discuss
- Fan-out strategy
- Feed storage and pagination
- Ranking inputs (simple model OK)
- Cache invalidation

${deliverablesBlock(50)}`,
    adminOutlineMd: `## Admin outline
- Feed cache per user
- Fan-out on write vs pull
- Ranking service light touch
- Media via CDN`,
  },
  {
    slug: "web-crawler-2026-w50",
    title: "Design a Web Crawler",
    sourceUrl: "https://systemdesign.io/question/design-web-crawler",
    sourceRoadmapTopic: "Message queues & async processing",
    timeboxMinutes: 45,
    promptMd: `# Design a Web Crawler

Discover and fetch pages across the web (or a large domain set) for indexing.

## Goals
- Frontier of URLs to crawl
- Fetch, parse, extract links
- Respect politeness / robots (discuss)

## Discuss
- URL frontier and dedup
- Parallelism and per-host limits
- Storage of raw pages and extracted links
- Failure and retry

${deliverablesBlock(45)}`,
    adminOutlineMd: `## Admin outline
- Priority frontier queue
- Seen-URL store
- Worker pool + politeness
- Parser → link extractor`,
  },
  {
    slug: "notification-service-2026-w51",
    title: "Design a Notification Service at Scale",
    sourceUrl:
      "https://systemdesign.io/question/design-a-notification-service-at-scale",
    sourceRoadmapTopic: "Message queues & async processing",
    timeboxMinutes: 45,
    promptMd: `# Design a Notification Service at Scale

Apps send notifications to users across push, email, and/or SMS.

## Goals
- Accept notify requests from many product services
- Deliver across channels with templates
- Handle spikes without dropping critical alerts

## Discuss
- Ingest API and auth
- Queues / priorities
- Provider adapters and retries
- User preferences and quiet hours

${deliverablesBlock(45)}`,
    adminOutlineMd: `## Admin outline
- Ingest → topic queues by channel
- Template + preference service
- Idempotent delivery keys
- DLQ and backoff`,
  },
];
