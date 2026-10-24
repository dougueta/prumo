/** Descrição do dispositivo e origem aproximada (R-13): parser mínimo, sem dependência. */

const MAX = 80;
const UNKNOWN = "Dispositivo desconhecido";

function platform(ua: string): string | null {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

function browser(ua: string): string | null {
  // Ordem importa: Edge e os navegadores do iOS também dizem "Safari"/"Chrome".
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/CriOS\/|Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

export function describeDevice(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").slice(0, 1024);
  const os = platform(ua);
  const app = browser(ua);
  if (!os || !app) return UNKNOWN;
  return `${os} · ${app}`.slice(0, MAX);
}

type HeaderReader = { get(name: string): string | null };

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** "São Paulo, BR" a partir dos cabeçalhos gratuitos da Vercel; nulo em local. */
export function geoFromHeaders(headers: HeaderReader): string | null {
  const city = headers.get("x-vercel-ip-city");
  const country = headers.get("x-vercel-ip-country");
  const parts = [city ? decode(city) : null, country].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(", ").slice(0, MAX);
}
