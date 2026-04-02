import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, RefreshControl,
  Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../config/config';
import {
  getDriverTrips,
  cancelDriverTrip,
  startDriverTrip,
  completeDriverTrip,
  peekDriverTripsSnapshot,
} from '../../services/api';
import { DRIVER_BOTTOM_NAV_INSET } from '../../components/DriverBottomNav';
import SkeletonShimmer from '../../components/SkeletonShimmer';
import {
  ensureApprovedProfileBeforeCreateTrip,
  ensureApprovedProfileForTripFeature,
  warmupDriverProfileApprovalCache,
} from '../../services/driverProfileGuard';
import ProfileApprovalModal from '../../components/ProfileApprovalModal';

const THEME = {
  gradientStart: '#00B14F',
  accent: '#00A63E',
};

const STATUS_CONFIG = {
  scheduled: { label: 'Đã lên lịch', color: '#1565C0', bg: '#E3F2FD', iconName: 'calendar-outline' },
  ongoing: { label: 'Đang chạy', color: '#2E7D32', bg: '#E8F5E9', iconName: 'car-outline' },
  completed: { label: 'Hoàn thành', color: '#546E7A', bg: '#ECEFF1', iconName: 'checkmark-circle-outline' },
  cancelled: { label: 'Đã hủy', color: '#B71C1C', bg: '#FFEBEE', iconName: 'close-circle-outline' },
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
  const cfg = STATUS_CONFIG[trip.status] ?? STATUS_CONFIG.scheduled;
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
          <View style={styles.tripDateTimeRow}>
            <Ionicons name="calendar-outline" size={13} color="#6B7280" />
            <Text style={styles.tripDateTime}>{trip.departureDate}</Text>
            <Ionicons name="time-outline" size={13} color="#6B7280" style={{ marginLeft: 8 }} />
            <Text style={styles.tripDateTime}>{trip.departureTime}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <View style={styles.statusTextRow}>
            <Ionicons name={cfg.iconName} size={13} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
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

const TripCardSkeleton = () => (
  <View style={styles.tripCardSkeleton}>
    <SkeletonShimmer style={styles.skeletonLineLg} />
    <SkeletonShimmer style={styles.skeletonLineMd} />
    <SkeletonShimmer style={styles.skeletonLineSm} />
  </View>
);

// ─── Main Screen ──────────────────────────────────────────
const AllTripsScreen = ({ navigation }) => {
  const listScrollRef = useRef(null);
  const initialTripsRef = useRef(peekDriverTripsSnapshot());
  const [trips, setTrips] = useState(initialTripsRef.current);
  const [loading, setLoading] = useState(initialTripsRef.current.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [cancelingTripId, setCancelingTripId] = useState(null);
  const [processingTripId, setProcessingTripId] = useState(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [tripToCancel, setTripToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalModalMessage, setApprovalModalMessage] = useState('');

  const showApprovalModal = useCallback((message) => {
    setApprovalModalMessage(message || 'Vui lòng cập nhật hồ sơ tài xế.');
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
        'Vui lòng cập nhật hồ sơ tài xế và đợi admin duyệt trước khi xem danh sách chuyến xe.',
        { preferCache: true, allowNetwork: false }
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

  const loadData = useCallback(async ({ force = false } = {}) => {
    try {
      const tripsData = await getDriverTrips({ force });
      setTrips(tripsData);
      setLoadError('');
    } catch (e) {
      const message = e?.message || 'Không tải được danh sách chuyến xe.';
      setLoadError(message);
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
        `Chuyến này chỉ được bắt đầu sau ${departureAt.toLocaleString('vi-VN')}.`
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
  const isInitialLoading = loading && !refreshing && trips.length === 0;

  const getTabCount = useCallback((tabKey) => {
    if (tabKey === 'all') {
      return trips.length;
    }
    return trips.filter((t) => t.status === tabKey).length;
  }, [trips]);

  useEffect(() => {
    // Always return to top when tab/data state changes to avoid stale offset gaps.
    requestAnimationFrame(() => {
      listScrollRef.current?.scrollTo?.({ x: 0, y: 0, animated: false });
    });
  }, [activeTab, filtered.length]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Ionicons name="list-outline" size={18} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Tất cả chuyến xe</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.createTripMainBtn} onPress={handleCreateTripPress}>
          <View style={styles.primaryBtnIconRow}>
            <Ionicons name="sparkles-outline" size={14} color="#FFFFFF" />
            <Text style={styles.createTripMainBtnText}>Tạo chuyến mới</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => { setRefreshing(true); loadData({ force: true }); }}
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
        bounces={false}
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

      {(loading || refreshing) && (
        <View style={styles.syncHintWrap}>
          <ActivityIndicator size="small" color={THEME.gradientStart} />
          <Text style={styles.syncHintText}>Đang cập nhật dữ liệu...</Text>
        </View>
      )}

      {/* List */}
      <ScrollView
        ref={listScrollRef}
        style={styles.listScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData({ force: true }); }}
          />
        }
        contentContainerStyle={[
          styles.list,
          filtered.length === 0 && styles.listEmptyState,
        ]}
      >
        {isInitialLoading ? (
          <>
            <TripCardSkeleton />
            <TripCardSkeleton />
            <TripCardSkeleton />
          </>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-clear-outline" size={42} color="#94A3B8" style={styles.emptyIcon} />
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
                <View style={styles.primaryBtnIconRow}>
                  <Ionicons name="add-circle-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.createBtnText}>Tạo chuyến xe</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map((item) => (
            <TripCard
              key={String(item.id)}
              trip={item}
              onCancel={handleCancelTrip}
              onStart={handleStartTrip}
              onComplete={handleCompleteTrip}
              onViewDetail={handleViewDetail}
              actioning={cancelingTripId === item.id || processingTripId === item.id}
            />
          ))
        )}

        <View style={styles.listBottomSpacer} />
      </ScrollView>

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

    </View>
  );
};

export default AllTripsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F8FA' },

  // Header
  header: {
    backgroundColor: THEME.gradientStart,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  backIcon: { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '300' },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

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
  primaryBtnIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    height: 52,
    maxHeight: 52,
    minHeight: 52,
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  syncHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  syncHintText: {
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
  },

  // List
  listScroll: { flex: 1 },
  list: { paddingHorizontal: 10, paddingTop: 2, paddingBottom: DRIVER_BOTTOM_NAV_INSET + 16 },
  listEmptyState: { flexGrow: 1 },
  listBottomSpacer: { height: 16 },
  tripCardSkeleton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F2F2F2',
  },
  skeletonLineLg: { height: 14, borderRadius: 8, width: '72%', backgroundColor: '#ECEFF3', marginBottom: 10 },
  skeletonLineMd: { height: 12, borderRadius: 8, width: '52%', backgroundColor: '#ECEFF3', marginBottom: 8 },
  skeletonLineSm: { height: 10, borderRadius: 8, width: '38%', backgroundColor: '#ECEFF3' },

  // Trip card
  tripCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    borderWidth: 1,
    borderColor: '#F2F2F2',
  },
  tripTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  tripRoute: { fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 4 },
  tripDateTimeRow: { flexDirection: 'row', alignItems: 'center' },
  tripDateTime: { fontSize: 12, color: '#888', marginLeft: 4 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  statusTextRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },

  seatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  seatsLabel: { fontSize: 12, color: '#777' },
  seatsCount: { fontSize: 12, fontWeight: '700', color: '#333' },
  barBg: { height: 5, backgroundColor: '#F0F0F0', borderRadius: 3, marginBottom: 10 },
  barFill: { height: 5, backgroundColor: THEME.gradientStart, borderRadius: 3 },

  tripFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  fareBox: {},
  fareLabel: { fontSize: 11, color: '#999' },
  fareValue: { fontSize: 15, fontWeight: '800', color: THEME.accent },
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
  emptyBox: { alignItems: 'center', paddingTop: 36 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#999', marginBottom: 20 },
  errorText: { fontSize: 12, color: '#B71C1C', marginBottom: 14, textAlign: 'center', paddingHorizontal: 16 },
  createBtn: { backgroundColor: THEME.gradientStart, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
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
