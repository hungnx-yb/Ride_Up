/**
 * @fileoverview Màn hình quản lý người dùng dành cho Admin.
 *
 * Hiển thị danh sách toàn bộ người dùng với thẻ tóm tắt và bộ đếm phân loại
 * (Tổng / Admin / Tài xế / Khách hàng).
 *
 * API được gọi:
 *  - getAllUsers() → GET /admin/users (cache 20s)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_COLORS, ADMIN_SHADOW, ADMIN_SHADOW_SM, GRADIENT_HEADER } from '../../config/AdminTheme';
import { getAllUsers } from '../../services/api';

/** Map role code → nhãn tiếng Việt. */
const ROLE_TEXT = {
  ADMIN: 'Quản trị viên',
  DRIVER: 'Tài xế',
  CUSTOMER: 'Khách hàng',
};

/** Map role code → style badge (màu nền, màu chữ, icon). */
const ROLE_STYLE = {
  ADMIN: { bg: ADMIN_COLORS.adminPurpleBg, text: ADMIN_COLORS.adminPurple, icon: 'shield-outline' },
  DRIVER: { bg: ADMIN_COLORS.driverCyanBg, text: ADMIN_COLORS.driverCyan, icon: 'car-outline' },
  CUSTOMER: { bg: ADMIN_COLORS.customerGreenBg, text: ADMIN_COLORS.customerGreen, icon: 'person-outline' },
};

