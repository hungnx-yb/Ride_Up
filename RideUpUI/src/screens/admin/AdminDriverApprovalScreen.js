/**
 * @fileoverview Màn hình duyệt/từ chối hồ sơ tài xế dành cho Admin.
 *
 * Hiển thị danh sách hồ sơ phân theo tab trạng thái (PENDING/APPROVED/REJECTED/ALL).
 * Admin có thể xem ảnh tài liệu (CCCD, GPLX, xe), duyệt hoặc từ chối với lý do.
 *
 * API được gọi:
 *  - getAdminDriverProfiles()         → GET /admin/driver-profiles      (không cache)
 *  - approveDriverProfile(id)         → PUT /admin/driver-profiles/{id}/approve
 *  - rejectDriverProfile(id, reason)  → PUT /admin/driver-profiles/{id}/reject
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ADMIN_COLORS, ADMIN_SHADOW, ADMIN_SHADOW_SM, GRADIENT_HEADER } from '../../config/AdminTheme';
import {
  approveDriverProfile,
  getAdminDriverProfiles,
  rejectDriverProfile,
} from '../../services/api';

/** Map trạng thái hồ sơ → text hiển thị tiếng Việt. */
const STATUS_TEXT = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

/** Map trạng thái → style badge (màu nền, màu chữ, màu chấm tròn). */
const STATUS_COLOR = {
  PENDING: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  APPROVED: { bg: '#DCFCE7', text: '#14532D', dot: '#16A34A' },
  REJECTED: { bg: '#FEE2E2', text: '#7F1D1D', dot: '#DC2626' },
};

