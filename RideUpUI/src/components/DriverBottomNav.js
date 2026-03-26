import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ITEMS = [
  { key: 'home', label: 'Trang chủ', icon: '🏠', screen: 'DriverHome' },
  { key: 'create', label: 'Tạo chuyến', icon: '➕', screen: 'CreateTrip' },
  { key: 'trips', label: 'Chuyến xe', icon: '🧾', screen: 'AllTrips' },
  { key: 'profile', label: 'Hồ sơ', icon: '👤', screen: 'DriverProfile' },
];

const DriverBottomNav = ({ navigation, activeKey }) => {
  const goTo = (item) => {
    if (!navigation || activeKey === item.key) return;
    navigation.navigate(item.screen);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {ITEMS.map((item) => {
          const active = item.key === activeKey;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => goTo(item)}
              activeOpacity={0.85}
            >
              <Text style={[styles.icon, active && styles.iconActive]}>{item.icon}</Text>
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 6,
    backgroundColor: 'rgba(246,248,250,0.96)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 7,
    marginHorizontal: 2,
  },
  itemActive: {
    backgroundColor: '#FFF3E8',
  },
  icon: {
    fontSize: 16,
    opacity: 0.75,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  labelActive: {
    color: '#E65100',
    fontWeight: '800',
  },
});

export default DriverBottomNav;