/** @param {{ navigation: object }} props */
const ManageUsersScreen = ({ navigation }) => {
  /** Danh sách UserResponse từ /admin/users. */
  const [users, setUsers] = useState([]);
  /** true khi đang load lần đầu. */
  const [loading, setLoading] = useState(true);
  /** true khi đang pull-to-refresh. */
  const [refreshing, setRefreshing] = useState(false);

  /** Fetch danh sách người dùng từ GET /admin/users (cache 20s). */
  const loadData = useCallback(async () => {
    try {
      const data = await getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Thống kê phân loại người dùng theo role (client-side, không gọi thêm API).
   * Một user có thể có nhiều role nên tổng có thể > total.
   */
  const summary = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter((u) => Array.isArray(u?.roles) && u.roles.includes('ADMIN')).length;
    const driverCount = users.filter((u) => Array.isArray(u?.roles) && u.roles.includes('DRIVER')).length;
    const customerCount = users.filter((u) => Array.isArray(u?.roles) && u.roles.includes('CUSTOMER')).length;
    return { total, adminCount, driverCount, customerCount };
  }, [users]);

  /**
   * Chuyển mảng role codes thành chuỗi nhãn tiếng Việt.
   * VD: ['DRIVER', 'CUSTOMER'] → "Tài xế, Khách hàng"
   *
   * @param {string[]} roles
   * @returns {string}
   */
  const roleLabel = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) return 'Không có';
    return roles.map((role) => ROLE_TEXT[role] || role).join(', ');
  };

  /**
   * Lấy chữ viết tắt từ tên để hiển thị avatar chữ.
   * VD: "Nguyễn Văn An" → "NA", "Admin" → "A"
   *
   * @param {string} name - Họ tên đầy đủ
   * @returns {string} 1-2 ký tự hoa
   */
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length > 1
      ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
      : parts[0].charAt(0).toUpperCase();
  };

  /**
   * Lấy style (màu sắc, icon) dựa trên role đầu tiên của user.
   *
   * @param {string[]} roles - Mảng role codes
   * @returns {{ bg: string, text: string, icon: string } | null}
   */
  const getRoleStyle = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) return null;
    return ROLE_STYLE[roles[0]] || null;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ADMIN_COLORS.gradientStart} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={GRADIENT_HEADER} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>Quản lý người dùng</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{users.length} người dùng</Text>
          </View>
        </View>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <View style={styles.summaryRow}>
        <SummaryCard label="Tổng cộng" value={summary.total} icon="people-outline" color={ADMIN_COLORS.gradientStart} bg={ADMIN_COLORS.adminPurpleBg} />
        <SummaryCard label="Admin" value={summary.adminCount} icon="shield-outline" color={ADMIN_COLORS.adminPurple} bg={ADMIN_COLORS.adminPurpleBg} />
        <SummaryCard label="Tài xế" value={summary.driverCount} icon="car-outline" color={ADMIN_COLORS.driverCyan} bg={ADMIN_COLORS.driverCyanBg} />
        <SummaryCard label="Khách" value={summary.customerCount} icon="person-outline" color={ADMIN_COLORS.customerGreen} bg={ADMIN_COLORS.customerGreenBg} />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item, index) => item?.id || String(index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={ADMIN_COLORS.gradientStart}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>Không có người dùng</Text>}
        renderItem={({ item }) => {
          const rStyle = getRoleStyle(item?.roles);
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: rStyle?.bg || '#F1F5F9' }]}>
                  <Text style={[styles.avatarText, { color: rStyle?.text || ADMIN_COLORS.textMuted }]}>
                    {getInitials(item?.fullName)}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.name}>{item?.fullName || 'Không có'}</Text>
                  <View style={styles.metaEmailRow}>
                    <Ionicons name="mail-outline" size={12} color={ADMIN_COLORS.textSecondary} />
                    <Text style={styles.metaEmail}>{item?.email || 'Không có'}</Text>
                  </View>
                </View>
                <View style={[
                  styles.verifiedBadge,
                  item?.verified === true ? styles.verifiedTrue : styles.verifiedFalse,
                ]}>
                  <Ionicons
                    name={item?.verified === true ? 'checkmark-circle' : 'close-circle'}
                    size={11}
                    color={item?.verified === true ? ADMIN_COLORS.success : '#92400E'}
                  />
                  <Text style={[
                    styles.verifiedText,
                    item?.verified === true ? styles.verifiedTrueText : styles.verifiedFalseText,
                  ]}>
                    {item?.verified === true ? ' Đã xác minh' : ' Chưa xác minh'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardMeta}>
                <View style={styles.phoneRow}>
                  <Ionicons name="phone-portrait-outline" size={13} color={ADMIN_COLORS.textSecondary} />
                  <Text style={styles.metaItem}>{item?.phoneNumber || 'Không có'}</Text>
                </View>
                <View style={styles.rolesWrap}>
                  {Array.isArray(item?.roles) && item.roles.map((role) => {
                    const rs = ROLE_STYLE[role];
                    return (
                      <View key={role} style={[styles.roleBadge, { backgroundColor: rs?.bg || '#F1F5F9' }]}>
                        <Ionicons
                          name={rs?.icon || 'help-circle-outline'}
                          size={11}
                          color={rs?.text || ADMIN_COLORS.textSecondary}
                        />
                        <Text style={[styles.roleBadgeText, { color: rs?.text || ADMIN_COLORS.textSecondary }]}>
                          {ROLE_TEXT[role] || role}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const SummaryCard = ({ label, value, icon, color, bg }) => (
  <View style={[styles.summaryCard, { backgroundColor: bg || '#F1F5F9' }]}>
    <Ionicons name={icon} size={20} color={color} style={{ marginBottom: 4 }} />
    <Text style={[styles.summaryValue, { color }]}>{typeof value === 'number' ? value : 0}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
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
  headerBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    ...ADMIN_SHADOW_SM,
  },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: ADMIN_COLORS.textSecondary, marginTop: 2, fontWeight: '600' },

  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: {
    backgroundColor: ADMIN_COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...ADMIN_SHADOW,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 16, fontWeight: '800' },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: ADMIN_COLORS.textPrimary },
  metaEmailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaEmail: { fontSize: 12, color: ADMIN_COLORS.textSecondary },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  verifiedTrue: { backgroundColor: ADMIN_COLORS.successBg },
  verifiedFalse: { backgroundColor: '#FEF9C3' },
  verifiedText: { fontSize: 10, fontWeight: '700' },
  verifiedTrueText: { color: ADMIN_COLORS.success },
  verifiedFalseText: { color: '#92400E' },

  cardMeta: {
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.divider,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaItem: { fontSize: 13, color: ADMIN_COLORS.textSecondary },
  rolesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  empty: { textAlign: 'center', color: ADMIN_COLORS.textMuted, paddingTop: 48, fontSize: 14 },
});

export default ManageUsersScreen;
