/**
 * @fileoverview Màn hình Dashboard chính của Admin trong ứng dụng RideUp.
 *
 * Hiển thị KPI hôm nay, KPI tháng, dữ liệu địa lý (tỉnh/xã) và feed hoạt động gần đây.
 * Tích hợp polling tự động để theo dõi tiến độ đồng bộ địa lý khi đang chạy.
 *
 * API được gọi:
 *  - getAdminStats()       → GET /admin/stats               (cache 15s)
 *  - getLocationStats()    → GET /api/locations/admin/stats (cache 10s)
 *  - triggerLocationSync() → POST /api/locations/admin/sync
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, Animated, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_COLORS, ADMIN_SHADOW, GRADIENT_HEADER } from '../../config/AdminTheme';
import { getAdminStats, getLocationStats, triggerLocationSync } from '../../services/api';

/** Map type activity → tên icon Ionicons tương ứng để hiển thị trong feed. */
const ACTIVITY_ICONS = {
  new_booking: 'clipboard-outline',
  ride_completed: 'checkmark-circle-outline',
  new_driver: 'car-outline',
  payment: 'cash-outline',
  cancelled: 'close-circle-outline',
};

/** Cấu hình 4 nút Quick Action: icon, label, màu sắc và màn hình đích. */
const QUICK_ACTIONS = [
  { icon: 'shield-checkmark-outline', label: 'Duyệt hồ sơ\nTài xế', iconBg: '#DCFCE7', iconColor: '#16A34A', screen: 'AdminDriverApproval' },
  { icon: 'people-outline', label: 'Quản lý\nNgười dùng', iconBg: '#DBEAFE', iconColor: '#2563EB', screen: 'ManageUsers' },
  { icon: 'bar-chart-outline', label: 'Báo cáo\nThống kê', iconBg: '#FEF3C7', iconColor: '#D97706', screen: 'Reports' },
  { icon: 'settings-outline', label: 'Cài đặt\nHệ thống', iconBg: '#EDE9FE', iconColor: '#7C3AED', screen: 'Settings' },
];

/**
 * Màn hình Dashboard chính của Admin.
 *
 * @param {{ user: object, onLogout: Function, navigation: object }} props
 */
