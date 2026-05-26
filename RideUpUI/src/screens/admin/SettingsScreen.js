import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG, APP_CONFIG } from '../../config/config';
import { ADMIN_COLORS, ADMIN_SHADOW, ADMIN_SHADOW_SM, GRADIENT_HEADER } from '../../config/AdminTheme';
import { USE_MOCK_DATA, getAdminStats, getLocationStats } from '../../services/api';

const SETTINGS_KEYS = {
  AUTO_REFRESH: '@admin_auto_refresh',
  SYNC_CONFIRM: '@admin_sync_confirm',
};

const SettingsScreen = ({ navigation }) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [syncConfirm, setSyncConfirm] = useState(true);
  const [checking, setChecking] = useState(false);
  const [healthText, setHealthText] = useState('Chưa kiểm tra');

  const loadLocalSettings = useCallback(async () => {
    try {
      const [storedAutoRefresh, storedSyncConfirm] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEYS.AUTO_REFRESH),
        AsyncStorage.getItem(SETTINGS_KEYS.SYNC_CONFIRM),
      ]);

      setAutoRefresh(storedAutoRefresh !== 'false');
      setSyncConfirm(storedSyncConfirm !== 'false');
    } catch {
      setAutoRefresh(true);
      setSyncConfirm(true);
    }
  }, []);

  useEffect(() => {
    loadLocalSettings();
  }, [loadLocalSettings]);

  const saveToggle = async (key, value, setter) => {
    setter(value);
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch {
      Alert.alert('Thông báo', 'Không thể lưu cài đặt, vui lòng thử lại.');
    }
  };

  const checkSystemHealth = async () => {
    setChecking(true);
    try {
      await Promise.all([getAdminStats(), getLocationStats()]);
      setHealthText('Server hoạt động bình thường');
      Alert.alert('Thành công', 'Kết nối server ổn định.');
    } catch {
      setHealthText('Không kết nối được server');
      Alert.alert('Lỗi', 'Không thể kết nối server. Hãy kiểm tra backend và mạng.');
    } finally {
      setChecking(false);
    }
  };

  const clearLocalAdminCache = async () => {
    try {
      await AsyncStorage.multiRemove([SETTINGS_KEYS.AUTO_REFRESH, SETTINGS_KEYS.SYNC_CONFIRM]);
      setAutoRefresh(true);
      setSyncConfirm(true);
      Alert.alert('Đã xóa', 'Đã xóa cache cài đặt quản trị cục bộ.');
    } catch {
      Alert.alert('Lỗi', 'Không thể xóa cache cục bộ.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={GRADIENT_HEADER} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>Cài đặt hệ thống</Text>
          <View style={styles.headerBadge}>
            <Ionicons name="settings-outline" size={12} color="#fff" />
            <Text style={styles.headerBadgeText}> Quản trị viên</Text>
          </View>
        </View>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tùy chọn quản trị</Text>
        <View style={styles.card}>
          <SettingRow
            icon="refresh-outline"
            label="Tự làm mới dữ liệu"
            desc="Tự đồng bộ số liệu khi mở màn hình admin"
            value={autoRefresh}
            onValueChange={(value) => saveToggle(SETTINGS_KEYS.AUTO_REFRESH, value, setAutoRefresh)}
          />
          <SettingRow
            icon="checkmark-outline"
            label="Xác nhận trước khi đồng bộ"
            desc="Hiển thị hộp xác nhận khi đồng bộ địa lý"
            value={syncConfirm}
            onValueChange={(value) => saveToggle(SETTINGS_KEYS.SYNC_CONFIRM, value, setSyncConfirm)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trạng thái hệ thống</Text>
        <View style={styles.card}>
          <InfoRow icon="phone-portrait-outline" label="Tên ứng dụng" value={APP_CONFIG.APP_NAME || 'RideUp'} />
          <InfoRow icon="pricetag-outline" label="Phiên bản" value={APP_CONFIG.VERSION || 'Không có'} />
          <InfoRow icon="globe-outline" label="API Endpoint" value={API_CONFIG.BASE_URL || 'Không có'} />
          <InfoRow icon="server-outline" label="Nguồn dữ liệu" value={USE_MOCK_DATA ? 'Mock' : 'Backend thật'} />
          <InfoRow
            icon="heart-outline"
            label="Sức khỏe hệ thống"
            value={healthText}
            valueStyle={
              healthText.includes('bình thường')
                ? styles.healthGood
                : healthText.includes('Chưa')
                  ? styles.healthUnknown
                  : styles.healthBad
            }
          />

          <TouchableOpacity
            style={[styles.primaryBtn, checking && styles.primaryBtnDisabled]}
            onPress={checkSystemHealth}
            disabled={checking}
            activeOpacity={0.8}
          >
            {checking
              ? <ActivityIndicator size="small" color="#fff" />
              : (
                <View style={styles.btnInner}>
                  <Ionicons name="search-outline" size={15} color="#fff" />
                  <Text style={styles.primaryBtnText}>Kiểm tra kết nối server</Text>
                </View>
              )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Điều hướng nhanh</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation?.navigate('AdminDriverApproval')}
            activeOpacity={0.7}
          >
            <View style={[styles.navBtnIconWrap, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="shield-checkmark-outline" size={17} color="#16A34A" />
            </View>
            <Text style={styles.navBtnText}>Duyệt hồ sơ tài xế</Text>
            <Ionicons name="chevron-forward" size={18} color={ADMIN_COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation?.navigate('ManageUsers')}
            activeOpacity={0.7}
          >
            <View style={[styles.navBtnIconWrap, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="people-outline" size={17} color="#2563EB" />
            </View>
            <Text style={styles.navBtnText}>Quản lý người dùng</Text>
            <Ionicons name="chevron-forward" size={18} color={ADMIN_COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation?.navigate('Reports')}
            activeOpacity={0.7}
          >
            <View style={[styles.navBtnIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="bar-chart-outline" size={17} color="#D97706" />
            </View>
            <Text style={styles.navBtnText}>Báo cáo thống kê</Text>
            <Ionicons name="chevron-forward" size={18} color={ADMIN_COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vùng nguy hiểm</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.dangerDesc}>Xóa tất cả cài đặt quản trị đã lưu trong bộ nhớ cục bộ. Hành động này không thể hoàn tác.</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={clearLocalAdminCache} activeOpacity={0.8}>
            <View style={styles.btnInner}>
              <Ionicons name="trash-outline" size={15} color="#fff" />
              <Text style={styles.dangerBtnText}>Xóa cache cài đặt cục bộ</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const SettingRow = ({ icon, label, desc, value, onValueChange }) => (
  <View style={styles.settingRow}>
    <View style={styles.settingIconWrap}>
      <Ionicons name={icon} size={18} color={ADMIN_COLORS.gradientStart} />
    </View>
    <View style={{ flex: 1, paddingRight: 10 }}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingDesc}>{desc}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      thumbColor="#fff"
      trackColor={{ false: '#CBD5E1', true: ADMIN_COLORS.gradientStart }}
    />
  </View>
);

const InfoRow = ({ icon, label, value, valueStyle }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={16} color={ADMIN_COLORS.textSecondary} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueStyle]} numberOfLines={1}>{value || 'Không có'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ADMIN_COLORS.pageBg },
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  section: { paddingHorizontal: 12, marginTop: 14 },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: ADMIN_COLORS.textPrimary,
    marginBottom: 10, letterSpacing: 0.2,
  },
  card: {
    backgroundColor: ADMIN_COLORS.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    ...ADMIN_SHADOW,
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.divider,
  },
  settingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: ADMIN_COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: { fontSize: 14, fontWeight: '700', color: ADMIN_COLORS.textPrimary },
  settingDesc: { marginTop: 2, fontSize: 12, color: ADMIN_COLORS.textMuted },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.divider,
  },
  infoIconWrap: {
    width: 28,
    alignItems: 'center',
    marginRight: 10,
  },
  infoLabel: { flex: 1, fontSize: 13, color: ADMIN_COLORS.textSecondary },
  infoValue: { fontSize: 13, color: ADMIN_COLORS.textPrimary, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  healthGood: { color: ADMIN_COLORS.success },
  healthUnknown: { color: ADMIN_COLORS.textMuted },
  healthBad: { color: ADMIN_COLORS.danger },

  primaryBtn: {
    margin: 14,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.gradientStart,
    paddingVertical: 13,
    alignItems: 'center',
    ...ADMIN_SHADOW_SM,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Nav buttons
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.divider,
    gap: 12,
  },
  navBtnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: ADMIN_COLORS.textPrimary },

  // Danger zone
  dangerCard: {
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  dangerDesc: {
    fontSize: 13,
    color: '#7F1D1D',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    lineHeight: 19,
  },
  dangerBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.danger,
    paddingVertical: 13,
    alignItems: 'center',
    ...ADMIN_SHADOW_SM,
  },
  dangerBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default SettingsScreen;
