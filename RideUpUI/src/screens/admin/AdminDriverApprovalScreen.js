import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../config/config';
import {
  approveDriverProfile,
  getAdminDriverProfiles,
  rejectDriverProfile,
} from '../../services/api';

const STATUS_TEXT = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

const STATUS_COLOR = {
  PENDING: { bg: '#FFF3E0', text: '#E65100' },
  APPROVED: { bg: '#E8F5E9', text: '#2E7D32' },
  REJECTED: { bg: '#FFEBEE', text: '#C62828' },
};

const AdminDriverApprovalScreen = ({ navigation }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [processingId, setProcessingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [failedImages, setFailedImages] = useState({});

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

  const filtered = useMemo(() => {
    if (activeTab === 'ALL') return profiles;
    if (activeTab === 'PENDING') {
      return profiles.filter((p) => p.status === 'PENDING' && p.submitted === true);
    }
    return profiles.filter((p) => p.status === activeTab);
  }, [profiles, activeTab]);

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

  const markImageFailed = (key) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  const renderDocImage = (item, label, value, keySuffix) => {
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
            <Text style={styles.docFallbackText}>Khong co anh</Text>
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const displayStatus = !item.submitted && item.status === 'PENDING' ? 'DRAFT' : item.status;
    const statusStyle = STATUS_COLOR[item.status] || STATUS_COLOR.PENDING;
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.name}>{item.fullName || 'Tài xế'}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>
              {displayStatus === 'DRAFT' ? 'Chưa nộp' : (STATUS_TEXT[item.status] || item.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.meta}>📧 {item.email || 'Chưa có email'}</Text>
        <Text style={styles.meta}>📱 {item.phoneNumber || 'Chưa có số điện thoại'}</Text>
        <Text style={styles.meta}>🪪 CCCD: {item.cccd || 'Không có'}</Text>
        <Text style={styles.meta}>📝 GPLX: {item.gplx || 'Không có'}</Text>
        <Text style={styles.meta}>🚗 {item.vehicleBrand || 'Không có'} {item.vehicleModel || ''} · {item.plateNumber || 'Không có'}</Text>

        <View style={styles.docGrid}>
          {renderDocImage(item, 'CCCD mặt trước', item.cccdImageFront, 'cccd-front')}
          {renderDocImage(item, 'CCCD mặt sau', item.cccdImageBack, 'cccd-back')}
          {renderDocImage(item, 'Ảnh GPLX', item.gplxImage, 'gplx')}
          {renderDocImage(item, 'Ảnh xe', item.vehicleImage, 'vehicle')}
          {renderDocImage(item, 'Đăng ký xe', item.registrationImage, 'registration')}
          {renderDocImage(item, 'Bảo hiểm xe', item.insuranceImage, 'insurance')}
        </View>

        {item.rejectionReason ? (
          <Text style={styles.rejectReason}>Lý do từ chối: {item.rejectionReason}</Text>
        ) : null}

        {item.status === 'PENDING' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnApprove, processingId === item.driverProfileId && styles.btnDisabled]}
              disabled={processingId === item.driverProfileId}
              onPress={() => onApprove(item.driverProfileId)}
            >
              {processingId === item.driverProfileId ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Duyệt</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnReject, processingId === item.driverProfileId && styles.btnDisabled]}
              disabled={processingId === item.driverProfileId}
              onPress={() => setRejectingId(item.driverProfileId)}
            >
              <Text style={styles.btnText}>Từ chối</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.adminColor} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Duyệt hồ sơ tài xế</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{STATUS_TEXT[tab] || 'Tất cả'}</Text>
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
          <Text style={styles.rejectTitle}>Lý do từ chối</Text>
          <TextInput
            style={styles.rejectInput}
            value={rejectionReason}
            onChangeText={setRejectionReason}
            placeholder="Nhập lý do từ chối"
            placeholderTextColor="#94A3B8"
          />
          <View style={styles.rejectActions}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => { setRejectingId(null); setRejectionReason(''); }}>
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: { marginRight: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EEF2FF' },
  tabActive: { backgroundColor: '#5B21B6' },
  tabText: { fontSize: 12, color: '#4338CA', fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  list: { padding: 12, paddingBottom: 120 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '800', color: '#111827' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  docGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  docItem: {
    width: '48%',
  },
  docLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 4,
  },
  docImage: {
    width: '100%',
    height: 88,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  docFallback: {
    width: '100%',
    height: 88,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docFallbackText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  rejectReason: { fontSize: 12, color: '#B91C1C', marginTop: 6 },
  actionRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  btn: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  btnApprove: { flex: 1, backgroundColor: '#2E7D32' },
  btnReject: { flex: 1, backgroundColor: '#C62828' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: '#6B7280', paddingTop: 40 },
  rejectBox: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  rejectTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  rejectInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, color: '#111827' },
  rejectActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnGhost: { flex: 1, backgroundColor: '#F3F4F6' },
  btnGhostText: { color: '#111827', fontWeight: '700' },
});

export default AdminDriverApprovalScreen;
