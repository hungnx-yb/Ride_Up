import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getRealtimeNotificationFeed,
  onRealtimeNotificationFeedChange,
  markAllRealtimeNotificationsRead,
} from '../../services/api';
import DriverBottomNav, { DRIVER_BOTTOM_NAV_INSET } from '../../components/DriverBottomNav';

const formatDateTime = (iso) => {
  const value = String(iso || '').trim();
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
};

const NotificationCenterScreen = ({ navigation, role = 'CUSTOMER' }) => {
  const [feed, setFeed] = useState(getRealtimeNotificationFeed());
  const [refreshing, setRefreshing] = useState(false);
  const isDriver = String(role || '').toUpperCase() === 'DRIVER';

  useEffect(() => {
    const unsubscribe = onRealtimeNotificationFeedChange((next) => {
      setFeed(Array.isArray(next) ? next : []);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    markAllRealtimeNotificationsRead();
  }, []);

  useEffect(() => () => {
    markAllRealtimeNotificationsRead();
  }, []);

  const unreadCount = useMemo(() => feed.filter((item) => item?.read !== true).length, [feed]);

  const onRefresh = () => {
    setRefreshing(true);
    setFeed(getRealtimeNotificationFeed());
    setTimeout(() => setRefreshing(false), 250);
  };

  const handleMarkAllRead = () => {
    markAllRealtimeNotificationsRead();
  };

  const renderItem = ({ item }) => {
    const unread = item?.read !== true;
    return (
      <View style={[styles.card, unread && styles.cardUnread]}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{item?.title || 'Thông báo'}</Text>
          {unread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.cardMessage}>{item?.message || ''}</Text>
        <Text style={styles.cardTime}>{formatDateTime(item?.createdAt)}</Text>
      </View>
    );
  };

  const goCustomerTab = (tab) => {
    navigation?.navigate('CustomerHome', { initialTab: tab });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <Text style={styles.headerSub}>Bạn có {unreadCount} thông báo chưa đọc</Text>
        </View>
        <TouchableOpacity style={styles.readBtn} onPress={handleMarkAllRead} activeOpacity={0.85}>
          <Text style={styles.readBtnText}>Đã đọc hết</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item) => String(item?.id || Math.random())}
        renderItem={renderItem}
        contentContainerStyle={feed.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={24} color="#94A3B8" />
            <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
          </View>
        }
      />

      {isDriver ? (
        <DriverBottomNav navigation={navigation} activeKey="notifications" />
      ) : (
        <View style={styles.footerWrap}>
          <TouchableOpacity style={styles.footerItem} onPress={() => goCustomerTab('home')} activeOpacity={0.9}>
            <Ionicons name="home-outline" size={20} color="#64748B" />
            <Text style={styles.footerText}>Trang chủ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerItem} onPress={() => goCustomerTab('myTrips')} activeOpacity={0.9}>
            <Ionicons name="car-outline" size={20} color="#64748B" />
            <Text style={styles.footerText}>Chuyến của tôi</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerItem} onPress={() => goCustomerTab('messages')} activeOpacity={0.9}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#64748B" />
            <Text style={styles.footerText}>Tin nhắn</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.footerItem, styles.footerItemActive]} activeOpacity={0.9}>
            <Ionicons name="notifications" size={20} color="#00B14F" />
            <Text style={[styles.footerText, styles.footerTextActive]}>Thông báo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerItem} onPress={() => goCustomerTab('account')} activeOpacity={0.9}>
            <Ionicons name="person-outline" size={20} color="#64748B" />
            <Text style={styles.footerText}>Tài khoản</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    color: '#475569',
  },
  readBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
  },
  readBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  listContainer: {
    padding: 14,
    paddingBottom: 140,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: DRIVER_BOTTOM_NAV_INSET,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#EF4444',
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  cardTime: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#E5EAF0',
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  footerItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  footerItemActive: {
    backgroundColor: '#ECFDF3',
  },
  footerText: {
    marginTop: 2,
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  footerTextActive: {
    color: '#00A63E',
  },
});

export default NotificationCenterScreen;
