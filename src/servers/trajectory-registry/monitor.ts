import * as fs from "fs";
import * as path from "path";
import express from "express";
import { makeDir } from "../../mol-util/make-dir";
import { Config } from "./config";

export type TrajectoryRequestEndpoint =
  | "list"
  | "create"
  | "read-file"
  | "upload"
  | "delete"
  | "starts"
  | "frame-offset"
  | "frame-start"
  | "frame-range";

export type TrajectoryRequestDescriptor = {
  endpoint: TrajectoryRequestEndpoint;
  trajectoryId?: string;
  start?: number;
  end?: number | "Infinity";
};

export type TrajectoryRequestLogEntry = {
  ts: string;
  kind: "trajectory-request";
  method: string;
  path: string;
  endpoint: TrajectoryRequestEndpoint;
  trajectoryId?: string;
  start?: number;
  end?: number | "Infinity";
  status: number;
  durationMs: number;
  ip: string;
  message: string;
};

export type TrajectoryRequestBucket = {
  ts: string;
  count: number;
  errors: number;
  groups: {
    endpoint: TrajectoryRequestEndpoint;
    count: number;
    errors: number;
  }[];
};

export type TrajectoryRequestMetrics = {
  from: string;
  to: string;
  bucket: string;
  totalRequests: number;
  totalErrors: number;
  series: TrajectoryRequestBucket[];
  endpoints: { endpoint: TrajectoryRequestEndpoint; count: number }[];
};

const EndpointOrder: TrajectoryRequestEndpoint[] = [
  "starts",
  "frame-offset",
  "frame-start",
  "frame-range",
  "list",
  "create",
  "read-file",
  "upload",
  "delete",
];

export function getTrajectoryMonitorDirectory(config: Config) {
  return path.join(config.working_folder, "logs");
}

export function getTrajectoryRequestLogPath(config: Config) {
  return path.join(getTrajectoryMonitorDirectory(config), "requests.jsonl");
}

export function ensureTrajectoryMonitorDirectory(config: Config) {
  const dir = getTrajectoryMonitorDirectory(config);
  if (!fs.existsSync(dir)) makeDir(dir);
}

export function appendTrajectoryRequestLog(
  config: Config,
  entry: TrajectoryRequestLogEntry,
) {
  ensureTrajectoryMonitorDirectory(config);
  fs.appendFileSync(
    getTrajectoryRequestLogPath(config),
    `${JSON.stringify(entry)}\n`,
    "utf-8",
  );
}

export function describeTrajectoryRequest(
  method: string,
  pathname: string,
  apiRoot: string,
): TrajectoryRequestDescriptor | void {
  if (
    pathname === `${apiRoot}/monitor/requests` ||
    pathname === `${apiRoot}/monitor/plot`
  )
    return void 0;

  if (pathname === apiRoot) {
    if (method === "GET") return { endpoint: "list" };
    if (method === "POST") return { endpoint: "create" };
    return void 0;
  }

  if (!pathname.startsWith(`${apiRoot}/`)) return void 0;
  const relative = pathname.slice(apiRoot.length);

  let match = /^\/([^/]+)$/.exec(relative);
  if (match) {
    if (method === "GET")
      return { endpoint: "read-file", trajectoryId: match[1] };
    if (method === "PUT") return { endpoint: "upload", trajectoryId: match[1] };
    if (method === "DELETE")
      return { endpoint: "delete", trajectoryId: match[1] };
    return void 0;
  }

  match = /^\/([^/]+)\/starts$/.exec(relative);
  if (match && method === "GET")
    return { endpoint: "starts", trajectoryId: match[1] };

  match = /^\/([^/]+)\/frame\/offset\/([^/]+)\/([^/]+)$/.exec(relative);
  if (match && method === "GET")
    return {
      endpoint: "frame-offset",
      trajectoryId: match[1],
      start: parseMonitorStart(match[2]),
      end: parseMonitorEnd(match[3]),
    };

  match = /^\/([^/]+)\/frame\/start\/([^/]+)$/.exec(relative);
  if (match && method === "GET")
    return {
      endpoint: "frame-start",
      trajectoryId: match[1],
      start: parseMonitorStart(match[2]),
    };

  match = /^\/([^/]+)\/frame-range\/index\/([^/]+)\/([^/]+)$/.exec(relative);
  if (match && method === "GET")
    return {
      endpoint: "frame-range",
      trajectoryId: match[1],
      start: parseMonitorStart(match[2]),
      end: parseMonitorEnd(match[3]),
    };

  return void 0;
}

