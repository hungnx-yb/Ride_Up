import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
  Animated, Easing,
} from 'react-native';
import { COLORS } from '../../config/config';
import { getDriverTrips, getDriverStats } from '../../services/api';
import DriverBottomNav from '../../components/DriverBottomNav';
import {
  ensureApprovedProfileBeforeCreateTrip,
  ensureApprovedProfileForTripFeature,
  warmupDriverProfileApprovalCache,
} from '../../services/driverProfileGuard';
import ProfileApprovalModal from '../../components/ProfileApprovalModal';

// Orange-red theme (matching web UI)
const THEME = {
  gradientStart: '#E65100',
  gradientEnd:   '#C62828',
  accent:        '#FF6F00',
  cardBorder:    '#FFF3E0',
};

const STATUS_CONFIG = {
  scheduled:   { label: 'Đã lên lịch',   color: '#1565C0', bg: '#E3F2FD' },
  ongoing:     { label: 'Đang chạy',     color: '#2E7D32', bg: '#E8F5E9' },
  completed:   { label: 'Hoàn thành',    color: '#546E7A', bg: '#ECEFF1' },
  cancelled:   { label: 'Đã hủy',        color: '#B71C1C', bg: '#FFEBEE' },
  pending:     { label: 'Chờ khởi hành', color: '#E65100', bg: '#FFF3E0' },
  in_progress: { label: 'Đang diễn ra',  color: '#1565C0', bg: '#E3F2FD' },
};

const QUICK_ACTIONS = [
  { icon: '✨', label: 'Tạo\nchuyến xe',  bg: '#FFF3E0', iconColor: '#E65100', screen: 'CreateTrip' },
  { icon: '📋', label: 'Tất cả\nchuyến',  bg: '#E3F2FD', iconColor: '#1565C0', screen: 'AllTrips' },
  { icon: '💬', label: 'Tin nhắn\nchat',  bg: '#EDE9FE', iconColor: '#6D28D9', screen: 'DriverMessages' },
  { icon: '🪪', label: 'Hồ sơ\ntài xế',   bg: '#E8F5E9', iconColor: '#2E7D32', screen: 'DriverProfile' },
];

