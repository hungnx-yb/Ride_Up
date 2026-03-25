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
import { COLORS } from '../../config/config';
import { getAdminStats } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_MAX_HEIGHT = 90;

const ReportsScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const safeNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

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

  const formatCurrency = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)}₫`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.adminColor} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Báo cáo thống kê</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.heroWrap}>
        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroLabel}>Tổng quan vận hành</Text>
            <Text style={styles.heroDate}>{new Date().toLocaleDateString('vi-VN')}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>{normalized.operationScore}</Text>
            <Text style={styles.scoreLabel}>Điểm</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>KPI hôm nay</Text>
        <View style={styles.grid}>
          <MetricCard icon="🚗" label="Tổng chuyến" value={normalized.today.totalRides} color="#1565C0" />
          <MetricCard icon="✅" label="Hoàn thành" value={normalized.today.completedRides} color="#2E7D32" />
          <MetricCard icon="❌" label="Đã hủy" value={normalized.today.cancelledRides} color="#C62828" />
          <MetricCard icon="💰" label="Doanh thu" value={formatCurrency(normalized.today.revenue)} color="#E65100" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cơ cấu trạng thái chuyến hôm nay</Text>
        <View style={styles.card}>
          <ProgressRow label="Hoàn thành" value={normalized.completionRate} color="#2E7D32" count={normalized.today.completedRides} />
          <ProgressRow label="Đã hủy" value={normalized.cancelRate} color="#C62828" count={normalized.today.cancelledRides} />
          <ProgressRow label="Đang xử lý" value={normalized.activeRate} color="#1565C0" count={Math.max(normalized.today.totalRides - normalized.today.completedRides - normalized.today.cancelledRides, 0)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>So sánh nhanh hôm nay vs trung bình tháng</Text>
        <View style={styles.compareGrid}>
          <View style={[styles.card, styles.compareCard]}>
            <Text style={styles.compareTitle}>Số chuyến</Text>
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
            <Text style={styles.compareTitle}>Doanh thu</Text>
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

const MetricCard = ({ icon, label, value, color }) => (
  <View style={[styles.metricCard, { borderTopColor: color }]}>
    <Text style={styles.metricIcon}>{icon}</Text>
    <Text style={styles.metricValue}>{value}</Text>
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
  container: { flex: 1, backgroundColor: '#F6F8FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.adminColor,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 26, lineHeight: 30 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroWrap: { paddingHorizontal: 12, marginTop: 10 },
  heroCard: {
    borderRadius: 14,
    backgroundColor: '#20113A',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: { color: '#D8C9FF', fontSize: 13, fontWeight: '700' },
  heroDate: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  scoreBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  scoreLabel: { color: '#E9D5FF', fontSize: 11, fontWeight: '700' },
  section: { paddingHorizontal: 12, marginTop: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderTopWidth: 3,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricIcon: { fontSize: 16, marginBottom: 4 },
  metricValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  metricLabel: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  compareGrid: { gap: 10 },
  compareCard: {
    width: SCREEN_WIDTH - 24,
  },
  compareTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 8 },
  columnChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    minHeight: CHART_MAX_HEIGHT + 36,
  },
  columnItem: {
    alignItems: 'center',
    width: '42%',
  },
  columnValue: { fontSize: 11, color: '#334155', marginBottom: 4, fontWeight: '700' },
  columnTrack: {
    height: CHART_MAX_HEIGHT,
    width: 34,
    backgroundColor: '#EEF2F7',
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  columnFill: {
    width: 34,
    borderRadius: 999,
  },
  columnLabel: { marginTop: 6, fontSize: 11, color: '#475569', fontWeight: '700' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: { fontSize: 13, color: '#475569' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '700' },
  rateRow: { marginBottom: 10 },
  rateLabelWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rateTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  rateBar: { height: 8, borderRadius: 999 },
  mixTrack: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  mixSegment: { height: 14 },
  mixLegendRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, color: '#475569', fontWeight: '700' },
  empty: { fontSize: 13, color: '#6B7280' },
  activityRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timelineRail: { width: 18, alignItems: 'center' },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 3,
  },
  timelineContent: { flex: 1, paddingLeft: 2 },
  activityText: { fontSize: 13, color: '#111827' },
  activityTime: { fontSize: 12, color: '#64748B', marginTop: 2 },
});

export default ReportsScreen;