function parseMonitorStart(value: string) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return void 0;
  return parsed;
}

function parseMonitorEnd(value: string) {
  if (value === "Infinity") return "Infinity" as const;
  return parseMonitorStart(value);
}

export function getRequestClientIp(req: express.Request) {
  const forwarded = req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.header("x-real-ip");
  if (real) return real.trim();
  return req.socket.remoteAddress || "unknown";
}

export function defaultMonitorMessage(status: number) {
  if (status >= 500) return "server-error";
  if (status >= 400) return "request-error";
  return "ok";
}

export function aggregateTrajectoryRequestLogs(
  config: Config,
  query: {
    from?: string;
    to?: string;
    bucket?: string;
    trajectoryId?: string;
    endpoint?: string;
    status?: string;
  },
) {
  const now = Date.now();
  const toMs = parseTime(query.to, now, "to");
  const fromMs = parseTime(query.from, toMs - 24 * 60 * 60 * 1000, "from");
  const bucket = query.bucket || "1h";
  const bucketSpec = parseBucket(bucket);

  if (fromMs >= toMs)
    throw new Error('Query parameter "from" must be earlier than "to".');

  const statusFilter = query.status ? parseInt(query.status, 10) : void 0;
  if (query.status && Number.isNaN(statusFilter))
    throw new Error(
      'Query parameter "status" must be an integer HTTP status code.',
    );

  const endpointFilter = query.endpoint as
    | TrajectoryRequestEndpoint
    | undefined;
  const lines = readTrajectoryRequestLogs(config);
  const bucketTimeline = createBucketTimeline(fromMs, toMs, bucketSpec);
  const bucketMap = new Map<
    string,
    {
      ts: number;
      count: number;
      errors: number;
      groups: Map<TrajectoryRequestEndpoint, { count: number; errors: number }>;
    }
  >();
  const endpointCounts = new Map<TrajectoryRequestEndpoint, number>();

  for (const bucketStart of bucketTimeline) {
    const groups = new Map<
      TrajectoryRequestEndpoint,
      { count: number; errors: number }
    >();
    for (const endpoint of EndpointOrder)
      groups.set(endpoint, { count: 0, errors: 0 });
    bucketMap.set(bucketStart.toISOString(), {
      ts: bucketStart.getTime(),
      count: 0,
      errors: 0,
      groups,
    });
  }

  let totalRequests = 0;
  let totalErrors = 0;

  for (const entry of lines) {
    const ts = Date.parse(entry.ts);
    if (Number.isNaN(ts) || ts < fromMs || ts >= toMs) continue;
    if (query.trajectoryId && entry.trajectoryId !== query.trajectoryId)
      continue;
    if (endpointFilter && entry.endpoint !== endpointFilter) continue;
    if (statusFilter !== void 0 && entry.status !== statusFilter) continue;

    totalRequests++;
    if (entry.status >= 400) totalErrors++;

    const bucketKey = getBucketKey(new Date(ts), bucketSpec);
    const target = bucketMap.get(bucketKey);
    if (target) {
      target.count++;
      if (entry.status >= 400) target.errors++;
      const group = target.groups.get(entry.endpoint);
      if (group) {
        group.count++;
        if (entry.status >= 400) group.errors++;
      }
    }
    endpointCounts.set(
      entry.endpoint,
      (endpointCounts.get(entry.endpoint) || 0) + 1,
    );
  }

  const series: TrajectoryRequestBucket[] = [];
  for (const counts of Array.from(bucketMap.values()).sort(
    (a, b) => a.ts - b.ts,
  )) {
    series.push({
      ts: new Date(counts.ts).toISOString(),
      count: counts.count,
      errors: counts.errors,
      groups: EndpointOrder.map((endpoint) => {
        const group = counts.groups.get(endpoint)!;
        return { endpoint, count: group.count, errors: group.errors };
      }),
    });
  }

  const endpoints = Array.from(endpointCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([endpoint, count]) => ({ endpoint, count }));

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    bucket,
    totalRequests,
    totalErrors,
    series,
    endpoints,
  } as TrajectoryRequestMetrics;
}