const DriverHomeScreen = ({ user, onLogout, navigation }) => {
  const [trips, setTrips]   = useState([]);
  const [stats, setStats]   = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalModalMessage, setApprovalModalMessage] = useState('');

  const showApprovalModal = (message) => {
    setApprovalModalMessage(message || 'Vui long cap nhat ho so tai xe.');
    setApprovalModalVisible(true);
  };

  const goToDriverProfile = () => {
    setApprovalModalVisible(false);
    navigation?.navigate('DriverProfile');
  };

  const handleCreateTripPress = async () => {
    const result = await ensureApprovedProfileBeforeCreateTrip();
    if (result.allowed) {
      navigation?.navigate('CreateTrip');
      return;
    }

    showApprovalModal(result.message);
  };

  const handleAllTripsPress = async () => {
    const result = await ensureApprovedProfileForTripFeature(
      'Vui long cap nhat ho so tai xe va doi admin duyet truoc khi xem danh sach chuyen xe.'
    );
    if (result.allowed) {
      navigation?.navigate('AllTrips');
      return;
    }

    showApprovalModal(result.message);
  };

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim  = useRef(new Animated.Value(0)).current;
  const listAnim   = useRef(new Animated.Value(0)).current;

  const runEntrance = () => {
    Animated.stagger(120, [
      Animated.timing(headerAnim, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(statsAnim,  { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      Animated.timing(listAnim,   { toValue: 1, duration: 400, easing: Easing.out(Easing.quad),      useNativeDriver: true }),
    ]).start();
  };

  const loadData = async (isRefresh = false) => {
    try {
      const [tripsRes, statsRes, profileRes] = await Promise.allSettled([
        getDriverTrips(),
        getDriverStats(),
        warmupDriverProfileApprovalCache({ force: isRefresh }),
      ]);

      if (tripsRes.status === 'fulfilled') {
        setTrips(tripsRes.value);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
      const firstError = [tripsRes, statsRes, profileRes]
        .find((r) => r.status === 'rejected');
      if (firstError) {
        setLoadError(firstError.reason?.message || 'Một phần dữ liệu không tải được.');
      } else {
        setLoadError('');
      }
    } catch (e) {
      setLoadError(e?.message || 'Không tải được dữ liệu tài xế.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData().then(runEntrance);
  }, []);

  const formatCurrency = (n) =>
    new Intl.NumberFormat('vi-VN').format(n) + '\u20ab';

  const todayStr      = new Date().toISOString().split('T')[0];
  const todayTrips    = trips.filter((t) => t.departureDate === todayStr || t.status === 'ongoing');
  const upcomingTrips = trips.filter((t) => t.departureDate > todayStr && t.status === 'scheduled');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.gradientStart} />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  const headerTranslate = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] });
  const statsScale      = statsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const listTranslate   = listAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={THEME.gradientStart}
            onRefresh={() => { setRefreshing(true); loadData(true); }}
          />
        }
      >
      {/* ── Header (orange-red gradient) ── */}
      <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerTranslate }] }]}>
        <View style={styles.headerPattern} />
        <View style={styles.headerRow}>
          <View>
            <View style={styles.sparkleRow}>
              <Text style={styles.sparkleIcon}>✨</Text>
              <Text style={styles.sparkleText}>Tài xế RideUp</Text>
            </View>
            <Text style={styles.userName}>{user?.fullName || 'Tài xế'}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>⭐ {user?.rating ?? stats?.rating ?? '—'}</Text>
              <Text style={styles.totalRidesText}> · {user?.totalRides ?? stats?.totalReviews ?? 0} chuyến</Text>
            </View>
            {user?.vehicleModel && (
              <Text style={styles.vehicleText}>🚗 {user.vehicleModel} · {user.vehiclePlate}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Stats card (lifted) ── */}
      {stats && (
        <Animated.View style={[styles.statsCard, { opacity: statsAnim, transform: [{ scale: statsScale }] }]}>
          <StatMini icon="📋" label="Chuyến tháng"  value={stats.thisMonth.totalRides} />
          <View style={styles.statDivider} />
          <StatMini icon="✅" label="Hoàn thành"    value={stats.thisMonth.completedRides} />
          <View style={styles.statDivider} />
          <StatMini icon="💰" label="Doanh thu"     value={formatCurrency(stats.thisMonth.revenue)} small />
        </Animated.View>
      )}

      {/* ── Revenue preview (orange card) ── */}
      {stats && (
        <Animated.View style={[styles.revenueCard, { opacity: statsAnim }]}>
          <View style={styles.revenueLeft}>
            <Text style={styles.revenueLabel}>Doanh thu dự kiến tháng này</Text>
            <Text style={styles.revenueValue}>{formatCurrency(stats.thisMonth.revenue)}</Text>
          </View>
          <Text style={styles.revenueTrendIcon}>📈</Text>
        </Animated.View>
      )}

      {/* ── Quick Actions ── */}
      <Animated.View style={[styles.section, { opacity: listAnim }]}>
        <Text style={styles.sectionTitle}>⚡ Chức năng</Text>
        {!!loadError && <Text style={styles.inlineError}>{loadError}</Text>}
        <View style={styles.actionsRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.screen}
              style={[styles.actionBtn, { backgroundColor: a.bg }]}
              activeOpacity={0.75}
              onPress={() => {
                if (a.screen === 'CreateTrip') {
                  handleCreateTripPress();
                  return;
                }
                if (a.screen === 'AllTrips') {
                  handleAllTripsPress();
                  return;
                }
                navigation?.navigate(a.screen);
              }}
            >
              <Text style={[styles.actionIcon, { color: a.iconColor }]}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* ── Chuyến hôm nay ── */}
      <Animated.View style={[styles.section, { opacity: listAnim, transform: [{ translateY: listTranslate }] }]}>
        <Text style={styles.sectionTitle}>📅 Hôm nay ({todayTrips.length})</Text>
        {todayTrips.length === 0 ? (
          <EmptyCard
            text="Không có chuyến hôm nay"
            btnText="✨ Tạo chuyến xe mới"
            onPress={handleCreateTripPress}
          />
        ) : (
          todayTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} formatCurrency={formatCurrency} />
          ))
        )}
      </Animated.View>

      {/* ── Chuyến sắp tới ── */}
      {upcomingTrips.length > 0 && (
        <Animated.View style={[styles.section, { opacity: listAnim }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>🗓️ Sắp tới ({upcomingTrips.length})</Text>
            <TouchableOpacity onPress={handleAllTripsPress}>
              <Text style={styles.seeAllText}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>
          {upcomingTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} formatCurrency={formatCurrency} />
          ))}
        </Animated.View>
      )}

      <View style={styles.bottomPad} />

        <ProfileApprovalModal
          visible={approvalModalVisible}
          message={approvalModalMessage}
          onClose={() => setApprovalModalVisible(false)}
          onGoProfile={goToDriverProfile}
        />
      </ScrollView>
      <DriverBottomNav navigation={navigation} activeKey="home" />
    </View>
  );
};

// ─── Sub-components ─────────────────────────────────────────

const StatMini = ({ icon, label, value, small }) => (
  <View style={styles.statMini}>
    <Text style={styles.statMiniIcon}>{icon}</Text>
    <Text style={[styles.statMiniValue, small && { fontSize: 11 }]}>{value}</Text>
    <Text style={styles.statMiniLabel}>{label}</Text>
  </View>
);

