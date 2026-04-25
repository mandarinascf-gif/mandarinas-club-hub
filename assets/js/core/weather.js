(function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;
  const MATCHDAY_VENUE = Object.freeze({
    name: "Alden E. Oliver Sports Park",
    shortName: "Alden E. Oliver",
    address: "2580 Eden Park Pl, Hayward, CA 94545",
    city: "Hayward, CA",
    latitude: 37.6102376,
    longitude: -122.0872952,
    timezone: "America/Los_Angeles",
  });
  const WEATHER_CODES = Object.freeze({
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Rain showers",
    82: "Heavy showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm",
    99: "Thunderstorm",
  });
  const WEATHER_FIELDS = [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "precipitation",
    "wind_speed_10m",
    "weather_code",
  ];
  const rangeCache = new Map();
  const partsFormatters = new Map();

  function getFormatter(timeZone, includeHour) {
    const key = `${timeZone}:${includeHour ? "hour" : "date"}`;

    if (!partsFormatters.has(key)) {
      partsFormatters.set(
        key,
        new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          ...(includeHour
            ? {
                hour: "2-digit",
                hourCycle: "h23",
              }
            : {}),
        })
      );
    }

    return partsFormatters.get(key);
  }

  function getDateParts(date, timeZone, includeHour) {
    return getFormatter(timeZone, includeHour)
      .formatToParts(date)
      .reduce((accumulator, part) => {
        if (part.type !== "literal") {
          accumulator[part.type] = part.value;
        }
        return accumulator;
      }, {});
  }

  function toDateKey(date, timeZone) {
    const parts = getDateParts(date, timeZone, false);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function toHourKey(date, timeZone) {
    const rounded = new Date(date.getTime() + HOUR_MS / 2);
    const parts = getDateParts(rounded, timeZone, true);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00`;
  }

  function parseDateKey(dateKey) {
    const [year, month, day] = String(dateKey)
      .split("-")
      .map((value) => Number(value));
    return Date.UTC(year, month - 1, day);
  }

  function dayDeltaFromToday(date, timeZone) {
    const todayKey = toDateKey(new Date(), timeZone);
    const targetKey = toDateKey(date, timeZone);
    return Math.round((parseDateKey(targetKey) - parseDateKey(todayKey)) / DAY_MS);
  }

  function clampNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function weatherCodeLabel(code) {
    return WEATHER_CODES[Number(code)] || "Conditions pending";
  }

  function formatRounded(value, suffix) {
    if (!Number.isFinite(value)) {
      return null;
    }
    return `${Math.round(value)}${suffix}`;
  }

  function formatPrecipitationAmount(value) {
    if (!Number.isFinite(value)) {
      return null;
    }
    if (value < 0.1) {
      return `${value.toFixed(2)} in`;
    }
    return `${value.toFixed(1)} in`;
  }

  function buildRangeUrl(kind, startDate, endDate, venue) {
    const url = new URL(
      kind === "archive"
        ? "https://archive-api.open-meteo.com/v1/archive"
        : "https://api.open-meteo.com/v1/forecast"
    );

    url.searchParams.set("latitude", String(venue.latitude));
    url.searchParams.set("longitude", String(venue.longitude));
    url.searchParams.set("timezone", venue.timezone);
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("hourly", WEATHER_FIELDS.join(","));
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);

    return url.toString();
  }

  async function fetchRange(kind, startDate, endDate, venue) {
    const cacheKey = [
      kind,
      venue.latitude,
      venue.longitude,
      venue.timezone,
      startDate,
      endDate,
    ].join("|");

    if (rangeCache.has(cacheKey)) {
      return rangeCache.get(cacheKey);
    }

    const request = fetch(buildRangeUrl(kind, startDate, endDate, venue), {
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Weather request failed (${response.status}): ${body || response.statusText}`);
        }

        return response.json();
      })
      .catch((error) => {
        rangeCache.delete(cacheKey);
        throw error;
      });

    rangeCache.set(cacheKey, request);
    return request;
  }

  function buildHourlyLookup(payload) {
    const hourly = payload?.hourly || {};
    const time = hourly.time || [];
    const lookup = new Map();

    time.forEach((entry, index) => {
      lookup.set(entry, {
        temperature: clampNumber(hourly.temperature_2m?.[index]),
        apparentTemperature: clampNumber(hourly.apparent_temperature?.[index]),
        precipitationProbability: clampNumber(hourly.precipitation_probability?.[index]),
        precipitation: clampNumber(hourly.precipitation?.[index]),
        windSpeed: clampNumber(hourly.wind_speed_10m?.[index]),
        weatherCode: clampNumber(hourly.weather_code?.[index]),
      });
    });

    return lookup;
  }

  function buildWeatherSnapshot(status, row, venue, sourceValues) {
    return {
      id: row.id,
      kickoffAt: row.kickoff_at,
      status,
      venue,
      condition: weatherCodeLabel(sourceValues?.weatherCode),
      temperature: sourceValues?.temperature ?? null,
      apparentTemperature: sourceValues?.apparentTemperature ?? null,
      precipitationProbability: sourceValues?.precipitationProbability ?? null,
      precipitation: sourceValues?.precipitation ?? null,
      windSpeed: sourceValues?.windSpeed ?? null,
      weatherCode: sourceValues?.weatherCode ?? null,
    };
  }

  async function loadMatchdayWeather(matchdays, venue = MATCHDAY_VENUE) {
    const rows = (matchdays || []).filter(Boolean);
    const snapshots = new Map();
    const archiveRows = [];
    const forecastRows = [];

    rows.forEach((row) => {
      const id = row.id;

      if (!row.kickoff_at) {
        snapshots.set(id, {
          id,
          kickoffAt: null,
          status: "missing_kickoff",
          venue,
        });
        return;
      }

      const kickoff = new Date(row.kickoff_at);

      if (!Number.isFinite(kickoff.getTime())) {
        snapshots.set(id, {
          id,
          kickoffAt: row.kickoff_at,
          status: "missing_kickoff",
          venue,
        });
        return;
      }

      const dayDelta = dayDeltaFromToday(kickoff, venue.timezone);

      if (dayDelta > 16) {
        snapshots.set(id, {
          id,
          kickoffAt: row.kickoff_at,
          status: "too_far",
          venue,
        });
        return;
      }

      if (dayDelta < 0) {
        archiveRows.push(row);
        return;
      }

      forecastRows.push(row);
    });

    if (archiveRows.length) {
      const startDate = archiveRows
        .map((row) => toDateKey(new Date(row.kickoff_at), venue.timezone))
        .sort()[0];
      const endDate = archiveRows
        .map((row) => toDateKey(new Date(row.kickoff_at), venue.timezone))
        .sort()
        .at(-1);
      const archivePayload = await fetchRange("archive", startDate, endDate, venue);
      const archiveLookup = buildHourlyLookup(archivePayload);

      archiveRows.forEach((row) => {
        const hourKey = toHourKey(new Date(row.kickoff_at), venue.timezone);
        snapshots.set(
          row.id,
          buildWeatherSnapshot("observed", row, venue, archiveLookup.get(hourKey) || null)
        );
      });
    }

    if (forecastRows.length) {
      const startDate = forecastRows
        .map((row) => toDateKey(new Date(row.kickoff_at), venue.timezone))
        .sort()[0];
      const endDate = forecastRows
        .map((row) => toDateKey(new Date(row.kickoff_at), venue.timezone))
        .sort()
        .at(-1);
      const forecastPayload = await fetchRange("forecast", startDate, endDate, venue);
      const forecastLookup = buildHourlyLookup(forecastPayload);

      forecastRows.forEach((row) => {
        const hourKey = toHourKey(new Date(row.kickoff_at), venue.timezone);
        snapshots.set(
          row.id,
          buildWeatherSnapshot("forecast", row, venue, forecastLookup.get(hourKey) || null)
        );
      });
    }

    return snapshots;
  }

  function describeMatchdayWeather(snapshot, options = {}) {
    const includeVenue = Boolean(options.includeVenue);
    const venue = snapshot?.venue || MATCHDAY_VENUE;

    if (!snapshot || snapshot.status === "error") {
      return {
        tone: "warning",
        kicker: "Weather",
        headline: "Weather unavailable",
        detail: "The weather feed could not be reached right now.",
        chips: includeVenue ? [venue.shortName] : [],
      };
    }

    if (snapshot.status === "missing_kickoff") {
      return {
        tone: "",
        kicker: "Weather",
        headline: "Kickoff pending",
        detail: "Add a kickoff time to attach a weather snapshot.",
        chips: includeVenue ? [venue.shortName] : [],
      };
    }

    if (snapshot.status === "too_far") {
      return {
        tone: "",
        kicker: "Forecast",
        headline: "Forecast opens later",
        detail: "Hourly forecast becomes useful within 16 days of kickoff.",
        chips: includeVenue ? [venue.shortName] : [],
      };
    }

    const temperatureLabel = formatRounded(snapshot.temperature, "°F");
    const apparentLabel = formatRounded(snapshot.apparentTemperature, "°F");
    const rainChanceLabel = Number.isFinite(snapshot.precipitationProbability)
      ? `${Math.round(snapshot.precipitationProbability)}% rain`
      : null;
    const rainAmountLabel = formatPrecipitationAmount(snapshot.precipitation);
    const windLabel = formatRounded(snapshot.windSpeed, " mph wind");
    const chips = [
      rainChanceLabel,
      windLabel,
      apparentLabel ? `Feels ${apparentLabel}` : null,
    ].filter(Boolean);

    if (includeVenue) {
      chips.unshift(venue.shortName);
    }

    const detailParts = [
      includeVenue ? `${venue.shortName}, ${venue.city}` : null,
      rainChanceLabel,
      Number.isFinite(snapshot.precipitation) && snapshot.precipitation > 0.01 && rainAmountLabel
        ? `~${rainAmountLabel}`
        : null,
      windLabel,
      apparentLabel ? `feels ${apparentLabel}` : null,
    ].filter(Boolean);

    return {
      tone: snapshot.status === "observed" ? "" : "accent",
      kicker: snapshot.status === "observed" ? "Observed weather" : "Kickoff forecast",
      headline: [snapshot.condition, temperatureLabel].filter(Boolean).join(" · ") || snapshot.condition,
      detail: detailParts.join(" · "),
      chips,
    };
  }

  async function loadSingleMatchdayWeather(matchday, venue = MATCHDAY_VENUE) {
    const weatherMap = await loadMatchdayWeather([matchday], venue);
    return weatherMap.get(matchday?.id) || null;
  }

  window.MandarinasWeather = {
    MATCHDAY_VENUE,
    loadMatchdayWeather,
    loadSingleMatchdayWeather,
    describeMatchdayWeather,
  };
})();
