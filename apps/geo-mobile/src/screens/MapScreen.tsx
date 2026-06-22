import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
// NOTA (scaffold): a API exata do @maplibre/maplibre-react-native pode variar por versão —
// ajustar nomes de componentes/props ao rodar no device. Estilo via OSM raster (sem API key).
import MapLibreGL, { MapView, Camera, PointAnnotation } from '@maplibre/maplibre-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { apiGet, type PositionRow } from '../lib/api';

const OSM_STYLE = JSON.stringify({
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
});

type Props = NativeStackScreenProps<RootStackParamList, 'Map'>;

export function MapScreen({ route }: Props) {
  const { groupId } = route.params;
  const [positions, setPositions] = useState<PositionRow[]>([]);

  useEffect(() => {
    let active = true;
    const load = () =>
      apiGet<PositionRow[]>(`/api/v1/groups/${groupId}/locations/latest`)
        .then((p) => active && setPositions(p))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 30_000); // pull leve; tempo real fino via WebSocket (a integrar)
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [groupId]);

  return (
    <View style={styles.container}>
      <MapView style={styles.map} mapStyle={OSM_STYLE}>
        <Camera zoomLevel={12} centerCoordinate={positions[0] ? [positions[0].lng, positions[0].lat] : [-46.63, -23.55]} />
        {positions.map((p) => (
          <PointAnnotation key={p.user_id} id={p.user_id} coordinate={[p.lng, p.lat]}>
            <View style={styles.dot} />
          </PointAnnotation>
        ))}
      </MapView>
    </View>
  );
}

// evita "unused import" caso a versão use o default export para configuração global
void MapLibreGL;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E17' },
  map: { flex: 1 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2BE5C2', borderWidth: 2, borderColor: '#0A0E17' },
});
