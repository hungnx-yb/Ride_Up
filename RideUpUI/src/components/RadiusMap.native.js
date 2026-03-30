import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';

const RadiusMap = ({
  center,
  selectedLocation,
  onPress,
  onViewportCenterChange,
  onInteractStart,
  onInteractEnd,
  radiusMeters,
  mode = 'pickup',
}) => {
  if (!center) return null;

  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.animateToRegion({
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: 0.18,
      longitudeDelta: 0.18,
    }, 260);
  }, [center?.lat, center?.lng]);

  return (
    <View
      style={{
        width: '92%',
        maxWidth: 320,
        minWidth: 240,
        aspectRatio: 1,
        borderRadius: 14,
        overflow: 'hidden',
        alignSelf: 'center',
      }}
    >
      <MapView
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.18,
          longitudeDelta: 0.18,
        }}
        scrollEnabled
        zoomEnabled
        zoomTapEnabled
        zoomControlEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        onPress={onPress}
        onTouchStart={() => onInteractStart && onInteractStart()}
        onTouchEnd={() => onInteractEnd && onInteractEnd()}
        onPanDrag={() => onInteractStart && onInteractStart()}
        onRegionChangeComplete={(region) => {
          if (!onViewportCenterChange) return;
          onViewportCenterChange({ lat: region.latitude, lng: region.longitude });
          if (onInteractEnd) onInteractEnd();
        }}
      >
        <Circle
          center={{ latitude: center.lat, longitude: center.lng }}
          radius={radiusMeters}
          strokeWidth={2}
          strokeColor="rgba(0,177,79,0.7)"
          fillColor="rgba(0,177,79,0.12)"
        />
        <Marker
          coordinate={{ latitude: center.lat, longitude: center.lng }}
          title="Tâm phường"
          pinColor="#1F2937"
        />
        {selectedLocation && (
          <Marker
            coordinate={{ latitude: selectedLocation.lat, longitude: selectedLocation.lng }}
            title={mode === 'pickup' ? 'Điểm đón đã chọn' : 'Điểm trả đã chọn'}
            pinColor="#00B14F"
          />
        )}
      </MapView>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -12,
          marginTop: -30,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 3,
            borderColor: '#FFFFFF',
            backgroundColor: '#EF4444',
          }}
        />
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 7,
            borderRightWidth: 7,
            borderTopWidth: 12,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: '#EF4444',
            marginTop: -1,
          }}
        />
      </View>
    </View>
  );
};

export default RadiusMap;