/** @param {{ navigation: object }} props */
const AdminDriverApprovalScreen = ({ navigation }) => {
  /** Danh sách tất cả hồ sơ tài xế từ API (chưa lọc). */
  const [profiles, setProfiles] = useState([]);
  /** true khi đang load lần đầu. */
  const [loading, setLoading] = useState(true);
  /** true khi đang pull-to-refresh. */
  const [refreshing, setRefreshing] = useState(false);
  /** Tab đang hiển thị: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' */
  const [activeTab, setActiveTab] = useState('PENDING');
  /** ID hồ sơ đang được xử lý – disable button để tránh double-click. */
  const [processingId, setProcessingId] = useState(null);
  /** ID hồ sơ đang mở form nhập lý do từ chối. */
  const [rejectingId, setRejectingId] = useState(null);
  /** Nội dung lý do từ chối admin đang nhập. */
  const [rejectionReason, setRejectionReason] = useState('');
  /** Map { "profileId:imageKey": true } – theo dõi ảnh lỗi để hiển thị fallback. */
  const [failedImages, setFailedImages] = useState({});

  /** Fetch danh sách hồ sơ tài xế từ GET /admin/driver-profiles (không cache). */
  const loadData = useCallback(async () => {
    try {
      const data = await getAdminDriverProfiles();
      setProfiles(data);
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không tải được danh sách hồ sơ tài xế');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Danh sách hồ sơ đã lọc theo tab.
   * Quy tắc PENDING: chỉ hiển thị status=PENDING AND submitted=true
   * (loại bỏ bản nháp chưa nộp chính thức).
   */
  const filtered = useMemo(() => {
    if (activeTab === 'ALL') return profiles;
    if (activeTab === 'PENDING') {
      return profiles.filter((p) => p.status === 'PENDING' && p.submitted === true);
    }
    return profiles.filter((p) => p.status === activeTab);
  }, [profiles, activeTab]);

  /** Đếm số hồ sơ cho từng tab để hiển thị badge số lượng. */
  const tabCount = useMemo(() => ({
    PENDING: profiles.filter((p) => p.status === 'PENDING' && p.submitted === true).length,
    APPROVED: profiles.filter((p) => p.status === 'APPROVED').length,
    REJECTED: profiles.filter((p) => p.status === 'REJECTED').length,
    ALL: profiles.length,
  }), [profiles]);

  /**
   * Duyệt hồ sơ tài xế via PUT /admin/driver-profiles/{id}/approve.
   * Set processingId để disable button tránh double-click trong khi đang xử lý.
   *
   * @param {string} profileId - UUID của hồ sơ cần duyệt
   */
  const onApprove = async (profileId) => {
    setProcessingId(profileId);
    try {
      await approveDriverProfile(profileId);
      await loadData();
      Alert.alert('Thành công', 'Đã duyệt hồ sơ tài xế.');
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không thể duyệt hồ sơ');
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Từ chối hồ sơ tài xế via PUT /admin/driver-profiles/{id}/reject.
   * Yêu cầu rejectingId phải được set trước (qua nút "Từ chối" trên card).
   */
  const onReject = async () => {
    if (!rejectingId) return;
    setProcessingId(rejectingId);
    try {
      await rejectDriverProfile(rejectingId, rejectionReason.trim());
      setRejectingId(null);
      setRejectionReason('');
      await loadData();
      Alert.alert('Đã từ chối', 'Hồ sơ tài xế đã được cập nhật trạng thái từ chối.');
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không thể từ chối hồ sơ');
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Đánh dấu ảnh lỗi để hiển thị fallback placeholder thay vì ảnh hỏng.
   *
   * @param {string} key - Key duy nhất: "{profileId}:{imageType}"
   */
  const markImageFailed = (key) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  /**
   * Render ô ảnh tài liệu với fallback nếu load lỗi.
   * Key = "{profileId}:{keySuffix}" để xác định duy nhất mỗi ảnh trong danh sách.
   *
   * @param {object} item - DriverProfile object
   * @param {string} label - Nhãn hiển thị (VD: "CCCD mặt trước")
   * @param {string} value - Supabase public URL
   * @param {string} keySuffix - Hậu tố key phân biệt ảnh: "cccd-front", "gplx", v.v.
   */
  const renderDocImage = (item, label, value, keySuffix) => {
    // Key duy nhất để theo dõi lỗi độc lập cho từng ảnh của từng hồ sơ
    const key = `${item.driverProfileId || 'unknown'}:${keySuffix}`;
    const hasImage = !!value && !failedImages[key];
    return (
      <View key={keySuffix} style={styles.docItem}>
        <Text style={styles.docLabel}>{label}</Text>
        {hasImage ? (
          <Image
            source={{ uri: value }}
            style={styles.docImage}
            resizeMode="cover"
            onError={() => markImageFailed(key)}
          />
        ) : (
          <View style={styles.docFallback}>
            <Text style={styles.docFallbackText}>Không có ảnh</Text>
          </View>
        )}
      </View>
    );
  };

  /**
   * Render card hồ sơ tài xế trong FlatList.
   * Hồ sơ PENDING + submitted=false hiển thị badge "Chưa nộp" thay vì "Chờ duyệt".
   */
  const renderItem = ({ item }) => {
    // Business rule: phân biệt hồ sơ đã nộp (PENDING) vs bản nháp (DRAFT)
    const displayStatus = !item.submitted && item.status === 'PENDING' ? 'DRAFT' : item.status;
    const statusStyle = STATUS_COLOR[item.status] || STATUS_COLOR.PENDING;
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{(item.fullName || 'T').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.name}>{item.fullName || 'Tài xế'}</Text>
            <View style={styles.metaEmailRow}>
              <Ionicons name="mail-outline" size={12} color={ADMIN_COLORS.textSecondary} />
              <Text style={styles.metaEmail}>{item.email || 'Chưa có email'}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <View style={[styles.badgeDot, { backgroundColor: statusStyle.dot }]} />
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>
              {displayStatus === 'DRAFT' ? 'Chưa nộp' : (STATUS_TEXT[item.status] || item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Điện thoại</Text>
            <Text style={styles.metaValue}>{item.phoneNumber || '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>CCCD</Text>
            <Text style={styles.metaValue}>{item.cccd || '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>GPLX</Text>
            <Text style={styles.metaValue}>{item.gplx || '—'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Phương tiện</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {[item.vehicleBrand, item.vehicleModel, item.plateNumber].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
        </View>

        <View style={styles.docGrid}>
          {renderDocImage(item, 'CCCD mặt trước', item.cccdImageFront, 'cccd-front')}
          {renderDocImage(item, 'CCCD mặt sau', item.cccdImageBack, 'cccd-back')}
          {renderDocImage(item, 'Ảnh GPLX', item.gplxImage, 'gplx')}
          {renderDocImage(item, 'Ảnh xe', item.vehicleImage, 'vehicle')}
          {renderDocImage(item, 'Đăng ký xe', item.registrationImage, 'registration')}
          {renderDocImage(item, 'Bảo hiểm xe', item.insuranceImage, 'insurance')}
        </View>

        {item.rejectionReason ? (
          <View style={styles.rejectReasonWrap}>
            <Text style={styles.rejectReasonLabel}>Lý do từ chối:</Text>
            <Text style={styles.rejectReasonText}>{item.rejectionReason}</Text>
          </View>
        ) : null}

        {item.status === 'PENDING' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnApprove, processingId === item.driverProfileId && styles.btnDisabled]}
              disabled={processingId === item.driverProfileId}
              onPress={() => onApprove(item.driverProfileId)}
              activeOpacity={0.8}
            >
              {processingId === item.driverProfileId
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <View style={styles.btnInner}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.btnText}>Duyệt</Text>
                  </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnReject, processingId === item.driverProfileId && styles.btnDisabled]}
              disabled={processingId === item.driverProfileId}
              onPress={() => setRejectingId(item.driverProfileId)}
              activeOpacity={0.8}
            >
              <View style={styles.btnInner}>
                <Ionicons name="close-circle-outline" size={16} color="#fff" />
                <Text style={styles.btnText}>Từ chối</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
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
          <Text style={styles.title}>Duyệt hồ sơ tài xế</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{profiles.length} hồ sơ</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <View style={styles.tabs}>
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {STATUS_TEXT[tab] || 'Tất cả'}
            </Text>
            {tabCount[tab] > 0 && (
              <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>
                  {tabCount[tab]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.driverProfileId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>Không có hồ sơ tài xế</Text>}
        renderItem={renderItem}
      />

      {rejectingId && (
        <View style={styles.rejectBox}>
          <View style={styles.rejectHandle} />
          <View style={styles.rejectTitleRow}>
            <Ionicons name="chatbubble-outline" size={18} color={ADMIN_COLORS.danger} />
            <Text style={styles.rejectTitle}>Lý do từ chối</Text>
          </View>
          <TextInput
            style={styles.rejectInput}
            value={rejectionReason}
            onChangeText={setRejectionReason}
            placeholder="Nhập lý do từ chối hồ sơ..."
            placeholderTextColor={ADMIN_COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
          <View style={styles.rejectActions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => { setRejectingId(null); setRejectionReason(''); }}
            >
              <Text style={styles.btnGhostText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={onReject}>
              <Text style={styles.btnText}>Xác nhận từ chối</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

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

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    gap: 5,
  },
  tabActive: { backgroundColor: ADMIN_COLORS.gradientStart },
  tabText: { fontSize: 12, color: ADMIN_COLORS.textSecondary, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: ADMIN_COLORS.gradientStart,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },
  tabBadgeTextActive: { color: '#fff' },

  // List
  list: { padding: 12, paddingBottom: 120 },
  card: {
    backgroundColor: ADMIN_COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...ADMIN_SHADOW,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ADMIN_COLORS.adminPurpleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: ADMIN_COLORS.adminPurple },
  name: { fontSize: 15, fontWeight: '800', color: ADMIN_COLORS.textPrimary },
  metaEmailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaEmail: { fontSize: 12, color: ADMIN_COLORS.textSecondary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Meta grid
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.divider,
  },
  metaItem: { width: '48%' },
  metaLabel: { fontSize: 10, color: ADMIN_COLORS.textMuted, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { fontSize: 13, color: ADMIN_COLORS.textPrimary, fontWeight: '600' },

  // Doc grid
  docGrid: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.divider,
    paddingTop: 12,
  },
  docItem: { width: '48%' },
  docLabel: { fontSize: 10, color: ADMIN_COLORS.textMuted, fontWeight: '700', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 },
  docImage: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  docFallback: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docFallbackText: { fontSize: 11, color: ADMIN_COLORS.textMuted, fontWeight: '600' },

  rejectReasonWrap: {
    marginTop: 10,
    padding: 10,
    backgroundColor: ADMIN_COLORS.dangerBg,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: ADMIN_COLORS.danger,
  },
  rejectReasonLabel: { fontSize: 11, color: ADMIN_COLORS.danger, fontWeight: '800', marginBottom: 3, textTransform: 'uppercase' },
  rejectReasonText: { fontSize: 13, color: '#7F1D1D' },

  actionRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  btn: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnApprove: { flex: 1, backgroundColor: '#16A34A', ...ADMIN_SHADOW_SM },
  btnReject: { flex: 1, backgroundColor: ADMIN_COLORS.danger, ...ADMIN_SHADOW_SM },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: ADMIN_COLORS.textMuted, paddingTop: 48, fontSize: 14 },

  rejectBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
    ...ADMIN_SHADOW,
  },
  rejectHandle: {
    width: 40,
    height: 4,
    backgroundColor: ADMIN_COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  rejectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  rejectTitle: { fontSize: 15, fontWeight: '800', color: ADMIN_COLORS.textPrimary },
  rejectInput: {
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: ADMIN_COLORS.textPrimary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  rejectActions: { flexDirection: 'row', gap: 8 },
  btnGhost: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 11 },
  btnGhostText: { color: ADMIN_COLORS.textPrimary, fontWeight: '700', fontSize: 13, textAlign: 'center' },
});

export default AdminDriverApprovalScreen;