function readTrajectoryRequestLogs(config: Config) {
  const logPath = getTrajectoryRequestLogPath(config);
  if (!fs.existsSync(logPath)) return [] as TrajectoryRequestLogEntry[];

  const raw = fs.readFileSync(logPath, "utf-8");
  const entries: TrajectoryRequestLogEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as TrajectoryRequestLogEntry;
      if (parsed && parsed.kind === "trajectory-request") entries.push(parsed);
    } catch {
      continue;
    }
  }
  return entries;
}

function parseTime(
  value: string | undefined,
  fallback: number,
  field: "from" | "to",
) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed))
    throw new Error(
      `Query parameter "${field}" must be a valid ISO date string.`,
    );
  return parsed;
}

function parseBucket(value: string) {
  const match = /^(\d+)(m|h|d)$/.exec(value);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    if (amount <= 0)
      throw new Error('Query parameter "bucket" must be greater than zero.');
    if (unit === "m")
      return { kind: "fixed" as const, sizeMs: amount * 60 * 1000 };
    if (unit === "h")
      return { kind: "fixed" as const, sizeMs: amount * 60 * 60 * 1000 };
    return { kind: "fixed" as const, sizeMs: amount * 24 * 60 * 60 * 1000 };
  }

  const monthMatch = /^(\d+)month$/.exec(value);
  if (monthMatch) {
    const amount = parseInt(monthMatch[1], 10);
    if (amount <= 0)
      throw new Error('Query parameter "bucket" must be greater than zero.');
    return { kind: "month" as const, months: amount };
  }

  throw new Error(
    'Query parameter "bucket" must use the format <number><unit> with unit m, h, d, or month.',
  );
}

function createBucketTimeline(
  fromMs: number,
  toMs: number,
  bucketSpec: ReturnType<typeof parseBucket>,
) {
  const buckets: Date[] = [];
  let cursor = alignBucketStart(new Date(fromMs), bucketSpec);
  const end = alignBucketStart(new Date(toMs), bucketSpec);

  while (cursor.getTime() <= end.getTime()) {
    buckets.push(new Date(cursor.getTime()));
    cursor = addBucket(cursor, bucketSpec);
  }

  return buckets;
}

function alignBucketStart(
  date: Date,
  bucketSpec: ReturnType<typeof parseBucket>,
) {
  if (bucketSpec.kind === "month") {
    const month =
      Math.floor(date.getUTCMonth() / bucketSpec.months) * bucketSpec.months;
    return new Date(Date.UTC(date.getUTCFullYear(), month, 1, 0, 0, 0, 0));
  }

  const alignedMs =
    Math.floor(date.getTime() / bucketSpec.sizeMs) * bucketSpec.sizeMs;
  return new Date(alignedMs);
}

function addBucket(date: Date, bucketSpec: ReturnType<typeof parseBucket>) {
  if (bucketSpec.kind === "month") {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + bucketSpec.months,
        1,
        0,
        0,
        0,
        0,
      ),
    );
  }
  return new Date(date.getTime() + bucketSpec.sizeMs);
}

function getBucketKey(date: Date, bucketSpec: ReturnType<typeof parseBucket>) {
  return alignBucketStart(date, bucketSpec).toISOString();
}

