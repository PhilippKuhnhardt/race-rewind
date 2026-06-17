/* global __ENV */
import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'https://racerewind.org').replace(/\/$/, '');
const PROFILE = __ENV.PROFILE || 'smoke';
const THINK_TIME_MIN = Number(__ENV.THINK_TIME_MIN || '1');
const THINK_TIME_MAX = Number(__ENV.THINK_TIME_MAX || '4');

const staticPageDuration = new Trend('static_page_duration', true);
const ssrPageDuration = new Trend('ssr_page_duration', true);
const pageFailed = new Rate('page_failed');

const smokeStages = [
  { duration: '30s', target: 1 },
  { duration: '1m', target: 5 },
  { duration: '30s', target: 0 },
];

const baselineStages = [
  { duration: '1m', target: 10 },
  { duration: '5m', target: 10 },
  { duration: '1m', target: 0 },
];

const rampStages = [
  { duration: '2m', target: 100 },
  { duration: '2m', target: 1000 },
  { duration: '2m', target: 2500 },
  { duration: '2m', target: 5000 },
  { duration: '3m', target: 0 },
];

const stressStages = [
  ...rampStages.slice(0, -1),
  { duration: '2m', target: 7500 },
  { duration: '5m', target: 7500 },
  { duration: '2m', target: 10000 },
  { duration: '5m', target: 10000 },
  { duration: '2m', target: 15000 },
  { duration: '5m', target: 15000 },
  { duration: '2m', target: 20000 },
  { duration: '5m', target: 20000 },
  { duration: '3m', target: 0 },
];

const viralStages = [
  { duration: '3m', target: 1000 },
  { duration: '5m', target: 1000 },
  { duration: '3m', target: 5000 },
  { duration: '5m', target: 5000 },
  { duration: '3m', target: 10000 },
  { duration: '5m', target: 10000 },
  { duration: '3m', target: 20000 },
  { duration: '5m', target: 20000 },
  { duration: '3m', target: 30000 },
  { duration: '5m', target: 30000 },
  { duration: '3m', target: 50000 },
  { duration: '5m', target: 50000 },
  { duration: '3m', target: 0 },
];

const profiles = {
  smoke: smokeStages,
  baseline: baselineStages,
  ramp: rampStages,
  stress: stressStages,
  viral: viralStages,
};

if (!profiles[PROFILE]) {
  throw new Error(`Unknown PROFILE "${PROFILE}". Use smoke, baseline, ramp, stress, or viral.`);
}

export const options = {
  scenarios: {
    browsing: {
      executor: 'ramping-vus',
      stages: profiles[PROFILE],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    page_failed: ['rate<0.05'],
    'http_req_duration{page_type:static}': ['p(95)<1000'],
    'http_req_duration{page_type:ssr}': ['p(95)<2000'],
  },
  userAgent: 'RaceRewindLoadTest/1.0',
};

const racePages = [
  '/seasons/2025/australian-grand-prix/',
  '/seasons/2025/monaco-grand-prix/',
  '/seasons/2025/british-grand-prix/',
  '/seasons/2024/bahrain-grand-prix/',
  '/seasons/2024/abu-dhabi-grand-prix/',
  '/seasons/2012/brazilian-grand-prix/',
  '/seasons/2007/brazilian-grand-prix/',
  '/seasons/1994/australian-grand-prix/',
];

const raceSubpages = [
  'standings/',
  'drivers/',
  'teams/',
  'qualifying/',
  'grid/',
  'race/',
  'season/',
];

const driverPages = [
  '/drivers/max-verstappen/2025/australian-grand-prix/',
  '/drivers/lewis-hamilton/2025/australian-grand-prix/',
  '/drivers/fernando-alonso/2025/monaco-grand-prix/',
  '/drivers/michael-schumacher/2012/brazilian-grand-prix/',
  '/drivers/ayrton-senna/1994/australian-grand-prix/',
];

const teamPages = [
  '/teams/ferrari/2025/australian-grand-prix/',
  '/teams/mclaren/2025/australian-grand-prix/',
  '/teams/mercedes/2025/british-grand-prix/',
  '/teams/williams/1994/australian-grand-prix/',
];

const comparePages = [
  '/compare/max-verstappen/lewis-hamilton/2025/australian-grand-prix/',
  '/compare/lewis-hamilton/fernando-alonso/2025/monaco-grand-prix/',
  '/compare/fernando-alonso/michael-schumacher/2012/brazilian-grand-prix/',
];

const journeys = [
  () => {
    requestPage('/', 'static', 'home');
    think();
    const race = randomItem(racePages);
    requestPage(race, 'static', 'race-overview');
    think();
    requestPage(`${race}${randomItem(raceSubpages)}`, 'static', 'race-subpage');
  },
  () => {
    const race = randomItem(racePages);
    requestPage(race, 'static', 'race-overview');
    think();
    requestPage(randomItem(driverPages), 'ssr', 'driver');
    think();
    requestPage(randomItem(teamPages), 'ssr', 'team');
  },
  () => {
    requestPage('/compare/', 'static', 'compare-index');
    think();
    requestPage(randomItem(comparePages), 'ssr', 'compare-detail');
  },
];

export default function () {
  group('anonymous browsing', () => {
    randomItem(journeys)();
  });
}

function requestPage(path, pageType, name) {
  const response = http.get(`${BASE_URL}${path}`, {
    tags: {
      name,
      page_type: pageType,
      path,
    },
    timeout: '15s',
  });

  const ok = check(response, {
    'status is 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
  });

  pageFailed.add(!ok, { page_type: pageType, name });

  if (pageType === 'ssr') {
    ssrPageDuration.add(response.timings.duration, { name, path });
  } else {
    staticPageDuration.add(response.timings.duration, { name, path });
  }
}

function think() {
  const min = Math.max(0, THINK_TIME_MIN);
  const max = Math.max(min, THINK_TIME_MAX);
  sleep(min + Math.random() * (max - min));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