const AdminHomeScreen = ({ user, onLogout, navigation }) => {
  /** Dữ liệu thống kê từ /admin/stats (today, thisMonth, recentActivity). */
  const [stats, setStats] = useState(null);
  /** true khi đang load lần đầu tiên (hiển thị spinner toàn màn hình). */
  const [loading, setLoading] = useState(true);
  /** true khi đang pull-to-refresh. */
  const [refreshing, setRefreshing] = useState(false);

  /** Dữ liệu địa lý từ /api/locations/admin/stats. */
  const [locationStats, setLocationStats] = useState(null);
  /** true khi đang gửi yêu cầu trigger sync (disable nút sync). */
  const [syncTriggering, setSyncTriggering] = useState(false);
  /** Thông báo kết quả sync: { type: 'success'|'failed', msg: string } | null */
  const [syncNotif, setSyncNotif] = useState(null); // { type: 'success'|'failed', msg }
  /** true khi hiển thị hộp xác nhận inline trước khi đồng bộ. */
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  /** Ref lưu ID setInterval polling – cần để clearInterval khi unmount. */
  const pollRef = useRef(null);
  /** Ref lưu ID setTimeout ẩn thông báo sau 7 giây. */
  const notifTimerRef = useRef(null);
  /** Animated.Value cho thanh progress chạy vòng lặp khi sync đang chạy. */
  const progressAnim = useRef(new Animated.Value(0)).current;
  /** Ref lưu Animated.loop instance để có thể dừng animation. */
  const progressLoop = useRef(null);

  /**
   * Bắt đầu animation thanh progress chạy vòng lặp liên tục (1800ms/chu kỳ).
   * Dùng useNativeDriver để animation chạy trên UI thread, không block JS thread.
   */
  const startProgressAnim = useCallback(() => {
    progressAnim.setValue(0);
    progressLoop.current = Animated.loop(
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      })
    );
    progressLoop.current.start();
  }, [progressAnim]);

  /** Dừng animation thanh progress và reset về vị trí ban đầu. */
  const stopProgressAnim = useCallback(() => {
    progressLoop.current?.stop();
    progressAnim.setValue(0);
  }, [progressAnim]);

  /**
   * Hiển thị thông báo kết quả sync và tự động ẩn sau 7 giây.
   * Nếu đang có thông báo cũ, reset lại countdown 7s từ đầu.
   *
   * @param {'success'|'failed'} type - Loại thông báo
   * @param {string} msg - Nội dung thông báo
   */
  const showNotif = useCallback((type, msg) => {
    setSyncNotif({ type, msg });
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setSyncNotif(null), 7000);
  }, []);

  /** Fetch dữ liệu thống kê Admin từ GET /admin/stats. */
  const loadStats = async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Fetch dữ liệu địa lý từ GET /api/locations/admin/stats.
   * Nếu syncState là RUNNING (do lần trước trigger, app restart), tự động resume polling.
   */
  const loadLocationStats = async () => {
    try {
      const data = await getLocationStats();
      setLocationStats(data);
      if (data?.syncState === 'RUNNING') startPolling();
    } catch (e) { /* BE có thể chưa triển khai – bỏ qua */ }
  };

  /**
   * Bắt đầu polling trạng thái sync mỗi 10 giây, tối đa 150 lần (25 phút).
   * Tự dừng khi syncState chuyển sang DONE/FAILED, hết MAX_ATTEMPTS, hoặc mất kết nối.
   * Dùng pollRef để đảm bảo chỉ có 1 interval chạy tại một thời điểm.
   */
  const startPolling = useCallback((prevState) => {
    if (pollRef.current) return;
    startProgressAnim();
    // Tối đa 25 phút (150 lần × 10 giây) rồi tự dừng
    let attempts = 0;
    const MAX_ATTEMPTS = 150;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const data = await getLocationStats();
        setLocationStats(data);
        if (data?.syncState !== 'RUNNING' || attempts >= MAX_ATTEMPTS) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          stopProgressAnim();
          if (data?.syncState === 'DONE') {
            showNotif('success',
              `Đồng bộ thành công! Đã tải ${data.provinceCount} tỉnh và ${data.wardCount} xã/phường về CSDL.`);
          } else if (data?.syncState === 'FAILED') {
            showNotif('failed',
              `Đồng bộ thất bại: ${data.errorMessage || 'Lỗi không xác định'}`);
          } else if (attempts >= MAX_ATTEMPTS) {
            showNotif('failed', 'Quá thời gian chờ. Kiểm tra lại trạng thái sau.');
          }
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
        stopProgressAnim();
        showNotif('failed', 'Mất kết nối server khi đồng bộ.');
      }
    }, 10_000); // poll mỗi 10 giây
  }, [startProgressAnim, stopProgressAnim, showNotif]);

  useEffect(() => {
    loadStats();
    loadLocationStats();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      stopProgressAnim();
    };
  }, []);

  /** Hiển thị hộp xác nhận inline trước khi đồng bộ địa lý. */
  const handleSync = () => {
    setShowSyncConfirm(true);
  };

  /**
   * Thực thi đồng bộ địa lý sau khi admin đã xác nhận.
   * Luồng: ẩn confirm → trigger sync → fetch trạng thái mới → bắt đầu polling.
   */
  const doSync = async () => {
    setShowSyncConfirm(false);
    try {
      setSyncTriggering(true);
      setSyncNotif(null);
      startProgressAnim();
      await triggerLocationSync();
      await loadLocationStats();
      startPolling();
    } catch (e) {
      stopProgressAnim();
      showNotif('failed', 'Không thể bắt đầu đồng bộ. Kiểm tra kết nối server.');
    } finally {
      setSyncTriggering(false);
    }
  };

  /** Format số tiền thành chuỗi VND. VD: 1500000 → "1.500.000₫" */
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN').format(amount) + '₫';

  /** Đảm bảo giá trị là số hữu hạn, tránh NaN/undefined làm hỏng UI. */
  const safeNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

  // Normalize dữ liệu trước khi render – tránh crash khi stats chưa load
  const normalizedStats = {
    today: {
      totalRides: safeNumber(stats?.today?.totalRides),
      completedRides: safeNumber(stats?.today?.completedRides),
      cancelledRides: safeNumber(stats?.today?.cancelledRides),
      revenue: safeNumber(stats?.today?.revenue),
    },
    thisMonth: {
      totalRides: safeNumber(stats?.thisMonth?.totalRides),
      revenue: safeNumber(stats?.thisMonth?.revenue),
      newUsers: safeNumber(stats?.thisMonth?.newUsers),
      totalUsers: safeNumber(stats?.thisMonth?.totalUsers),
      newDrivers: safeNumber(stats?.thisMonth?.newDrivers),
      totalDrivers: safeNumber(stats?.thisMonth?.totalDrivers),
    },
    recentActivity: Array.isArray(stats?.recentActivity) ? stats.recentActivity : [],
  };

  const normalizedLocationStats = {
    provinceCount: safeNumber(locationStats?.provinceCount),
    wardCount: safeNumber(locationStats?.wardCount),
    syncState: locationStats?.syncState || 'IDLE',
    finishedAt: locationStats?.finishedAt || null,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={GRADIENT_HEADER} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} tintColor={ADMIN_COLORS.gradientStart} />}
    >
      {/* Header */}
      <LinearGradient colors={GRADIENT_HEADER} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Xin chào</Text>
            <Text style={styles.userName}>{user?.fullName || 'Admin'}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-outline" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.roleBadgeText}> Quản trị viên</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        {/* Date pill */}
        <View style={styles.datePill}>
          <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.9)" />
          <Text style={styles.datePillText}> {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>KPI hôm nay</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Tổng chuyến" value={normalizedStats.today.totalRides} icon="car-outline" color="#2563EB" />
          <StatCard label="Hoàn thành" value={normalizedStats.today.completedRides} icon="checkmark-circle-outline" color="#16A34A" />
          <StatCard label="Đã hủy" value={normalizedStats.today.cancelledRides} icon="close-circle-outline" color="#DC2626" />
          <StatCard label="Doanh thu" value={formatCurrency(normalizedStats.today.revenue)} icon="cash-outline" color="#D97706" small />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tháng này</Text>
        <View style={styles.monthCard}>
          <MonthRow icon="car-outline" label="Tổng chuyến xe" value={normalizedStats.thisMonth.totalRides} />
          <MonthRow icon="cash-outline" label="Doanh thu" value={formatCurrency(normalizedStats.thisMonth.revenue)} />
          <MonthRow icon="people-outline" label="Người dùng mới" value={`+${normalizedStats.thisMonth.newUsers} (${normalizedStats.thisMonth.totalUsers} tổng)`} />
          <MonthRow icon="car-sport-outline" label="Tài xế mới" value={`+${normalizedStats.thisMonth.newDrivers} (${normalizedStats.thisMonth.totalDrivers} tổng)`} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chức năng</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.screen}
              style={styles.actionCard}
              onPress={() => {
                if (action.screen === 'AdminDriverApproval') {
                  navigation?.navigate('AdminDriverApproval');
                  return;
                }
                if (action.screen === 'ManageUsers') {
                  navigation?.navigate('ManageUsers');
                  return;
                }
                if (action.screen === 'Reports') {
                  navigation?.navigate('Reports');
                  return;
                }
                if (action.screen === 'Settings') {
                  navigation?.navigate('Settings');
                  return;
                }
                Alert.alert('Thông báo', 'Chức năng này đang được phát triển.');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: action.iconBg }]}>
                <Ionicons name={action.icon} size={26} color={action.iconColor} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hoạt động gần đây</Text>
        <View style={styles.activityCard}>
          {normalizedStats.recentActivity.length === 0 ? (
            <View style={styles.activityItem}>
              <View style={styles.activityIconWrap}>
                <Ionicons name="time-outline" size={18} color={ADMIN_COLORS.textMuted} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityMsg}>Không có hoạt động gần đây</Text>
                <Text style={styles.activityTime}>Không có</Text>
              </View>
            </View>
          ) : normalizedStats.recentActivity.map((item) => (
            <View key={item.id} style={styles.activityItem}>
              <View style={styles.activityIconWrap}>
                <Ionicons name={ACTIVITY_ICONS[item.type] || 'time-outline'} size={18} color={ADMIN_COLORS.gradientStart} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityMsg}>{item.message || 'Không có nội dung'}</Text>
                <Text style={styles.activityTime}>{item.time || 'Không có'}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dữ liệu Địa lý</Text>

        {/* Notification banner */}
        {syncNotif && (
          <View style={[styles.notifBanner, syncNotif.type === 'success' ? styles.notifSuccess : styles.notifFailed]}>
            <Ionicons
              name={syncNotif.type === 'success' ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={syncNotif.type === 'success' ? '#16A34A' : '#DC2626'}
            />
            <Text style={styles.notifMsg} numberOfLines={3}>{syncNotif.msg}</Text>
            <TouchableOpacity onPress={() => setSyncNotif(null)} style={styles.notifClose}>
              <Ionicons name="close" size={16} color={ADMIN_COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.syncCard}>
          {/* Thống kê số lượng */}
          <View style={styles.syncStatsRow}>
            <View style={styles.syncStat}>
              <Text style={styles.syncStatValue}>{normalizedLocationStats.provinceCount}</Text>
              <Text style={styles.syncStatLabel}>Tỉnh / TP</Text>
            </View>
            <View style={styles.syncDivider} />
            <View style={styles.syncStat}>
              <Text style={styles.syncStatValue}>{normalizedLocationStats.wardCount}</Text>
              <Text style={styles.syncStatLabel}>Xã / Phường</Text>
            </View>
            <View style={styles.syncDivider} />
            <View style={styles.syncStat}>
              <View style={styles.syncStatIconWrap}>
                {normalizedLocationStats.syncState === 'RUNNING' ? (
                  <ActivityIndicator size="small" color={ADMIN_COLORS.gradientStart} />
                ) : normalizedLocationStats.syncState === 'DONE' ? (
                  <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                ) : normalizedLocationStats.syncState === 'FAILED' ? (
                  <Ionicons name="close-circle" size={24} color="#DC2626" />
                ) : (
                  <Text style={styles.syncStatValue}>—</Text>
                )}
              </View>
              <Text style={styles.syncStatLabel}>Trạng thái</Text>
            </View>
          </View>

          {/* Animated progress bar khi đang chạy */}
          {(normalizedLocationStats.syncState === 'RUNNING' || syncTriggering) && (
            <View style={styles.progressTrack}>
              <Animated.View
                style={[styles.progressBar, {
                  transform: [{
                    translateX: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-220, 220],
                    }),
                  }],
                }]}
              />
            </View>
          )}

          {/* Lần đồng bộ cuối */}
          {normalizedLocationStats.finishedAt ? (
            <Text style={styles.syncLastTime}>
              Lần cuối: {new Date(normalizedLocationStats.finishedAt).toLocaleString('vi-VN')}
            </Text>
          ) : (
            <Text style={styles.syncLastTime}>Lần cuối: Không có</Text>
          )}

          {/* Nút đồng bộ / confirm inline */}
          {showSyncConfirm ? (
            <View style={styles.confirmBox}>
              <View style={styles.confirmTitleRow}>
                <Ionicons name="warning-outline" size={18} color="#92400E" />
                <Text style={styles.confirmTitle}> Xác nhận đồng bộ</Text>
              </View>
              <Text style={styles.confirmMsg}>
                Thao tác này sẽ xóa toàn bộ dữ liệu tỉnh/xã cũ và tải lại từ Overpass API.{'\n'}
                Quá trình có thể mất 5–15 phút.
              </Text>
              <View style={styles.confirmBtns}>
                <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowSyncConfirm(false)}>
                  <Text style={styles.confirmCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmOk} onPress={doSync}>
                  <View style={styles.confirmOkInner}>
                    <Ionicons name="refresh-outline" size={15} color="#fff" />
                    <Text style={styles.confirmOkText}> Đồng bộ ngay</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.syncBtn,
                (normalizedLocationStats.syncState === 'RUNNING' || syncTriggering) && styles.syncBtnDisabled,
              ]}
              onPress={handleSync}
              disabled={normalizedLocationStats.syncState === 'RUNNING' || syncTriggering}
            >
              {syncTriggering || normalizedLocationStats.syncState === 'RUNNING' ? (
                <View style={styles.syncBtnInner}>
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.syncBtnText}>Đang cào dữ liệu từ Overpass...</Text>
                </View>
              ) : (
                <View style={styles.syncBtnInner}>
                  <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.syncBtnText}>Đồng bộ từ Overpass API</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <Text style={styles.syncNote}>
            Nguồn: OpenStreetMap Overpass API · Chỉ chạy khi cần cập nhật dữ liệu mới
          </Text>
        </View>
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
};

