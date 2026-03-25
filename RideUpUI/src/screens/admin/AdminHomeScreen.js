import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { COLORS } from '../../config/config';
import { getAdminStats, getLocationStats, triggerLocationSync } from '../../services/api';

const ACTIVITY_ICONS = {
  new_booking: '📋',
  ride_completed: '✅',
  new_driver: '🚗',
  payment: '💰',
  cancelled: '❌',
};

const QUICK_ACTIONS = [
  { icon: '✅', label: 'Duyệt\nHồ sơ tài xế', color: '#E8F5E9', iconColor: '#2E7D32', screen: 'AdminDriverApproval' },
  { icon: '👥', label: 'Quản lý\nNgười dùng', color: '#E3F2FD', iconColor: '#1565C0', screen: 'ManageUsers' },
  { icon: '🗺️', label: 'Quản lý\nTuyến đường', color: '#E8F5E9', iconColor: '#2E7D32', screen: 'ManageRoutes' },
  { icon: '📊', label: 'Báo cáo\nThống kê', color: '#FFF3E0', iconColor: '#E65100', screen: 'Reports' },
  { icon: '⚙️', label: 'Cài đặt\nHệ thống', color: '#F3E5F5', iconColor: '#6A1B9A', screen: 'Settings' },
];

const AdminHomeScreen = ({ user, onLogout, navigation }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [locationStats, setLocationStats] = useState(null);
  const [syncTriggering, setSyncTriggering] = useState(false);
  const [syncNotif, setSyncNotif] = useState(null); // { type: 'success'|'failed', msg }
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const pollRef = useRef(null);
  const notifTimerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressLoop = useRef(null);

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

  const stopProgressAnim = useCallback(() => {
    progressLoop.current?.stop();
    progressAnim.setValue(0);
  }, [progressAnim]);

  const showNotif = useCallback((type, msg) => {
    setSyncNotif({ type, msg });
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setSyncNotif(null), 7000);
  }, []);

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

  const loadLocationStats = async () => {
    try {
      const data = await getLocationStats();
      setLocationStats(data);
      if (data?.syncState === 'RUNNING') startPolling();
    } catch (e) { /* BE có thể chưa triển khai – bỏ qua */ }
  };

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

  const handleSync = () => {
    setShowSyncConfirm(true);
  };

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

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN').format(amount) + '₫';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.adminColor} />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Xin chào 👋</Text>
          <Text style={styles.userName}>{user?.fullName || 'Admin'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>👑 Quản trị viên</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* Stats hôm nay */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Hôm nay ({new Date().toLocaleDateString('vi-VN')})</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Tổng chuyến" value={stats?.today.totalRides} icon="🚗" color="#1565C0" />
          <StatCard label="Hoàn thành" value={stats?.today.completedRides} icon="✅" color="#2E7D32" />
          <StatCard label="Đã hủy" value={stats?.today.cancelledRides} icon="❌" color="#C62828" />
          <StatCard label="Doanh thu" value={formatCurrency(stats?.today.revenue)} icon="💰" color="#E65100" small />
        </View>
      </View>

      {/* Stats tháng */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Tháng này</Text>
        <View style={styles.monthCard}>
          <MonthRow icon="🚗" label="Tổng chuyến xe" value={stats?.thisMonth.totalRides} />
          <MonthRow icon="💰" label="Doanh thu" value={formatCurrency(stats?.thisMonth.revenue)} />
          <MonthRow icon="👥" label="Người dùng mới" value={`+${stats?.thisMonth.newUsers} (${stats?.thisMonth.totalUsers} tổng)`} />
          <MonthRow icon="🚘" label="Tài xế mới" value={`+${stats?.thisMonth.newDrivers} (${stats?.thisMonth.totalDrivers} tổng)`} />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Chức năng</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.screen}
              style={[styles.actionCard, { backgroundColor: action.color }]}
              onPress={() => {
                if (action.screen === 'AdminDriverApproval') {
                  navigation?.navigate('AdminDriverApproval');
                  return;
                }
                console.log('Chuyển đến:', action.screen);
              }}
            >
              <Text style={[styles.actionIcon, { color: action.iconColor }]}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Hoạt động gần đây */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🕐 Hoạt động gần đây</Text>
        <View style={styles.activityCard}>
          {stats?.recentActivity.map((item) => (
            <View key={item.id} style={styles.activityItem}>
              <Text style={styles.activityIcon}>
                {ACTIVITY_ICONS[item.type] || '📌'}
              </Text>
              <View style={styles.activityInfo}>
                <Text style={styles.activityMsg}>{item.message}</Text>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Đồng bộ dữ liệu địa lý */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗺️ Dữ liệu Địa lý</Text>

        {/* Notification banner */}
        {syncNotif && (
          <View style={[styles.notifBanner, syncNotif.type === 'success' ? styles.notifSuccess : styles.notifFailed]}>
            <Text style={styles.notifIcon}>{syncNotif.type === 'success' ? '✅' : '❌'}</Text>
            <Text style={styles.notifMsg} numberOfLines={3}>{syncNotif.msg}</Text>
            <TouchableOpacity onPress={() => setSyncNotif(null)} style={styles.notifClose}>
              <Text style={styles.notifCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.syncCard}>
          {/* Thống kê số lượng */}
          <View style={styles.syncStatsRow}>
            <View style={styles.syncStat}>
              <Text style={styles.syncStatValue}>{locationStats?.provinceCount ?? '–'}</Text>
              <Text style={styles.syncStatLabel}>Tỉnh / TP</Text>
            </View>
            <View style={styles.syncDivider} />
            <View style={styles.syncStat}>
              <Text style={styles.syncStatValue}>{locationStats?.wardCount ?? '–'}</Text>
              <Text style={styles.syncStatLabel}>Xã / Phường</Text>
            </View>
            <View style={styles.syncDivider} />
            <View style={styles.syncStat}>
              <Text style={[
                styles.syncStatValue,
                locationStats?.syncState === 'DONE'    && { color: '#2E7D32' },
                locationStats?.syncState === 'RUNNING' && { color: '#E65100' },
                locationStats?.syncState === 'FAILED'  && { color: '#C62828' },
              ]}>
                {locationStats?.syncState === 'RUNNING' ? '⏳' :
                 locationStats?.syncState === 'DONE'    ? '✅' :
                 locationStats?.syncState === 'FAILED'  ? '❌' : '–'}
              </Text>
              <Text style={styles.syncStatLabel}>Trạng thái</Text>
            </View>
          </View>

          {/* Animated progress bar khi đang chạy */}
          {(locationStats?.syncState === 'RUNNING' || syncTriggering) && (
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
          {locationStats?.finishedAt ? (
            <Text style={styles.syncLastTime}>
              Lần cuối: {new Date(locationStats.finishedAt).toLocaleString('vi-VN')}
            </Text>
          ) : null}

          {/* Nút đồng bộ / confirm inline */}
          {showSyncConfirm ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>⚠️ Xác nhận đồng bộ</Text>
              <Text style={styles.confirmMsg}>
                Thao tác này sẽ xóa toàn bộ dữ liệu tỉnh/xã cũ và tải lại từ Overpass API.{'\n'}
                Quá trình có thể mất 5–15 phút.
              </Text>
              <View style={styles.confirmBtns}>
                <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowSyncConfirm(false)}>
                  <Text style={styles.confirmCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmOk} onPress={doSync}>
                  <Text style={styles.confirmOkText}>🔄 Đồng bộ ngay</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.syncBtn,
                (locationStats?.syncState === 'RUNNING' || syncTriggering) && styles.syncBtnDisabled,
              ]}
              onPress={handleSync}
              disabled={locationStats?.syncState === 'RUNNING' || syncTriggering}
            >
              {syncTriggering || locationStats?.syncState === 'RUNNING' ? (
                <View style={styles.syncBtnInner}>
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.syncBtnText}>Đang cào dữ liệu từ Overpass...</Text>
                </View>
              ) : (
                <Text style={styles.syncBtnText}>🔄 Đồng bộ từ Overpass API</Text>
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
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, small && styles.statValueSmall]}>{value ?? '-'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MonthRow = ({ icon, label, value }) => (
  <View style={styles.monthRow}>
    <Text style={styles.monthRowIcon}>{icon}</Text>
    <Text style={styles.monthRowLabel}>{label}</Text>
    <Text style={styles.monthRowValue}>{value ?? '-'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textLight },

  // Header
  header: {
    backgroundColor: COLORS.adminColor,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  userName: { color: COLORS.white, fontSize: 22, fontWeight: '800', marginTop: 2 },
  roleBadge: {
    marginTop: 6, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start',
  },
  roleBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7, marginTop: 4,
  },
  logoutText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },

  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, borderTopWidth: 3, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  statValueSmall: { fontSize: 15 },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  // Month card
  monthCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  monthRowIcon: { fontSize: 18, width: 28 },
  monthRowLabel: { flex: 1, fontSize: 14, color: COLORS.textLight },
  monthRowValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  // Actions Grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '47%', borderRadius: 14, padding: 16,
    alignItems: 'center', justifyContent: 'center', minHeight: 90,
  },
  actionIcon: { fontSize: 30, marginBottom: 8 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'center', lineHeight: 18 },

  // Activity
  activityCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  activityItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  activityIcon: { fontSize: 20, marginRight: 12, marginTop: 1 },
  activityInfo: { flex: 1 },
  activityMsg: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  activityTime: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Sync card
  syncCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  syncStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  syncStat: { alignItems: 'center', flex: 1 },
  syncStatValue: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  syncStatLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  syncDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  syncLastTime: { fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginBottom: 10 },
  syncError: { fontSize: 12, color: '#C62828', textAlign: 'center', marginBottom: 8, paddingHorizontal: 8 },
  syncBtn: {
    backgroundColor: COLORS.adminColor, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  syncBtnDisabled: { backgroundColor: '#BDBDBD' },
  syncBtnInner: { flexDirection: 'row', alignItems: 'center' },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  syncNote: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 8 },

  // Progress bar
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: '#FFE0B2',
    overflow: 'hidden', marginVertical: 12,
  },
  progressBar: {
    height: 6, width: '50%', borderRadius: 3,
    backgroundColor: COLORS.adminColor,
  },

  // Notification banner
  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1,
  },
  notifSuccess: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  notifFailed:  { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' },
  notifIcon: { fontSize: 22 },
  notifMsg: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text, lineHeight: 18 },
  notifClose: { padding: 4 },
  notifCloseText: { fontSize: 14, color: COLORS.textLight, fontWeight: '700' },

  // Confirm box inline
  confirmBox: {
    backgroundColor: '#FFF8E1', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#FFB300', marginTop: 4,
  },
  confirmTitle: { fontSize: 15, fontWeight: '800', color: '#E65100', marginBottom: 6 },
  confirmMsg: { fontSize: 13, color: COLORS.text, lineHeight: 20, marginBottom: 14 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmCancel: {
    flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  confirmOk: {
    flex: 2, borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#E65100',
  },
  confirmOkText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  bottomPad: { height: 32 },
});

export default AdminHomeScreen;
