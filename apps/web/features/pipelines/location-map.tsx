'use client';

import { Button, cn, Input, Label } from '@crm/ui';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, MapPin, RotateCcw, Route } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

export interface MapPlace {
  /** What the place is — "Job", "Candidate". */
  label: string;
  /** The address or town as recorded; a blank place is left out. */
  query: string | null | undefined;
}

const clean = (query: string | null | undefined) => (query ?? '').trim();

interface Point {
  lat: number;
  lon: number;
}

interface Pair {
  origin: string;
  destination: string;
}

/** Where an address is on the globe — OpenStreetMap's free geocoder, one lookup per address, kept for the session. */
function useGeocode(query: string) {
  return useQuery({
    queryKey: ['geocode', query],
    enabled: query !== '',
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async (): Promise<Point | null> => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) return null;
      const [hit] = (await response.json()) as { lat: string; lon: string }[];
      return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
    },
  });
}

/** Great-circle distance in kilometres — the straight line between two points on the globe. */
function straightLineKm(a: Point, b: Point) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const km = (value: number) => (value < 10 ? `${value.toFixed(1)} km` : `${Math.round(value).toLocaleString()} km`);

const storageName = (storageKey: string) => `location-map:${storageKey}`;

/** The two places the user last set for this card, kept in this browser so they are there again when the card is reopened. */
function remembered(storageKey: string | undefined): Pair | null {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageName(storageKey));
    if (!raw) return null;
    const pair = JSON.parse(raw) as Partial<Pair>;
    return { origin: clean(pair.origin), destination: clean(pair.destination) };
  } catch {
    return null;
  }
}

function remember(storageKey: string | undefined, pair: Pair | null) {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    if (pair) window.localStorage.setItem(storageName(storageKey), JSON.stringify(pair));
    else window.localStorage.removeItem(storageName(storageKey));
  } catch {
    // storage blocked: the places still show, they just are not kept for next time
  }
}

/**
 * A Google Map of two places — where the job is and where the candidate is, until the user sets their own — with the
 * route between them and the distance: the straight-line distance in the line above the map, the road distance and
 * travel time in the map's own panel. Both places can be typed over ("Show on map" or Enter); "Recorded" goes back to
 * following the job's and the candidate's own locations. With only one place it shows just that place. Google's
 * keyless embed — no API key needed.
 */
export function LocationMap({
  from,
  to,
  storageKey,
  className,
}: {
  from: MapPlace;
  to: MapPlace;
  /** Set to keep the places the user typed for this card in the browser — e.g. the application's id. */
  storageKey?: string;
  className?: string;
}) {
  // the recorded places can arrive after the first render (the job and candidate load separately): until the user
  // sets their own pair, the map follows whatever is recorded now
  const recorded: Pair = { origin: clean(from.query), destination: clean(to.query) };
  const [custom, setCustom] = useState<Pair | null>(() => remembered(storageKey));
  const [draft, setDraft] = useState<Pair | null>(null);
  const shown = custom ?? recorded;
  const typed = draft ?? shown;
  const a = useGeocode(shown.origin);
  const b = useGeocode(shown.destination);

  const { origin, destination } = shown;
  const both = Boolean(origin && destination);
  const single = origin || destination;
  const edited = draft !== null && (clean(draft.origin) !== origin || clean(draft.destination) !== destination);

  function show(pair: Pair) {
    const next = { origin: clean(pair.origin), destination: clean(pair.destination) };
    setCustom(next);
    setDraft(null);
    remember(storageKey, next);
  }

  function reset() {
    setCustom(null);
    setDraft(null);
    remember(storageKey, null);
  }

  const onEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (draft) show(draft);
    }
  };

  const embed = both
    ? `https://www.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&hl=en&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent(single)}&z=12&hl=en&output=embed`;
  const open = both
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(single)}`;

  const distance = !single
    ? 'Type the two places above and the map shows the route and the distance between them.'
    : !both
      ? `Only one place is set — add the other to see the distance between them.`
      : a.isPending || b.isPending
        ? 'Measuring the distance…'
        : a.data && b.data
          ? `${km(straightLineKm(a.data, b.data))} apart in a straight line — the road distance and travel time are on the map.`
          : 'The distance could not be measured — the road distance and travel time are on the map.';

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="location-map">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="map-origin" className="text-xs text-foreground/50">
            From · {from.label}
          </Label>
          <Input
            id="map-origin"
            value={typed.origin}
            placeholder={recorded.origin || 'Address or town'}
            onChange={(e) => setDraft({ ...typed, origin: e.target.value })}
            onKeyDown={onEnter}
            data-testid="map-origin"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="map-destination" className="text-xs text-foreground/50">
            To · {to.label}
          </Label>
          <Input
            id="map-destination"
            value={typed.destination}
            placeholder={recorded.destination || 'Address or town'}
            onChange={(e) => setDraft({ ...typed, destination: e.target.value })}
            onKeyDown={onEnter}
            data-testid="map-destination"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={!edited} onClick={() => draft && show(draft)} data-testid="map-show">
            <MapPin className="mr-1 h-3.5 w-3.5" /> Show on map
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={custom === null && draft === null}
            title={`Back to the recorded places: ${recorded.origin || '—'} → ${recorded.destination || '—'}`}
            onClick={reset}
            data-testid="map-reset"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Recorded
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/60">
        <span className="flex items-center gap-1.5" data-testid="location-distance">
          <Route className="h-3.5 w-3.5 shrink-0 text-foreground/50" /> {distance}
        </span>
        {single ? (
          <a href={open} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Open in Google Maps
          </a>
        ) : null}
      </div>
      {single ? (
        <iframe
          key={embed}
          src={embed}
          title={both ? `Route from ${origin} to ${destination}` : `Map of ${single}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className={cn('w-full rounded-md border border-border bg-accent/20', both ? 'h-80' : 'h-64')}
        />
      ) : null}
    </div>
  );
}