const StatCard = ({ label, value, icon, color, small }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <View style={[styles.statIconWrap, { backgroundColor: color + '22' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={[styles.statValue, small && styles.statValueSmall, { color }]}>{value ?? 0}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MonthRow = ({ icon, label, value }) => (
  <View style={styles.monthRow}>
    <View style={styles.monthRowIconWrap}>
      <Ionicons name={icon} size={16} color={ADMIN_COLORS.gradientStart} />
    </View>
    <Text style={styles.monthRowLabel}>{label}</Text>
    <Text style={styles.monthRowValue}>{value ?? 'Không có'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ADMIN_COLORS.pageBg },
  loadingContainer: { flex: 1 },
  loadingGradient: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { marginTop: 12, color: '#fff', fontSize: 14, fontWeight: '600' },

  // Header
  header: {
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  userName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  roleBadge: {
    marginTop: 6, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  datePill: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  datePillText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },

  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: ADMIN_COLORS.textPrimary,
    marginBottom: 12, letterSpacing: 0.3,
    borderLeftWidth: 4, borderLeftColor: ADMIN_COLORS.gradientStart,
    paddingLeft: 10, backgroundColor: ADMIN_COLORS.divider,
    paddingVertical: 6, borderRadius: 6,
  },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: ADMIN_COLORS.cardBg,
    borderRadius: 16, padding: 14, borderTopWidth: 4, alignItems: 'center',
    ...ADMIN_SHADOW,
  },
  statIconWrap: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center',
    justifyContent: 'center', marginBottom: 8,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statValueSmall: { fontSize: 14 },
  statLabel: { fontSize: 11, color: ADMIN_COLORS.textSecondary, marginTop: 2, textAlign: 'center' },

  // Month card
  monthCard: {
    backgroundColor: ADMIN_COLORS.cardBg, borderRadius: 16, padding: 4,
    ...ADMIN_SHADOW,
  },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.divider,
  },
  monthRowIcon: { fontSize: 18, width: 30 },
  monthRowLabel: { flex: 1, fontSize: 13, color: ADMIN_COLORS.textSecondary },
  monthRowValue: { fontSize: 13, fontWeight: '700', color: ADMIN_COLORS.textPrimary },
  monthRowIconWrap: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: ADMIN_COLORS.divider, marginRight: 10,
  },

  // Actions Grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '47%', backgroundColor: ADMIN_COLORS.cardBg, borderRadius: 16,
    padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 100,
    ...ADMIN_SHADOW,
  },
  actionIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  actionLabel: {
    fontSize: 12, fontWeight: '700', color: ADMIN_COLORS.textPrimary,
    textAlign: 'center', lineHeight: 17,
  },

  // Activity
  activityCard: {
    backgroundColor: ADMIN_COLORS.cardBg, borderRadius: 16, overflow: 'hidden',
    ...ADMIN_SHADOW,
  },
  activityItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.divider,
  },
  activityIcon: { fontSize: 18, marginRight: 12, marginTop: 1 },
  activityIconWrap: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: ADMIN_COLORS.divider,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1,
  },
  activityInfo: { flex: 1 },
  activityMsg: { fontSize: 13, color: ADMIN_COLORS.textPrimary, lineHeight: 19 },
  activityTime: { fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 3 },

  // Sync card
  syncCard: {
    backgroundColor: ADMIN_COLORS.cardBg, borderRadius: 16, padding: 16,
    ...ADMIN_SHADOW,
  },
  syncStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  syncStat: { alignItems: 'center', flex: 1 },
  syncStatIconWrap: { height: 30, alignItems: 'center', justifyContent: 'center' },
  syncStatValue: { fontSize: 22, fontWeight: '800', color: ADMIN_COLORS.textPrimary },
  syncStatLabel: { fontSize: 11, color: ADMIN_COLORS.textSecondary, marginTop: 2 },
  syncDivider: { width: 1, backgroundColor: ADMIN_COLORS.border, marginVertical: 4 },
  syncLastTime: { fontSize: 12, color: ADMIN_COLORS.textMuted, textAlign: 'center', marginBottom: 10 },
  syncError: { fontSize: 12, color: ADMIN_COLORS.danger, textAlign: 'center', marginBottom: 8, paddingHorizontal: 8 },
  syncBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4,
    backgroundColor: ADMIN_COLORS.gradientStart,
    ...ADMIN_SHADOW,
  },
  syncBtnDisabled: { backgroundColor: '#CBD5E1' },
  syncBtnInner: { flexDirection: 'row', alignItems: 'center' },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  syncNote: { fontSize: 11, color: ADMIN_COLORS.textMuted, textAlign: 'center', marginTop: 10 },

  // Progress bar
  progressTrack: {
    height: 5, borderRadius: 3, backgroundColor: '#EDE9FE',
    overflow: 'hidden', marginVertical: 12,
  },
  progressBar: {
    height: 5, width: '45%', borderRadius: 3,
    backgroundColor: ADMIN_COLORS.gradientStart,
  },

  // Notification banner
  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1,
  },
  notifSuccess: { backgroundColor: ADMIN_COLORS.successBg, borderColor: '#86EFAC' },
  notifFailed: { backgroundColor: ADMIN_COLORS.dangerBg, borderColor: '#FCA5A5' },
  notifIcon: { fontSize: 20 },
  notifMsg: { flex: 1, fontSize: 13, fontWeight: '600', color: ADMIN_COLORS.textPrimary, lineHeight: 18 },
  notifClose: { padding: 4 },

  // Confirm box inline
  confirmBox: {
    backgroundColor: '#FFFBEB', borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: '#FCD34D', marginTop: 4,
  },
  confirmTitle: { fontSize: 15, fontWeight: '800', color: '#92400E', marginBottom: 6 },
  confirmTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  confirmMsg: { fontSize: 13, color: ADMIN_COLORS.textPrimary, lineHeight: 20, marginBottom: 14 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmCancel: {
    flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center',
    borderWidth: 1.5, borderColor: ADMIN_COLORS.border, backgroundColor: ADMIN_COLORS.cardBg,
  },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: ADMIN_COLORS.textSecondary },
  confirmOk: {
    flex: 2, borderRadius: 10, paddingVertical: 11, alignItems: 'center',
    backgroundColor: '#D97706',
  },
  confirmOkInner: { flexDirection: 'row', alignItems: 'center' },
  confirmOkText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  bottomPad: { height: 36 },
});

export default AdminHomeScreen;
