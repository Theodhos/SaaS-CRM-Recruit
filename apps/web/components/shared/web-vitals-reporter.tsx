'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Sends real-user Core Web Vitals (LCP, INP, CLS, TTFB, FCP) to the API, which records them as Prometheus histograms
 * (Grafana: "Frontend (Core Web Vitals)"). Renders nothing and has no effect on the UI.
 *
 * Sampled once per page load (NEXT_PUBLIC_WEB_VITALS_SAMPLE, default 25 %) so it adds a handful of tiny requests for only
 * a fraction of visits. It never carries a URL, user or tenant id — only the metric name, its value and rating.
 */
const SAMPLE_RATE = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE ?? 0.25);
const ENDPOINT = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/telemetry/web-vitals` : null;
const REPORTED = new Set(['LCP', 'INP', 'CLS', 'TTFB', 'FCP']);

let sampledIn: boolean | undefined;

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!ENDPOINT || !REPORTED.has(metric.name)) return;
    sampledIn ??= Math.random() < SAMPLE_RATE;
    if (!sampledIn) return;

    // keepalive lets the request finish while the page is being hidden/unloaded (INP and CLS finalise then).
    void fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating }),
    }).catch(() => undefined);
  });

  return null;
}
