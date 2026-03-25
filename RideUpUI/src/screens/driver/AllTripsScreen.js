import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl,
  Alert,
} from 'react-native';
import { COLORS } from '../../config/config';
import { getDriverTrips, cancelDriverTrip } from '../../services/api';
import {
  ensureApprovedProfileBeforeCreateTrip,
  ensureApprovedProfileForTripFeature,
  warmupDriverProfileApprovalCache,
} from '../../services/driverProfileGuard';
import ProfileApprovalModal from '../../components/ProfileApprovalModal';

const THEME = {
  gradientStart: '#E65100',
  accent:        '#FF6F00',
};

const STATUS_CONFIG = {
  scheduled:   { label: 'Đã lên lịch', color: '#1565C0', bg: '#E3F2FD', icon: '📅' },
  ongoing:     { label: 'Đang chạy',   color: '#2E7D32', bg: '#E8F5E9', icon: '🚗' },
  completed:   { label: 'Hoàn thành',  color: '#546E7A', bg: '#ECEFF1', icon: '✅' },
  cancelled:   { label: 'Đã hủy',      color: '#B71C1C', bg: '#FFEBEE', icon: '❌' },
};

const TABS = [
  { key: 'all',       label: 'Tất cả' },
  { key: 'scheduled', label: 'Đã lên lịch' },
  { key: 'ongoing',   label: 'Đang chạy' },
  { key: 'completed', label: 'Hoàn thành' },
];

