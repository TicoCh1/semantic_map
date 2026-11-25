/** One authoritative ground resolution, with independent city centers or a
 * complete shared camera for same-city comparisons. No React render per frame. */
export type SceneCameraMap = {
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
  getMinZoom(): number;
  getMaxZoom(): number;
  isMoving(): boolean;
  isZooming(): boolean;
  jumpTo(camera: { center?: { lng: number; lat: number }; zoom: number; bearing: number; pitch: number }, eventData?: { sceneCameraSync: boolean }): unknown;
  on(event: "move" | "moveend", listener: () => void): unknown;
  off(event: "move" | "moveend", listener: () => void): unknown;
};

const CAMERA_EPSILON = 1e-7;
const PEER_PAN_ZOOM_EPSILON = 0.01;

export function groundScaleForZoom(zoom: number, lat: number): number {
  return 2 ** zoom / latitudeCos(lat);
}

export function zoomForGroundScale(scale: number, lat: number): number {
  return Math.log2(scale * latitudeCos(lat));
}

export function latitudeCos(lat: number): number {
  return Math.max(0.001, Math.cos(Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180));
}

export class MapSceneCamera {
  private members = new Set<SceneCameraMap>();
  private applying = false;
  private scale: number;

  constructor(initialGroundScale: number) { this.scale = initialGroundScale; }

  register(map: SceneCameraMap, mode: "resolution" | "camera", ignoreMove: () => boolean = () => false): () => void {
    const peer = this.members.values().next().value as SceneCameraMap | undefined;
    this.applying = true;
    try {
      map.jumpTo({
        ...(mode === "camera" && peer ? { center: peer.getCenter() } : {}),
        zoom: mode === "camera" && peer ? peer.getZoom() : zoomForGroundScale(this.scale, map.getCenter().lat),
        bearing: peer?.getBearing() ?? map.getBearing(), pitch: peer?.getPitch() ?? map.getPitch()
      }, { sceneCameraSync: true });
    } finally { this.applying = false; }
    this.members.add(map);
    const synchronize = (settled: boolean) => {
      if (this.applying || ignoreMove()) return;
      this.applying = true;
      try {
        const center = map.getCenter();
        const bearing = map.getBearing();
        const pitch = map.getPitch();
        const pan = !settled && mode === "resolution" && map.isMoving() && !map.isZooming();
        let scale = groundScaleForZoom(map.getZoom(), center.lat);
        // Clamp the shared scale once, rather than letting a limited peer fight
        // the gesture and feed a second, incompatible scale back to the source.
        let minimum = 0, maximum = Infinity;
        for (const member of this.members) {
          const lat = mode === "camera" ? center.lat : member.getCenter().lat;
          minimum = Math.max(minimum, groundScaleForZoom(member.getMinZoom(), lat));
          maximum = Math.min(maximum, groundScaleForZoom(member.getMaxZoom(), lat));
        }
        scale = Math.max(minimum, Math.min(maximum, scale));
        this.scale = scale;
        for (const member of this.members) {
          const memberCenter = member.getCenter();
          const zoom = zoomForGroundScale(scale, mode === "camera" ? center.lat : memberCenter.lat);
          // Latitude shifts during a drag make tiny changes to scale. Defer
          // those peer repaints until the gesture settles, keeping zoom live.
          const epsilon = pan && member !== map ? PEER_PAN_ZOOM_EPSILON : CAMERA_EPSILON;
          if (Math.abs(member.getZoom() - zoom) < epsilon && member.getBearing() === bearing && member.getPitch() === pitch
            && (mode !== "camera" || (memberCenter.lng === center.lng && memberCenter.lat === center.lat))) continue;
          member.jumpTo({ ...(mode === "camera" ? { center } : {}), zoom, bearing, pitch }, { sceneCameraSync: true });
        }
      } finally { this.applying = false; }
    };
    const onMove = () => synchronize(false);
    const onMoveEnd = () => synchronize(true);
    map.on("move", onMove);
    map.on("moveend", onMoveEnd);
    // A replacement city can have different latitude/zoom limits. Reconcile
    // the entire group immediately instead of waiting for the next gesture.
    synchronize(true);
    return () => { map.off("move", onMove); map.off("moveend", onMoveEnd); this.members.delete(map); };
  }
}