export function renderTrajectoryMonitorPage(metricsUrl: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Trajectory Request Monitor</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { font-family: Inter, system-ui, sans-serif; font-size: 13px; margin: 0; padding: 24px; background: #0b1020; color: #e8ecf3; }
    .wrap { width: 100%; max-width: none; margin: 0; }
    .panel { background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; padding: 20px; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat { background: rgba(30, 41, 59, 0.65); border-radius: 14px; padding: 14px; }
    .stat strong { display: block; font-size: 22px; margin-top: 6px; }
    .chart-panel { width: 100%; }
    .chart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .chart-controls { display: flex; align-items: center; gap: 8px; color: #94a3b8; }
    select { border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.3); background: #111827; color: #f8fafc; padding: 8px 10px; font: inherit; }
    .chart { position: relative; width: 100%; min-height: 360px; background: rgba(2, 6, 23, 0.6); border-radius: 14px; padding: 12px; }
    svg { width: 100%; height: 360px; display: block; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.15); font-size: 12px; }
    .muted { color: #94a3b8; font-size: 12px; }
    .error { color: #fca5a5; }
    .panel h2 { margin-top: 0; }
    .legend { display: flex; flex-wrap: wrap; gap: 10px 14px; margin: 10px 0 0; }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; color: #cbd5e1; font-size: 12px; }
    .legend-swatch { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
    .tooltip { position: absolute; pointer-events: none; opacity: 0; transform: translate(-50%, calc(-100% - 10px)); background: rgba(15, 23, 42, 0.96); color: #e2e8f0; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 10px; padding: 8px 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); font-size: 11px; line-height: 1.4; white-space: nowrap; z-index: 5; }
    .tooltip strong { color: #f8fafc; }
    @media (max-width: 900px) { .stats { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="panel">
      <h1>Trajectory Request Monitor</h1>
      <p class="muted">Plots aggregated trajectory request counts from the local JSONL access log. Payloads are never logged. Auto-refreshes every 1 second.</p>
    </div>
    <div class="panel">
      <h2>Endpoint totals</h2>
      <table>
        <thead><tr><th>Endpoint</th><th>Requests</th></tr></thead>
        <tbody id="endpointTable"></tbody>
        </table>
      <p id="error" class="error"></p>
    </div>
    <div class="panel chart-panel">
      <div class="chart-head"><h2>Last hour</h2><div class="chart-controls"><label for="bucket-hour">Bucket</label><select id="bucket-hour"><option value="1m" selected>1 minute</option><option value="5m">5 minutes</option><option value="15m">15 minutes</option></select></div></div>
      <div class="stats">
        <div class="stat"><span class="muted">Total requests</span><strong id="totalRequests-hour">0</strong></div>
        <div class="stat"><span class="muted">Error responses</span><strong id="totalErrors-hour">0</strong></div>
        <div class="stat"><span class="muted">Window</span><strong>1 hour</strong></div>
      </div>
      <div id="legend-hour" class="legend"></div>
      <div id="chart-hour" class="chart"></div>
      <p class="muted" id="chartNote-hour">No data yet.</p>
    </div>
    <div class="panel chart-panel">
      <div class="chart-head"><h2>Last 24 hours</h2><div class="chart-controls"><label for="bucket-day">Bucket</label><select id="bucket-day"><option value="15m">15 minutes</option><option value="1h" selected>1 hour</option><option value="6h">6 hours</option></select></div></div>
      <div class="stats">
        <div class="stat"><span class="muted">Total requests</span><strong id="totalRequests-day">0</strong></div>
        <div class="stat"><span class="muted">Error responses</span><strong id="totalErrors-day">0</strong></div>
        <div class="stat"><span class="muted">Window</span><strong>24 hours</strong></div>
      </div>
      <div id="legend-day" class="legend"></div>
      <div id="chart-day" class="chart"></div>
      <p class="muted" id="chartNote-day">No data yet.</p>
    </div>
    <div class="panel chart-panel">
      <div class="chart-head"><h2>Last 31 days</h2><div class="chart-controls"><label for="bucket-month">Bucket</label><select id="bucket-month"><option value="12h">12 hours</option><option value="1d" selected>1 day</option><option value="7d">7 days</option></select></div></div>
      <div class="stats">
        <div class="stat"><span class="muted">Total requests</span><strong id="totalRequests-month">0</strong></div>
        <div class="stat"><span class="muted">Error responses</span><strong id="totalErrors-month">0</strong></div>
        <div class="stat"><span class="muted">Window</span><strong>31 days</strong></div>
      </div>
      <div id="legend-month" class="legend"></div>
      <div id="chart-month" class="chart"></div>
      <p class="muted" id="chartNote-month">No data yet.</p>
    </div>
    <div class="panel chart-panel">
      <div class="chart-head"><h2>Last 365 days</h2><div class="chart-controls"><label for="bucket-year">Bucket</label><select id="bucket-year"><option value="7d">7 days</option><option value="1month" selected>1 month</option><option value="3month">3 months</option></select></div></div>
      <div class="stats">
        <div class="stat"><span class="muted">Total requests</span><strong id="totalRequests-year">0</strong></div>
        <div class="stat"><span class="muted">Error responses</span><strong id="totalErrors-year">0</strong></div>
        <div class="stat"><span class="muted">Window</span><strong>365 days</strong></div>
      </div>
      <div id="legend-year" class="legend"></div>
      <div id="chart-year" class="chart"></div>
      <p class="muted" id="chartNote-year">No data yet.</p>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script>
    const metricsUrl = ${JSON.stringify(metricsUrl)};
    const $ = id => document.getElementById(id);
    const endpointOrder = ${JSON.stringify(EndpointOrder)};
    const endpointColors = {
      'starts': '#38bdf8',
      'frame-offset': '#22c55e',
      'frame-start': '#a78bfa',
      'frame-range': '#f59e0b',
      'list': '#ef4444',
      'create': '#14b8a6',
      'read-file': '#f472b6',
      'upload': '#eab308',
      'delete': '#94a3b8'
    };
    const chartConfigs = [
      { key: 'hour', label: 'last hour', durationMs: 60 * 60 * 1000, bucket: '1m' },
      { key: 'day', label: 'last 24 hours', durationMs: 24 * 60 * 60 * 1000, bucket: '1h' },
      { key: 'month', label: 'last 31 days', durationMs: 31 * 24 * 60 * 60 * 1000, bucket: '1d' },
      { key: 'year', label: 'last 365 days', durationMs: 365 * 24 * 60 * 60 * 1000, bucket: '1month' }
    ];
    const hoveredCharts = new Set();

    renderLegends();

    function buildQuery(config) {
      const now = new Date();
      const from = new Date(now.getTime() - config.durationMs);
      const params = new URLSearchParams();
      params.set('from', from.toISOString());
      params.set('to', now.toISOString());
      params.set('bucket', $('bucket-' + config.key).value || config.bucket);
      return params.toString();
    }

    function formatLabel(ts, bucket) {
      const iso = new Date(ts).toISOString();
      if (bucket === '1m') return iso.slice(11, 16);
      if (bucket === '1h') return iso.slice(5, 13).replace('T', ' ');
      if (bucket === '1d') return iso.slice(5, 10);
      if (bucket === '7d' || bucket === '12h' || bucket === '6h' || bucket === '15m' || bucket === '5m') return iso.slice(5, 16).replace('T', ' ');
      return iso.slice(0, 7);
    }

    function legendMarkup() {
      return endpointOrder.map(endpoint => '<span class="legend-item"><span class="legend-swatch" style="background:' + endpointColors[endpoint] + '"></span>' + endpoint + '</span>').join('');
    }

    function renderLegends() {
      chartConfigs.forEach(config => {
        $('legend-' + config.key).innerHTML = legendMarkup();
      });
    }

    function renderChart(key, series, bucket) {
      const container = $('chart-' + key);
      const chartNote = $('chartNote-' + key);
      container.innerHTML = '';
      if (!series.length) {
        chartNote.textContent = 'No matching requests in the selected time range.';
        return;
      }
      const margin = { top: 12, right: 18, bottom: 50, left: 42 };
      const width = Math.max(container.clientWidth || 1000, 1000);
      const height = 360;
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;
      const svg = d3.select(container).append('svg').attr('viewBox', '0 0 ' + width + ' ' + height).attr('preserveAspectRatio', 'none');
      const tooltip = d3.select(container).append('div').attr('class', 'tooltip');
      const root = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      const stackInput = series.map(item => {
        const row = { ts: item.ts };
        for (const group of item.groups || []) row[group.endpoint] = group.count;
        return row;
      });
      const keys = endpointOrder.filter(endpoint => stackInput.some(item => (item[endpoint] || 0) > 0));
      const effectiveKeys = keys.length ? keys : endpointOrder;
      const stacked = d3.stack().keys(effectiveKeys)(stackInput);
      const max = d3.max(series, d => d.count) || 1;
      const x = d3.scaleBand().domain(series.map(d => d.ts)).range([0, innerWidth]).paddingInner(0.12).paddingOuter(0.04);
      const y = d3.scaleLinear().domain([0, max]).nice().range([innerHeight, 0]);

      root.append('g')
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth))
        .call(g => g.selectAll('.domain').remove())
        .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(148,163,184,0.18)'))
        .call(g => g.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', 11));

      const groups = root.selectAll('g.layer')
        .data(stacked)
        .enter()
        .append('g')
        .attr('class', 'layer')
        .attr('fill', d => endpointColors[d.key] || '#94a3b8');

      groups.selectAll('rect')
        .data(d => d.map(point => ({ key: d.key, point })))
        .enter()
        .append('rect')
        .attr('x', d => x(d.point.data.ts))
        .attr('y', d => y(d.point[1]))
        .attr('width', x.bandwidth())
        .attr('height', d => Math.max(0, y(d.point[0]) - y(d.point[1])))
        .on('mousemove', function(event, d) {
          hoveredCharts.add(key);
          const count = d.point[1] - d.point[0];
          const bucketTime = new Date(d.point.data.ts).toISOString();
          const pointer = d3.pointer(event, container);
          tooltip
            .style('opacity', count > 0 ? 1 : 0)
            .style('left', pointer[0] + 'px')
            .style('top', pointer[1] + 'px')
            .html('<div><strong>' + d.key + '</strong></div><div>Count: ' + count + '</div><div>Bucket: ' + bucketTime + '</div>');
        })
        .on('mouseleave', function() {
          hoveredCharts.delete(key);
          tooltip.style('opacity', 0);
        });

      const tickValues = series.filter((_, i) => i === 0 || i === series.length - 1 || i % Math.max(1, Math.ceil(series.length / 8)) === 0).map(d => d.ts);
      root.append('g')
        .attr('transform', 'translate(0,' + innerHeight + ')')
        .call(d3.axisBottom(x).tickValues(tickValues).tickFormat(value => formatLabel(String(value), bucket)))
        .call(g => g.selectAll('.domain').attr('stroke', 'rgba(148,163,184,0.25)'))
        .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(148,163,184,0.25)'))
        .call(g => g.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', 10));

      chartNote.textContent = 'Stacked by request type. Use the bucket selector to change aggregation granularity.';
    }

    function renderEndpoints(endpoints) {
      $('endpointTable').innerHTML = endpoints.length
        ? endpoints.map(item => '<tr><td>' + item.endpoint + '</td><td>' + item.count + '</td></tr>').join('')
        : '<tr><td colspan="2" class="muted">No matching requests.</td></tr>';
    }

    async function loadChart(config) {
      if (hoveredCharts.has(config.key)) return null;
      const response = await fetch(metricsUrl + '?' + buildQuery(config));
      const data = await response.json();
      if (!response.ok) throw new Error(data?.errors?.[0]?.message || 'Failed to load metrics.');
      $('totalRequests-' + config.key).textContent = String(data.totalRequests);
      $('totalErrors-' + config.key).textContent = String(data.totalErrors);
      renderChart(config.key, data.series || [], $('bucket-' + config.key).value || config.bucket);
      return data;
    }

    async function reload() {
      $('error').textContent = '';
      try {
        const results = await Promise.all(chartConfigs.map(loadChart));
        renderEndpoints((results[1] || results[0] || {}).endpoints || []);
      } catch (e) {
        $('error').textContent = e instanceof Error ? e.message : String(e);
      }
    }

    chartConfigs.forEach(config => $('bucket-' + config.key).addEventListener('change', reload));
    reload();
    setInterval(reload, 1000);
  </script>
</body>
</html>`;
}