// ─── Trip Card ────────────────────────────────────────────
const TripCard = ({ trip, routeName, onCancel, canceling }) => {
  const cfg   = STATUS_CONFIG[trip.status] ?? STATUS_CONFIG.scheduled;
  const filled = trip.totalSeats - trip.availableSeats;
  const fillPct = Math.round((filled / trip.totalSeats) * 100);
  const displayRouteName = routeName
    ?? (trip.pickupProvince && trip.dropoffProvince
      ? `${trip.pickupProvince} → ${trip.dropoffProvince}`
      : 'Tuyến đã tạo');

  return (
    <View style={styles.tripCard}>
      {/* Top row */}
      <View style={styles.tripTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tripRoute}>{displayRouteName}</Text>
          <Text style={styles.tripDateTime}>
            📅 {trip.departureDate}  🕐 {trip.departureTime}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.color }]}>
            {cfg.icon} {cfg.label}
          </Text>
        </View>
      </View>

      {/* Seat bar */}
      <View style={styles.seatsRow}>
        <Text style={styles.seatsLabel}>Ghế đã đặt</Text>
        <Text style={styles.seatsCount}>{filled}/{trip.totalSeats}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${fillPct}%` }]} />
      </View>

      {/* Footer */}
      <View style={styles.tripFooter}>
        <View style={styles.fareBox}>
          <Text style={styles.fareLabel}>Doanh thu</Text>
          <Text style={styles.fareValue}>
            {(trip.fixedFare * filled).toLocaleString('vi-VN')} đ
          </Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.farePerSeat}>
            {trip.fixedFare.toLocaleString('vi-VN')} đ/ghế
          </Text>
          {trip.status === 'scheduled' && (
            <TouchableOpacity
              style={[styles.cancelBtn, canceling && styles.cancelBtnDisabled]}
              onPress={() => onCancel?.(trip)}
              disabled={canceling}
            >
              {canceling ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.cancelBtnText}>Hủy chuyến</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────
const AllTripsScreen = ({ navigation }) => {
  const [trips, setTrips]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab]   = useState('all');
  const [cancelingTripId, setCancelingTripId] = useState(null);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalModalMessage, setApprovalModalMessage] = useState('');

  const showApprovalModal = useCallback((message) => {
    setApprovalModalMessage(message || 'Vui long cap nhat ho so tai xe.');
    setApprovalModalVisible(true);
  }, []);

  const goToDriverProfile = useCallback(() => {
    setApprovalModalVisible(false);
    navigation?.navigate('DriverProfile');
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;

    const verifyApproval = async () => {
      try {
        await warmupDriverProfileApprovalCache();
      } catch (e) {
        // keep fallback check below
      }

      const result = await ensureApprovedProfileForTripFeature(
        'Vui long cap nhat ho so tai xe va doi admin duyet truoc khi xem danh sach chuyen xe.'
      );

      if (!result.allowed && !cancelled) {
        showApprovalModal(result.message);
      }
    };

    const unsubscribe = navigation?.addListener?.('focus', verifyApproval);
    verifyApproval();

    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigation, showApprovalModal]);

  const handleCreateTripPress = useCallback(async () => {
    const result = await ensureApprovedProfileBeforeCreateTrip();
    if (result.allowed) {
      navigation?.navigate('CreateTrip');
      return;
    }
    showApprovalModal(result.message);
  }, [navigation, showApprovalModal]);

  const loadData = useCallback(async () => {
    try {
      const tripsData = await getDriverTrips();
      setTrips(tripsData);
      setLoadError('');
    } catch (e) {
      const message = e?.message || 'Không tải được danh sách chuyến xe.';
      setLoadError(message);
      Alert.alert('Lỗi tải dữ liệu', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCancelTrip = useCallback((trip) => {
    if (!trip?.id) {
      return;
    }

    Alert.alert(
      'Xác nhận hủy chuyến',
      `Bạn muốn hủy chuyến ngày ${trip.departureDate} lúc ${trip.departureTime}?`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy chuyến',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelingTripId(trip.id);
              await cancelDriverTrip(trip.id);
              setTrips((prev) => prev.map((t) => (t.id === trip.id ? { ...t, status: 'cancelled' } : t)));
              Alert.alert('Thành công', 'Đã hủy chuyến xe.');
            } catch (e) {
              Alert.alert('Lỗi', e.message || 'Không thể hủy chuyến.');
            } finally {
              setCancelingTripId(null);
            }
          },
        },
      ]
    );
  }, []);

  const filtered = activeTab === 'all'
    ? trips
    : trips.filter(t => t.status === activeTab);

  // Summary stats (all trips)
  const totalRevenue = trips
    .filter(t => t.status !== 'cancelled')
    .reduce((sum, t) => sum + t.fixedFare * (t.totalSeats - t.availableSeats), 0);
  const ongoingCount   = trips.filter(t => t.status === 'ongoing').length;
  const scheduledCount = trips.filter(t => t.status === 'scheduled').length;
  const completedCount = trips.filter(t => t.status === 'completed').length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📋 Tất cả chuyến xe</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{ongoingCount}</Text>
          <Text style={styles.stripLabel}>Đang chạy</Text>
        </View>
        <View style={styles.stripDivider} />
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{scheduledCount}</Text>
          <Text style={styles.stripLabel}>Đã lên lịch</Text>
        </View>
        <View style={styles.stripDivider} />
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{completedCount}</Text>
          <Text style={styles.stripLabel}>Hoàn thành</Text>
        </View>
        <View style={styles.stripDivider} />
        <View style={[styles.stripItem, { flex: 1.6 }]}>
          <Text style={[styles.stripValue, { color: THEME.accent }]}>
            {totalRevenue > 0 ? (totalRevenue / 1000).toFixed(0) + 'k' : '0'}
          </Text>
          <Text style={styles.stripLabel}>Doanh thu (đ)</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
              {tab.key !== 'all' && (
                <Text style={styles.tabCount}>
                  {' '}({trips.filter(t => t.status === tab.key).length})
                </Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={THEME.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🗓️</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'all' ? 'Chưa có chuyến xe nào' : `Không có chuyến "${STATUS_CONFIG[activeTab]?.label ?? activeTab}"`}
            </Text>
            {!!loadError && (
              <Text style={styles.errorText}>{loadError}</Text>
            )}
            {activeTab === 'all' && (
              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleCreateTripPress}
              >
                <Text style={styles.createBtnText}>✨ Tạo chuyến xe</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onCancel={handleCancelTrip}
            canceling={cancelingTripId === item.id}
          />
        )}
        ListFooterComponent={<View style={{ height: 30 }} />}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateTripPress}
      >
        <Text style={styles.fabText}>✨</Text>
      </TouchableOpacity>

      <ProfileApprovalModal
        visible={approvalModalVisible}
        message={approvalModalMessage}
        onClose={() => setApprovalModalVisible(false)}
        onGoProfile={goToDriverProfile}
      />
    </View>
  );
};

export default AllTripsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FA' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F8FA' },

  // Header
  header: {
    backgroundColor: THEME.gradientStart,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  backIcon:    { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '300' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },

  // Stats strip
  statsStrip: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  stripItem:    { flex: 1, alignItems: 'center' },
  stripValue:   { fontSize: 18, fontWeight: '800', color: '#333' },
  stripLabel:   { fontSize: 10, color: '#999', marginTop: 2, textAlign: 'center' },
  stripDivider: { width: 1, backgroundColor: '#EEE', marginVertical: 4 },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E8E8E8',
    paddingHorizontal: 4,
  },
  tab:     { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: THEME.gradientStart },
  tabText: { fontSize: 12, color: '#999', fontWeight: '600' },
  tabTextActive: { color: THEME.gradientStart, fontWeight: '800' },
  tabCount: { fontSize: 11, color: '#aaa' },

  // List
  list: { padding: 12 },

  // Trip card
  tripCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  tripTop:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  tripRoute:    { fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 4 },
  tripDateTime: { fontSize: 12, color: '#888' },
  statusBadge:  { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  statusText:   { fontSize: 11, fontWeight: '700' },

  seatsRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  seatsLabel: { fontSize: 12, color: '#777' },
  seatsCount: { fontSize: 12, fontWeight: '700', color: '#333' },
  barBg: { height: 5, backgroundColor: '#F0F0F0', borderRadius: 3, marginBottom: 10 },
  barFill: { height: 5, backgroundColor: THEME.gradientStart, borderRadius: 3 },

  tripFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  fareBox:     {},
  fareLabel:   { fontSize: 11, color: '#999' },
  fareValue:   { fontSize: 15, fontWeight: '800', color: THEME.accent },
  footerRight: { alignItems: 'flex-end' },
  farePerSeat: { fontSize: 12, color: '#AAA' },
  cancelBtn: {
    marginTop: 8,
    backgroundColor: '#B71C1C',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 92,
    alignItems: 'center',
  },
  cancelBtnDisabled: { opacity: 0.7 },
  cancelBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Empty
  emptyBox:      { alignItems: 'center', paddingTop: 60 },
  emptyIcon:     { fontSize: 48, marginBottom: 12 },
  emptyText:     { fontSize: 15, color: '#999', marginBottom: 20 },
  errorText:     { fontSize: 12, color: '#B71C1C', marginBottom: 14, textAlign: 'center', paddingHorizontal: 16 },
  createBtn:     { backgroundColor: THEME.gradientStart, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  createBtnText: { color: '#fff', fontWeight: '700' },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, right: 22,
    backgroundColor: THEME.gradientStart, width: 52, height: 52,
    borderRadius: 26, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: THEME.gradientStart,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  fabText: { fontSize: 22 },
});
