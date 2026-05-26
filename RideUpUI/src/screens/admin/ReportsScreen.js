/**
 * @fileoverview Màn hình Báo cáo & Thống kê dành cho Admin.
 *
 * Trực quan hóa KPI từ /admin/stats: tỷ lệ hoàn thành/hủy, điểm vận hành,
 * biểu đồ cột so sánh hôm nay vs trung bình ngày, cơ cấu người dùng.
 *
 * API được gọi:
 *  - getAdminStats() → GET /admin/stats (cache 15s, dùng chung với AdminHomeScreen)
 *
 * Công thức điểm vận hành (0–100):
 *   operationScore = completionRate×0.7 - cancelRate×0.5 + min(totalRides×2, 20)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_COLORS, ADMIN_SHADOW, ADMIN_SHADOW_SM, GRADIENT_HEADER } from '../../config/AdminTheme';
import { getAdminStats } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Chiều cao tối đa của cột biểu đồ (px). */
const CHART_MAX_HEIGHT = 90;

/** @param {{ navigation: object }} props */
const ReportsScreen = ({ navigation }) => {
  /** Dữ liệu thống kê thô từ /admin/stats. */
  const [stats, setStats] = useState(null);
  /** true khi đang load lần đầu. */
  const [loading, setLoading] = useState(true);
  /** true khi đang pull-to-refresh. */
  const [refreshing, setRefreshing] = useState(false);

  /** Đảm bảo giá trị là số hữu hạn hợp lệ, tránh NaN làm hỏng UI. */
  const safeNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

  /** Fetch dữ liệu thống kê từ GET /admin/stats (cache 15s). */
  const loadData = useCallback(async () => {
    try {
      const data = await getAdminStats();
      setStats(data || {});
    } catch {
      setStats({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Chuẩn hoá và tính toán tất cả chỉ số báo cáo từ dữ liệu thô `stats`.
   *
   * Công thức điểm vận hành (operationScore, 0–100):
   *   operationScore = completionRate×0.7 − cancelRate×0.5 + min(totalRides×2, 20)
   * Công thức này ưu tiên tỷ lệ hoàn thành, phạt hủy chuyến,
   * và cộng thưởng khối lượng (tối đa +20 điểm) để khuyến khích tăng trưởng.
   */
  const normalized = useMemo(() => {
    const today = {
      totalRides: safeNumber(stats?.today?.totalRides),
      completedRides: safeNumber(stats?.today?.completedRides),
      cancelledRides: safeNumber(stats?.today?.cancelledRides),
      revenue: safeNumber(stats?.today?.revenue),
    };

    const thisMonth = {
      totalRides: safeNumber(stats?.thisMonth?.totalRides),
      revenue: safeNumber(stats?.thisMonth?.revenue),
      newUsers: safeNumber(stats?.thisMonth?.newUsers),
      totalUsers: safeNumber(stats?.thisMonth?.totalUsers),
      newDrivers: safeNumber(stats?.thisMonth?.newDrivers),
      totalDrivers: safeNumber(stats?.thisMonth?.totalDrivers),
    };

    const completionRate = today.totalRides > 0
      ? Math.round((today.completedRides / today.totalRides) * 100)
      : 0;

    const cancelRate = today.totalRides > 0
      ? Math.round((today.cancelledRides / today.totalRides) * 100)
      : 0;

    const activeRate = Math.max(0, 100 - completionRate - cancelRate);
    const dayOfMonth = Math.max(new Date().getDate(), 1);
    const avgRidesPerDay = Math.round(thisMonth.totalRides / dayOfMonth);
    const avgRevenuePerDay = Math.round(thisMonth.revenue / dayOfMonth);

    const completionScore = completionRate * 0.7;
    const cancelPenalty = cancelRate * 0.5;
    const volumeBonus = Math.min(today.totalRides * 2, 20);
    const operationScore = Math.max(0, Math.min(100, Math.round(completionScore - cancelPenalty + volumeBonus)));

    const userMixCustomer = Math.max(thisMonth.totalUsers - thisMonth.totalDrivers, 0);
    const userMixDriver = thisMonth.totalDrivers;
    const totalMix = Math.max(userMixCustomer + userMixDriver, 1);

    const ridesComparison = [
      { label: 'Hôm nay', value: today.totalRides, color: '#1565C0' },
      { label: 'TB/ngày', value: avgRidesPerDay, color: '#5B8DEF' },
    ];

    const revenueComparison = [
      { label: 'Hôm nay', value: today.revenue, color: '#E65100' },
      { label: 'TB/ngày', value: avgRevenuePerDay, color: '#FF9D4D' },
    ];

    const maxRideValue = Math.max(...ridesComparison.map((i) => i.value), 1);
    const maxRevenueValue = Math.max(...revenueComparison.map((i) => i.value), 1);

    return {
      today,
      thisMonth,
      completionRate,
      cancelRate,
      activeRate,
      operationScore,
      avgRidesPerDay,
      avgRevenuePerDay,
      userMixCustomer,
      userMixDriver,
      totalMix,
      ridesComparison,
      revenueComparison,
      maxRideValue,
      maxRevenueValue,
      recentActivity: Array.isArray(stats?.recentActivity) ? stats.recentActivity : [],
    };
  }, [stats]);

  /**
   * Định dạng số tiền theo locale vi-VN.
   * VD: 150000 → "150.000₫"
   *
   * @param {number} amount
   * @returns {string}
   */
  const formatCurrency = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)}₫`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ADMIN_COLORS.gradientStart} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }}
          tintColor={ADMIN_COLORS.gradientStart}
        />
      }
    >
      <LinearGradient colors={GRADIENT_HEADER} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>Báo cáo thống kê</Text>
          <View style={styles.headerDatePill}>
            <Ionicons name="calendar-outline" size={11} color="#fff" />
            <Text style={styles.headerDateText}> {new Date().toLocaleDateString('vi-VN')}</Text>
          </View>
        </View>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <View style={styles.heroWrap}>
        <LinearGradient
          colors={['#1E1B4B', '#312E81']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Điểm vận hành hôm nay</Text>
            <View style={styles.heroStatusRow}>
              <View style={[styles.heroStatusDot, {
                backgroundColor: normalized.operationScore >= 80 ? '#16A34A' :
                  normalized.operationScore >= 50 ? '#D97706' : '#DC2626'
              }]} />
              <Text style={styles.heroSubLabel}>
                {normalized.operationScore >= 80 ? 'Hoạt động tốt' :
                  normalized.operationScore >= 50 ? 'Cần theo dõi' : 'Cần cải thiện'}
              </Text>
            </View>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>{normalized.operationScore}</Text>
            <Text style={styles.scoreLabel}>/ 100</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>KPI hôm nay</Text>
        <View style={styles.grid}>
          <MetricCard icon="car-outline" label="Tổng chuyến" value={normalized.today.totalRides} color="#2563EB" bg="#DBEAFE" />
          <MetricCard icon="checkmark-circle-outline" label="Hoàn thành" value={normalized.today.completedRides} color="#16A34A" bg="#DCFCE7" />
          <MetricCard icon="close-circle-outline" label="Đã hủy" value={normalized.today.cancelledRides} color="#DC2626" bg="#FEE2E2" />
          <MetricCard icon="cash-outline" label="Doanh thu" value={formatCurrency(normalized.today.revenue)} color="#D97706" bg="#FEF3C7" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cơ cấu trạng thái hôm nay</Text>
        <View style={styles.card}>
          <ProgressRow label="Hoàn thành" value={normalized.completionRate} color="#16A34A" count={normalized.today.completedRides} />
          <ProgressRow label="Đã hủy" value={normalized.cancelRate} color="#DC2626" count={normalized.today.cancelledRides} />
          <ProgressRow label="Đang xử lý" value={normalized.activeRate} color="#2563EB" count={Math.max(normalized.today.totalRides - normalized.today.completedRides - normalized.today.cancelledRides, 0)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>So sánh hôm nay vs trung bình tháng</Text>
        <View style={styles.compareGrid}>
          <View style={[styles.card, styles.compareCard]}>
            <View style={styles.compareTitleRow}>
              <Ionicons name="car-outline" size={14} color="#1565C0" />
              <Text style={styles.compareTitle}> Số chuyến</Text>
            </View>
            <View style={styles.columnChart}>
              {normalized.ridesComparison.map((item) => (
                <ColumnBar
                  key={`ride-${item.label}`}
                  label={item.label}
                  value={item.value}
                  maxValue={normalized.maxRideValue}
                  color={item.color}
                />
              ))}
            </View>
          </View>

          <View style={[styles.card, styles.compareCard]}>
            <View style={styles.compareTitleRow}>
              <Ionicons name="cash-outline" size={14} color="#E65100" />
              <Text style={styles.compareTitle}> Doanh thu</Text>
            </View>
            <View style={styles.columnChart}>
              {normalized.revenueComparison.map((item) => (
                <ColumnBar
                  key={`rev-${item.label}`}
                  label={item.label}
                  value={item.value}
                  maxValue={normalized.maxRevenueValue}
                  color={item.color}
                  formatValue={formatCurrency}
                />
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Báo cáo tháng này</Text>
        <View style={styles.card}>
          <InfoRow label="Tổng chuyến" value={normalized.thisMonth.totalRides} />
          <InfoRow label="Doanh thu" value={formatCurrency(normalized.thisMonth.revenue)} />
          <InfoRow label="Trung bình chuyến/ngày" value={normalized.avgRidesPerDay} />
          <InfoRow label="Trung bình doanh thu/ngày" value={formatCurrency(normalized.avgRevenuePerDay)} />
          <InfoRow label="Người dùng mới" value={`+${normalized.thisMonth.newUsers}`} />
          <InfoRow label="Tổng người dùng" value={normalized.thisMonth.totalUsers} />
          <InfoRow label="Tài xế mới" value={`+${normalized.thisMonth.newDrivers}`} />
          <InfoRow label="Tổng tài xế" value={normalized.thisMonth.totalDrivers} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tỷ trọng người dùng</Text>
        <View style={styles.card}>
          <View style={styles.mixTrack}>
            <View
              style={[
                styles.mixSegment,
                {
                  width: `${Math.round((normalized.userMixDriver / normalized.totalMix) * 100)}%`,
                  backgroundColor: '#7C3AED',
                },
              ]}
            />
            <View
              style={[
                styles.mixSegment,
                {
                  width: `${Math.round((normalized.userMixCustomer / normalized.totalMix) * 100)}%`,
                  backgroundColor: '#0EA5E9',
                },
              ]}
            />
          </View>
          <View style={styles.mixLegendRow}>
            <LegendItem color="#7C3AED" label={`Tài xế: ${normalized.userMixDriver}`} />
            <LegendItem color="#0EA5E9" label={`Khách hàng: ${normalized.userMixCustomer}`} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dòng thời gian hoạt động</Text>
        <View style={styles.card}>
          {normalized.recentActivity.length === 0 ? (
            <Text style={styles.empty}>Không có dữ liệu</Text>
          ) : normalized.recentActivity.map((item) => (
            <TimelineItem
              key={item.id || `${item.type}-${item.time}`}
              message={item.message || 'Không có nội dung'}
              time={item.time || 'Không có'}
            />
          ))}
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
};

const MetricCard = ({ icon, label, value, color, bg }) => (
  <View style={[styles.metricCard, { backgroundColor: bg || '#F1F5F9', borderTopColor: color }]}>
    <View style={[styles.metricIconWrap, { backgroundColor: color + '22' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const ProgressRow = ({ label, value, color, count }) => (
  <View style={styles.rateRow}>
    <View style={styles.rateLabelWrap}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { color }]}>{count} chuyến · {value}%</Text>
    </View>
    <View style={styles.rateTrack}>
      <View style={[styles.rateBar, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  </View>
);

const ColumnBar = ({ label, value, maxValue, color, formatValue }) => {
  const height = Math.max(10, Math.round((value / Math.max(maxValue, 1)) * CHART_MAX_HEIGHT));
  return (
    <View style={styles.columnItem}>
      <Text style={styles.columnValue}>{formatValue ? formatValue(value) : value}</Text>
      <View style={styles.columnTrack}>
        <View style={[styles.columnFill, { height, backgroundColor: color }]} />
      </View>
      <Text style={styles.columnLabel}>{label}</Text>
    </View>
  );
};

const LegendItem = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const TimelineItem = ({ message, time }) => (
  <View style={styles.timelineRow}>
    <View style={styles.timelineRail}>
      <View style={styles.timelineDot} />
      <View style={styles.timelineLine} />
    </View>
    <View style={styles.timelineContent}>
      <Text style={styles.activityText}>{message}</Text>
      <Text style={styles.activityTime}>{time}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ADMIN_COLORS.pageBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerDatePill: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerDateText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Hero
  heroWrap: { paddingHorizontal: 12, marginTop: 12 },
  heroCard: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...ADMIN_SHADOW,
  },
  heroLabel: { color: '#C7D2FE', fontSize: 13, fontWeight: '700' },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  heroStatusDot: { width: 8, height: 8, borderRadius: 4 },
  heroSubLabel: { color: '#fff', fontSize: 15, fontWeight: '800' },
  scoreBox: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  scoreValue: { color: '#fff', fontSize: 26, fontWeight: '900' },
  scoreLabel: { color: '#C7D2FE', fontSize: 10, fontWeight: '700' },

  // Section
  section: { paddingHorizontal: 12, marginTop: 14 },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: ADMIN_COLORS.textPrimary,
    marginBottom: 10, letterSpacing: 0.2,
  },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: {
    width: '48%',
    borderRadius: 14,
    borderTopWidth: 3,
    padding: 14,
    ...ADMIN_SHADOW_SM,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: { fontSize: 18, fontWeight: '800' },
  metricLabel: { marginTop: 4, fontSize: 11, color: ADMIN_COLORS.textSecondary },

  // Card
  card: {
    backgroundColor: ADMIN_COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    ...ADMIN_SHADOW_SM,
  },
  compareGrid: { gap: 10 },
  compareCard: {
    width: SCREEN_WIDTH - 24,
  },
  compareTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  compareTitle: { fontSize: 13, fontWeight: '800', color: ADMIN_COLORS.textPrimary },
  columnChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    minHeight: CHART_MAX_HEIGHT + 36,
  },
  columnItem: { alignItems: 'center', width: '42%' },
  columnValue: { fontSize: 11, color: ADMIN_COLORS.textSecondary, marginBottom: 5, fontWeight: '700' },
  columnTrack: {
    height: CHART_MAX_HEIGHT,
    width: 36,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  columnFill: { width: 36, borderRadius: 999 },
  columnLabel: { marginTop: 7, fontSize: 11, color: ADMIN_COLORS.textSecondary, fontWeight: '700' },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.divider,
  },
  infoLabel: { fontSize: 13, color: ADMIN_COLORS.textSecondary },
  infoValue: { fontSize: 13, color: ADMIN_COLORS.textPrimary, fontWeight: '700' },

  // Progress rows
  rateRow: { marginBottom: 12 },
  rateLabelWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  rateTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  rateBar: { height: 8, borderRadius: 999 },

  // Mix chart
  mixTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  mixSegment: { height: 12 },
  mixLegendRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: ADMIN_COLORS.textSecondary, fontWeight: '700' },
  empty: { fontSize: 13, color: ADMIN_COLORS.textMuted },

  // Timeline
  timelineRow: { flexDirection: 'row', marginBottom: 12 },
  timelineRail: { width: 20, alignItems: 'center' },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ADMIN_COLORS.gradientStart,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
    borderRadius: 1,
  },
  timelineContent: { flex: 1, paddingLeft: 4 },
  activityText: { fontSize: 13, color: ADMIN_COLORS.textPrimary, lineHeight: 19 },
  activityTime: { fontSize: 11, color: ADMIN_COLORS.textMuted, marginTop: 3 },
});

export default ReportsScreen;
