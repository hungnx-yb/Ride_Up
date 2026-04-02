import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getMyChatThreads,
  getRealtimeNotificationFeed,
  onRealtimeNotificationFeedChange,
  getChatUnreadThreadsCount,
  onChatUnreadThreadsCountChange,
} from '../services/api';

export const DRIVER_BOTTOM_NAV_INSET = 116;
export const DRIVER_MAIN_ROUTE = 'DriverMain';

const ITEMS = [
  { key: 'home', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home', screen: 'DriverHome' },
  { key: 'trips', label: 'Chuyến xe', icon: 'car-outline', iconActive: 'car', screen: 'AllTrips' },
  { key: 'messages', label: 'Tin nhắn', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses', screen: 'DriverMessages' },
  { key: 'notifications', label: 'Thông báo', icon: 'notifications-outline', iconActive: 'notifications', screen: 'NotificationCenter' },
  { key: 'profile', label: 'Tài khoản', icon: 'person-outline', iconActive: 'person', screen: 'DriverProfile' },
];

const routeKeyByName = {
  DriverHome: 'home',
  AllTrips: 'trips',
  DriverMessages: 'messages',
  NotificationCenter: 'notifications',
  DriverProfile: 'profile',
};

const DriverBottomNav = ({ navigation, activeKey, state }) => {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(getChatUnreadThreadsCount());
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(
    getRealtimeNotificationFeed().filter((item) => item?.read !== true).length
  );

  useEffect(() => {
    const unsubscribe = onChatUnreadThreadsCountChange((count) => {
      setUnreadMessagesCount(Number(count || 0));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    getMyChatThreads().catch(() => { });
  }, [activeKey]);

  useEffect(() => {
    const unsubscribe = onRealtimeNotificationFeedChange((next) => {
      const count = (Array.isArray(next) ? next : []).filter((item) => item?.read !== true).length;
      setUnreadNotificationCount(count);
    });
    return unsubscribe;
  }, []);

  const badgeByKey = useMemo(() => ({
    messages: unreadMessagesCount,
    notifications: unreadNotificationCount,
  }), [unreadMessagesCount, unreadNotificationCount]);

  const activeRouteName = state?.routes?.[state?.index]?.name;
  const activeKeyFromState = routeKeyByName[activeRouteName] || null;
  const normalizedActiveKey = (activeKeyFromState || activeKey) === 'create' ? 'trips' : (activeKeyFromState || activeKey);
  const isTabBarMode = !!state;

  const goTo = (item) => {
    if (!navigation || normalizedActiveKey === item.key) return;

    if (isTabBarMode) {
      navigation.navigate(item.screen);
      return;
    }

    navigation.navigate(DRIVER_MAIN_ROUTE, { screen: item.screen });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {ITEMS.map((item) => {
          const active = item.key === normalizedActiveKey;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => goTo(item)}
              activeOpacity={0.85}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={18}
                  color={active ? '#00B14F' : '#64748B'}
                />
                {Number(badgeByKey[item.key] || 0) > 0 && normalizedActiveKey !== item.key && <View style={styles.dot} />}
              </View>
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#E5EAF0',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  itemActive: {
    backgroundColor: '#ECFDF3',
  },
  iconWrap: {
    position: 'relative',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
  },
  labelActive: {
    color: '#00A63E',
  },
});

export default DriverBottomNav;
