import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, ScrollView,
  Alert, Modal, TextInput,
} from 'react-native';
import { COLORS } from '../../config/config';
import { getDriverTrips, cancelDriverTrip, startDriverTrip, completeDriverTrip } from '../../services/api';
import DriverBottomNav from '../../components/DriverBottomNav';
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
  { key: 'all', label: 'Tất cả', dot: '#9CA3AF' },
  { key: 'scheduled', label: 'Đã lên lịch', dot: '#3B82F6' },
  { key: 'ongoing', label: 'Đang chạy', dot: '#10B981' },
  { key: 'completed', label: 'Hoàn thành', dot: '#64748B' },
  { key: 'cancelled', label: 'Đã hủy', dot: '#EF4444' },
];

const parseTripDeparture = (trip) => {
  if (!trip?.departureDate || !trip?.departureTime) {
    return null;
  }

  let datePart = trip.departureDate.trim();
  const timePart = trip.departureTime.trim();

  if (datePart.includes('/')) {
    const [dd, mm, yyyy] = datePart.split('/');
    if (!dd || !mm || !yyyy) return null;
    datePart = `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(`${datePart}T${timePart}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// ─── Trip Card ────────────────────────────────────────────
const TripCard = ({ trip, routeName, onCancel, onStart, onComplete, onViewDetail, actioning }) => {
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
          <View style={styles.actionBtnsRow}>
            {trip.status === 'scheduled' && (
              <>
                <TouchableOpacity
                  style={[styles.startBtn, actioning && styles.cancelBtnDisabled]}
                  onPress={() => onStart?.(trip)}
                  disabled={actioning}
                >
                  {actioning ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.startBtnText}>Bắt đầu</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelBtn, actioning && styles.cancelBtnDisabled]}
                  onPress={() => onCancel?.(trip)}
                  disabled={actioning}
                >
                  {actioning ? (
                    <ActivityIndicator color="#B71C1C" size="small" />
                  ) : (
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {trip.status === 'ongoing' && (
              <TouchableOpacity
                style={[styles.completeBtn, actioning && styles.cancelBtnDisabled]}
                onPress={() => onComplete?.(trip)}
                disabled={actioning}
              >
                {actioning ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.completeBtnText}>Kết thúc</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => onViewDetail?.(trip)}
              disabled={actioning}
            >
              <Text style={styles.detailBtnText}>Chi tiết</Text>
            </TouchableOpacity>
          </View>
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
  const [processingTripId, setProcessingTripId] = useState(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [tripToCancel, setTripToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
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

    setTripToCancel(trip);
    setCancelReason('');
    setCancelModalVisible(true);
  }, []);

  const confirmCancelTrip = useCallback(async () => {
    if (!tripToCancel?.id) {
      return;
    }

    try {
      setCancelingTripId(tripToCancel.id);
      await cancelDriverTrip(tripToCancel.id, cancelReason.trim() || null);
      setTrips((prev) => prev.map((t) => (t.id === tripToCancel.id ? { ...t, status: 'cancelled' } : t)));
      setCancelModalVisible(false);
      setTripToCancel(null);
      setCancelReason('');
      Alert.alert('Thành công', 'Đã hủy chuyến xe.');
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể hủy chuyến.');
    } finally {
      setCancelingTripId(null);
    }
  }, [tripToCancel, cancelReason]);

  const handleStartTrip = useCallback(async (trip) => {
    if (!trip?.id) return;

    const departureAt = parseTripDeparture(trip);
    const now = new Date();
    if (departureAt && now.getTime() < departureAt.getTime()) {
      Alert.alert(
        'Chưa thể bắt đầu chuyến',
        `Chuyen nay chi duoc bat dau sau ${departureAt.toLocaleString('vi-VN')}.`
      );
      return;
    }

    try {
      setProcessingTripId(trip.id);
      const updated = await startDriverTrip(trip.id);
      setTrips((prev) => prev.map((t) => (t.id === trip.id ? { ...t, ...updated } : t)));
      Alert.alert('Thành công', 'Chuyến xe đã bắt đầu.');
    } catch (e) {
      const message = e?.message || 'Không thể bắt đầu chuyến.';
      if (message.toLowerCase().includes('khoi hanh') || message.toLowerCase().includes('started after')) {
        Alert.alert('Chưa thể bắt đầu chuyến', message);
      } else {
        Alert.alert('Lỗi', message);
      }
    } finally {
      setProcessingTripId(null);
    }
  }, []);

  const handleCompleteTrip = useCallback(async (trip) => {
    if (!trip?.id) return;

    try {
      setProcessingTripId(trip.id);
      const updated = await completeDriverTrip(trip.id);
      setTrips((prev) => prev.map((t) => (t.id === trip.id ? { ...t, ...updated } : t)));
      Alert.alert('Thành công', 'Đã kết thúc chuyến xe.');
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không thể kết thúc chuyến.');
    } finally {
      setProcessingTripId(null);
    }
  }, []);

  const handleViewDetail = useCallback((trip) => {
    if (!trip?.id) return;
    navigation?.navigate('TripDetail', { tripId: trip.id });
  }, [navigation]);

  const filtered = activeTab === 'all'
    ? trips
    : trips.filter(t => t.status === activeTab);

  const getTabCount = useCallback((tabKey) => {
    if (tabKey === 'all') {
      return trips.length;
    }
    return trips.filter((t) => t.status === tabKey).length;
  }, [trips]);

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

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.createTripMainBtn} onPress={handleCreateTripPress}>
          <Text style={styles.createTripMainBtnText}>✨ Tạo chuyến mới</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => { setRefreshing(true); loadData(); }}
        >
          <Text style={styles.refreshBtnText}>Làm mới</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={[styles.tabDot, { backgroundColor: tab.dot }]} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
            <View style={[styles.tabCountBadge, activeTab === tab.key && styles.tabCountBadgeActive]}>
              <Text style={[styles.tabCount, activeTab === tab.key && styles.tabCountActive]}>{getTabCount(tab.key)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); loadData(); }}
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
            onStart={handleStartTrip}
            onComplete={handleCompleteTrip}
            onViewDetail={handleViewDetail}
            actioning={cancelingTripId === item.id || processingTripId === item.id}
          />
        )}
        ListFooterComponent={<View style={{ height: 110 }} />}
      />

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalCard}>
            <Text style={styles.cancelModalTitle}>Xác nhận hủy chuyến</Text>
            <Text style={styles.cancelModalDesc}>
              {tripToCancel
                ? `Bạn muốn hủy chuyến ngày ${tripToCancel.departureDate} lúc ${tripToCancel.departureTime}?`
                : 'Bạn muốn hủy chuyến này?'}
            </Text>

            <Text style={styles.reasonLabel}>Lý do hủy (tùy chọn)</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              style={styles.reasonInput}
              placeholder="Ví dụ: Xe gặp sự cố kỹ thuật"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={cancelingTripId !== tripToCancel?.id}
            />

            <View style={styles.cancelModalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setCancelModalVisible(false)}
                disabled={cancelingTripId === tripToCancel?.id}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnGhostText]}>Thoát</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger, cancelingTripId === tripToCancel?.id && styles.cancelBtnDisabled]}
                onPress={confirmCancelTrip}
                disabled={cancelingTripId === tripToCancel?.id}
              >
                {cancelingTripId === tripToCancel?.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalBtnText}>Xác nhận hủy</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ProfileApprovalModal
        visible={approvalModalVisible}
        message={approvalModalMessage}
        onClose={() => setApprovalModalVisible(false)}
        onGoProfile={goToDriverProfile}
      />

      <DriverBottomNav navigation={navigation} activeKey="trips" />
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

  actionRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },
  createTripMainBtn: {
    flex: 1,
    marginRight: 8,
    backgroundColor: THEME.gradientStart,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: THEME.gradientStart,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 7,
    elevation: 4,
  },
  createTripMainBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  refreshBtn: {
    width: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD8C2',
    backgroundColor: '#FFF7F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#C2410C',
    fontSize: 13,
    fontWeight: '700',
  },

  // Tabs
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E8E8E8',
  },
  tabBarContent: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: 0,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E8EAEE',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  tabActive: {
    backgroundColor: '#FFF1E8',
    borderWidth: 1,
    borderColor: '#FFC9A6',
  },
  tabDot: { width: 8, height: 8, borderRadius: 99 },
  tabText: { fontSize: 12, color: '#7A7D86', fontWeight: '700', marginLeft: 7 },
  tabTextActive: { color: THEME.gradientStart, fontWeight: '800' },
  tabCountBadge: {
    marginLeft: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 22,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  tabCountBadgeActive: {
    borderColor: '#FFBA8A',
    backgroundColor: '#FFF8F3',
  },
  tabCount: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  tabCountActive: { color: '#C2410C' },

  // List
  list: { paddingHorizontal: 10, paddingTop: 2, paddingBottom: 10 },

  // Trip card
  tripCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    borderWidth: 1,
    borderColor: '#F2F2F2',
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
  actionBtnsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  startBtn: {
    backgroundColor: '#166534',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 78,
  },
  startBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnDisabled: { opacity: 0.7 },
  cancelBtnText: { color: '#B71C1C', fontSize: 12, fontWeight: '800' },
  completeBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  completeBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  detailBtn: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    minWidth: 76,
    justifyContent: 'center',
  },
  detailBtnText: { color: '#92400E', fontSize: 12, fontWeight: '800' },

  // Empty
  emptyBox:      { alignItems: 'center', paddingTop: 36 },
  emptyIcon:     { fontSize: 48, marginBottom: 12 },
  emptyText:     { fontSize: 15, color: '#999', marginBottom: 20 },
  errorText:     { fontSize: 12, color: '#B71C1C', marginBottom: 14, textAlign: 'center', paddingHorizontal: 16 },
  createBtn:     { backgroundColor: THEME.gradientStart, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  createBtnText: { color: '#fff', fontWeight: '700' },

  // Cancel modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  cancelModalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cancelModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
  },
  cancelModalDesc: {
    marginTop: 8,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
  },
  reasonLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 82,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  cancelModalActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 9,
    marginLeft: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalBtnGhost: {
    backgroundColor: '#F3F4F6',
  },
  modalBtnDanger: {
    backgroundColor: '#B71C1C',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalBtnGhostText: {
    color: '#374151',
  },
});
