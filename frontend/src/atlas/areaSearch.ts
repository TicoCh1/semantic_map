import { atlasResource, type City, type Coord } from "./data";

export type Circle = { city: City; lon: number; lat: number; radius: number };
export type Composition = { count: number; effective_count: number; warning: string; themes: { label: string; prompt: string; coverage: number; z: number }[] };
export async function inspectArea(circle: Circle, signal: AbortSignal): Promise<Composition> {
  const response = await atlasResource("precheck", {method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify(circle), signal});
  return response.json();
}

export function boundary(c: Circle): Coord[][] {
  const points: Coord[] = [];
  for (let i = 0; i < 64; i++) {
    const angle = 2 * Math.PI * i / 64;
    points.push([c.lon + Math.cos(angle) * c.radius / (111320 * Math.cos(c.lat * Math.PI / 180)),
      c.lat + Math.sin(angle) * c.radius / 111320]);
  }
  return [[...points, points[0]]];
}
