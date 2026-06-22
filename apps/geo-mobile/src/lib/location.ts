import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { adaptiveIntervalMs } from '@pacific/geo-shared';
import { apiSend } from './api';
import { enqueue, flush, deviceId, type QueuedPoint } from './queue';

// Tarefa de localização em background (spec §1.8). iOS/Android entregam updates aqui mesmo
// com o app suspenso; persistimos offline e sincronizamos quando há rede.
export const LOCATION_TASK = 'geo-background-location';

async function handlePositions(locations: Location.LocationObject[]): Promise<void> {
  const id = await deviceId();
  for (const loc of locations) {
    const point: QueuedPoint = {
      device_id: id,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy_meters: loc.coords.accuracy ?? 0,
      altitude_meters: loc.coords.altitude ?? undefined,
      speed_mps: loc.coords.speed ?? undefined,
      heading_degrees: loc.coords.heading ?? undefined,
      source: 'fused',
      timestamp: new Date(loc.timestamp).toISOString(),
    };
    try {
      await apiSend('POST', '/api/v1/locations', point);
    } catch {
      await enqueue(point); // sem rede → fila local
    }
  }
  await flush(); // tenta drenar pendências
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  await handlePositions(locations);
});

/** Pede permissões (foreground + background) e começa o rastreamento consentido. */
export async function startTracking(speedHint?: number): Promise<{ ok: boolean; reason?: string }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'foreground_denied' };
  const bg = await Location.requestBackgroundPermissionsAsync();
  // Sem background, ainda funciona em foreground (degradação — spec §1.8).
  const intervalMs = adaptiveIntervalMs(speedHint);
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced, // PRIORITY_BALANCED_POWER_ACCURACY
    timeInterval: intervalMs,
    distanceInterval: 25,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Compartilhando localização',
      notificationBody: 'Você está compartilhando sua localização com o grupo.',
    },
  });
  return { ok: bg.status === 'granted' ? true : true };
}

export async function stopTracking(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export async function isTracking(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
}
