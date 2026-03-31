import React from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapEvents = ({ onPress, onViewportCenterChange, onInteractStart, onInteractEnd }) => {
  useMapEvents({
    mousedown: () => {
      if (onInteractStart) onInteractStart();
    },
    mouseup: () => {
      if (onInteractEnd) onInteractEnd();
    },
    touchstart: () => {
      if (onInteractStart) onInteractStart();
    },
    touchend: () => {
      if (onInteractEnd) onInteractEnd();
    },
    movestart: () => {
      if (onInteractStart) onInteractStart();
    },
    click: (event) => {
      if (!onPress) return;
      onPress({
        nativeEvent: {
          coordinate: {
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          },
        },
      });
    },
    moveend: (event) => {
      if (!onViewportCenterChange) return;
      const c = event.target.getCenter();
      onViewportCenterChange({ lat: c.lat, lng: c.lng });
      if (onInteractEnd) onInteractEnd();
    },
  });

  return null;
};

const RecenterMap = ({ center }) => {
  const map = useMap();

  React.useEffect(() => {
    if (!center) return;
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center?.lat, center?.lng]);

  return null;
};

const RadiusMap = ({
  center,
  selectedLocation,
  onPress,
  onViewportCenterChange,
  onInteractStart,
  onInteractEnd,
  radiusMeters = 20000,
}) => {
  if (!center) return null;

  return (
    <div style={styles.wrap}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={11}
        style={styles.map}
        dragging
        scrollWheelZoom
        doubleClickZoom
        touchZoom
        boxZoom={false}
        keyboard
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <Circle
          center={[center.lat, center.lng]}
          radius={radiusMeters}
          pathOptions={{ color: '#00B14F', fillColor: '#00B14F', fillOpacity: 0.12, weight: 2 }}
        />

        <CircleMarker
          center={[center.lat, center.lng]}
          radius={7}
          pathOptions={{ color: '#1F2937', fillColor: '#1F2937', fillOpacity: 1 }}
        />

        {selectedLocation && (
          <CircleMarker
            center={[selectedLocation.lat, selectedLocation.lng]}
            radius={8}
            pathOptions={{ color: '#00B14F', fillColor: '#00B14F', fillOpacity: 1 }}
          />
        )}

        <MapEvents
          onPress={onPress}
          onViewportCenterChange={onViewportCenterChange}
          onInteractStart={onInteractStart}
          onInteractEnd={onInteractEnd}
        />
        <RecenterMap center={center} />
      </MapContainer>

      <div style={styles.centerPin} />
    </div>
  );
};

const styles = {
  wrap: {
    width: '92%',
    maxWidth: 320,
    minWidth: 240,
    aspectRatio: '1 / 1',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #DCE3EA',
    touchAction: 'none',
    alignSelf: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  centerPin: {
    pointerEvents: 'none',
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -12,
    marginTop: -30,
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '3px solid #FFFFFF',
    backgroundColor: '#EF4444',
    boxShadow: '0 1px 6px rgba(0,0,0,0.26)',
  },
};

export default RadiusMap;
