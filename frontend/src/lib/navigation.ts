import type { DirectionsRoute } from "@/types/domain";

export interface NavigationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface NavigationGeometry {
  cumulativeDistancesM: number[];
  stepProgressM: number[];
  totalDistanceM: number;
}

export interface NavigationProgress {
  activeStepIndex: number;
  nextStepIndex: number;
  distanceToStepM: number;
  distanceToDestinationM: number;
  offRouteDistanceM: number;
  remainingDistanceM: number;
  remainingDurationS: number;
  routeProgressM: number;
  segmentIndex: number;
  arrived: boolean;
}

interface Projection {
  distanceM: number;
  progressM: number;
  segmentIndex: number;
}

const earthRadiusM = 6_371_000;

export function distanceBetween(first: NavigationPoint, second: NavigationPoint) {
  const latitudeDelta = (second.latitude - first.latitude) * Math.PI / 180;
  const longitudeDelta = (second.longitude - first.longitude) * Math.PI / 180;
  const firstLatitude = first.latitude * Math.PI / 180;
  const secondLatitude = second.latitude * Math.PI / 180;
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

function projectPoint(
  point: NavigationPoint,
  routePoints: NavigationPoint[],
  cumulativeDistancesM: number[],
  startSegment = 0,
  endSegment = routePoints.length - 2,
) {
  const metersPerLatitude = 111_132;
  const metersPerLongitude = 111_320 * Math.max(0.01, Math.cos(point.latitude * Math.PI / 180));
  let best: Projection = { distanceM: Number.POSITIVE_INFINITY, progressM: 0, segmentIndex: startSegment };

  for (let index = startSegment; index <= endSegment; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    if (!start || !end) continue;
    const startX = (start.longitude - point.longitude) * metersPerLongitude;
    const startY = (start.latitude - point.latitude) * metersPerLatitude;
    const segmentX = (end.longitude - start.longitude) * metersPerLongitude;
    const segmentY = (end.latitude - start.latitude) * metersPerLatitude;
    const squaredLength = segmentX ** 2 + segmentY ** 2;
    const ratio = squaredLength > 0
      ? Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / squaredLength))
      : 0;
    const projectedX = startX + segmentX * ratio;
    const projectedY = startY + segmentY * ratio;
    const distanceM = Math.hypot(projectedX, projectedY);
    if (distanceM >= best.distanceM) continue;
    const segmentDistanceM = (cumulativeDistancesM[index + 1] ?? 0) - (cumulativeDistancesM[index] ?? 0);
    best = {
      distanceM,
      progressM: (cumulativeDistancesM[index] ?? 0) + segmentDistanceM * ratio,
      segmentIndex: index,
    };
  }
  return best;
}

export function buildNavigationGeometry(route: DirectionsRoute): NavigationGeometry {
  const cumulativeDistancesM = route.points.map(() => 0);
  for (let index = 1; index < route.points.length; index += 1) {
    const previous = route.points[index - 1];
    const current = route.points[index];
    cumulativeDistancesM[index] = (cumulativeDistancesM[index - 1] ?? 0)
      + (previous && current ? distanceBetween(previous, current) : 0);
  }

  let lastSegmentIndex = 0;
  let lastProgressM = 0;
  const stepProgressM = route.steps.map((step) => {
    if (route.points.length < 2) return lastProgressM;
    const projection = projectPoint(
      step.coordinates,
      route.points,
      cumulativeDistancesM,
      Math.max(0, lastSegmentIndex - 2),
    );
    lastSegmentIndex = Math.max(lastSegmentIndex, projection.segmentIndex);
    lastProgressM = Math.max(lastProgressM, projection.progressM);
    return lastProgressM;
  });

  return {
    cumulativeDistancesM,
    stepProgressM,
    totalDistanceM: cumulativeDistancesM[cumulativeDistancesM.length - 1] ?? 0,
  };
}

export function calculateNavigationProgress(
  route: DirectionsRoute,
  geometry: NavigationGeometry,
  position: NavigationPoint,
  previousProgressM = 0,
  previousSegmentIndex?: number,
): NavigationProgress {
  const lastSegmentIndex = Math.max(0, route.points.length - 2);
  let projection: Projection;
  if (previousSegmentIndex === undefined || route.points.length < 900) {
    projection = projectPoint(position, route.points, geometry.cumulativeDistancesM);
  } else {
    const start = Math.max(0, previousSegmentIndex - 80);
    const end = Math.min(lastSegmentIndex, previousSegmentIndex + 800);
    projection = projectPoint(position, route.points, geometry.cumulativeDistancesM, start, end);
    if (projection.distanceM > 180 && (start > 0 || end < lastSegmentIndex)) {
      projection = projectPoint(position, route.points, geometry.cumulativeDistancesM);
    }
  }

  const accuracyM = Number.isFinite(position.accuracy) ? Math.max(0, position.accuracy ?? 0) : 0;
  const regressionToleranceM = Math.max(12, Math.min(45, accuracyM));
  const routeProgressM = projection.progressM + regressionToleranceM < previousProgressM
    ? previousProgressM
    : Math.max(previousProgressM, projection.progressM);
  const destination = route.points[route.points.length - 1];
  const distanceToDestinationM = destination ? distanceBetween(position, destination) : Number.POSITIVE_INFINITY;
  const arrivalRadiusM = Math.max(25, Math.min(50, accuracyM * 0.75));
  const arrived = distanceToDestinationM <= arrivalRadiusM
    || (geometry.totalDistanceM - routeProgressM <= 20 && distanceToDestinationM <= 80);
  const passedRadiusM = Math.max(16, Math.min(35, accuracyM * 0.6));
  const activeStepIndex = arrived
    ? -1
    : geometry.stepProgressM.findIndex((progressM) => progressM >= routeProgressM - passedRadiusM);
  const normalizedStepIndex = activeStepIndex >= 0 ? activeStepIndex : route.steps.length - 1;
  const distanceToStepM = normalizedStepIndex >= 0
    ? Math.max(0, (geometry.stepProgressM[normalizedStepIndex] ?? geometry.totalDistanceM) - routeProgressM)
    : distanceToDestinationM;
  const remainingRatio = geometry.totalDistanceM > 0
    ? Math.max(0, Math.min(1, (geometry.totalDistanceM - routeProgressM) / geometry.totalDistanceM))
    : 0;

  return {
    activeStepIndex: arrived ? -1 : normalizedStepIndex,
    nextStepIndex: arrived || normalizedStepIndex < 0 || normalizedStepIndex + 1 >= route.steps.length
      ? -1
      : normalizedStepIndex + 1,
    distanceToStepM,
    distanceToDestinationM,
    offRouteDistanceM: projection.distanceM,
    remainingDistanceM: route.distanceM * remainingRatio,
    remainingDurationS: route.durationS * remainingRatio,
    routeProgressM,
    segmentIndex: projection.segmentIndex,
    arrived,
  };
}

export type ManeuverKind = "arrive" | "left" | "right" | "straight" | "uturn";

export function maneuverKind(instruction: string): ManeuverKind {
  if (/(목적지|도착)/.test(instruction)) return "arrive";
  if (/유턴/.test(instruction)) return "uturn";
  if (/(좌회전|왼쪽|10시|11시)/.test(instruction)) return "left";
  if (/(우회전|오른쪽|1시|2시)/.test(instruction)) return "right";
  return "straight";
}