const TripCard = ({ trip, formatCurrency }) => {
  const status = STATUS_CONFIG[trip.status] || STATUS_CONFIG.scheduled;
  const filled = trip.totalSeats - trip.availableSeats;
  const routeLabel = (trip.pickupProvince && trip.dropoffProvince)
    ? `${trip.pickupProvince} → ${trip.dropoffProvince}`
    : 'Tuyến đã tạo';
  return (
    <TouchableOpacity style={styles.tripCard} activeOpacity={0.85}>
      <View style={styles.tripCardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.tripFare}>{formatCurrency(trip.fixedFare)}/người</Text>
      </View>
      <Text style={styles.tripRoute}>📍 {routeLabel}</Text>
      <View style={styles.tripFooter}>
        <Text style={styles.tripTime}>🕑 {trip.departureDate} · {trip.departureTime}</Text>
        <View style={styles.seatBadge}>
          <Text style={styles.seatText}>💺 {filled}/{trip.totalSeats} khách</Text>
        </View>
      </View>
      {/* seat fill bar */}
      <View style={styles.seatBarBg}>
        <View style={[styles.seatBarFill, { width: `${(filled / trip.totalSeats) * 100}%` }]} />
      </View>
    </TouchableOpacity>
  );
};

const EmptyCard = ({ text, btnText, onPress }) => (
  <View style={styles.emptyBox}>
    <Text style={styles.emptyText}>{text}</Text>
    <TouchableOpacity style={styles.emptyBtn} onPress={onPress}>
      <Text style={styles.emptyBtnText}>{btnText}</Text>
    </TouchableOpacity>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: COLORS.background },
  container:        { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText:      { marginTop: 12, color: COLORS.textLight },

  // Header
  header: {
    backgroundColor: THEME.gradientStart,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 36,
    overflow: 'hidden',
  },
  headerPattern: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: THEME.gradientEnd, opacity: 0.35,
  },
  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sparkleRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sparkleIcon:    { fontSize: 14, marginRight: 6 },
  sparkleText:    { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  userName:       { color: COLORS.white, fontSize: 24, fontWeight: '800', marginTop: 2 },
  ratingRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  ratingText:     { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  totalRidesText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  vehicleText:    { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 4,
  },
  logoutText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // Stats card (lifted)
  statsCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginTop: -16, borderRadius: 16, padding: 14,
    shadowColor: THEME.gradientStart, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
    borderWidth: 1.5, borderColor: THEME.cardBorder,
  },
  statMini:      { flex: 1, alignItems: 'center' },
  statDivider:   { width: 1, backgroundColor: COLORS.border },
  statMiniIcon:  { fontSize: 18 },
  statMiniValue: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  statMiniLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2, textAlign: 'center' },

  // Revenue card
  revenueCard: {
    marginHorizontal: 16, marginTop: 14, borderRadius: 16,
    backgroundColor: THEME.gradientStart,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    shadowColor: THEME.gradientStart, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  revenueLeft:      { flex: 1 },
  revenueLabel:     { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 },
  revenueValue:     { color: COLORS.white, fontSize: 22, fontWeight: '800' },
  revenueTrendIcon: { fontSize: 36 },

  // Section
  section:          { paddingHorizontal: 16, marginTop: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:     { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  seeAllText:       { fontSize: 13, color: THEME.gradientStart, fontWeight: '600', marginBottom: 12 },

  // Quick Actions
  actionsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  inlineError: { color: '#B71C1C', fontSize: 12, marginBottom: 8 },
  actionBtn: {
    width: '48%', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  actionIcon:  { fontSize: 22 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.text, marginTop: 6, textAlign: 'center', lineHeight: 16 },

  // Trip card
  tripCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  tripCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:      { fontSize: 12, fontWeight: '700' },
  tripFare:        { fontSize: 14, fontWeight: '700', color: THEME.accent },
  tripRoute:       { fontSize: 13, color: COLORS.text, marginBottom: 3, lineHeight: 20 },
  tripFooter:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  tripTime:        { fontSize: 12, color: COLORS.textLight },
  seatBadge:       { backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  seatText:        { fontSize: 12, color: THEME.gradientStart, fontWeight: '600' },
  seatBarBg:       { height: 4, backgroundColor: COLORS.border, borderRadius: 2 },
  seatBarFill:     { height: 4, backgroundColor: THEME.gradientStart, borderRadius: 2 },

  // Empty
  emptyBox:     { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: THEME.cardBorder },
  emptyText:    { fontSize: 14, color: COLORS.textMuted, marginBottom: 14 },
  emptyBtn: {
    backgroundColor: THEME.gradientStart, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
    shadowColor: THEME.gradientStart, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  bottomPad: { height: 106 },
});

export default DriverHomeScreen;
