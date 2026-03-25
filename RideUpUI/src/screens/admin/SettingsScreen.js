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
import { API_CONFIG, APP_CONFIG, COLORS } from '../../config/config';
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cài đặt hệ thống</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tùy chọn quản trị</Text>
        <View style={styles.card}>
          <SettingRow
            label="Tự làm mới dữ liệu"
            desc="Tự đồng bộ số liệu khi mở màn hình admin"
            value={autoRefresh}
            onValueChange={(value) => saveToggle(SETTINGS_KEYS.AUTO_REFRESH, value, setAutoRefresh)}
          />
          <SettingRow
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
          <InfoRow label="Tên ứng dụng" value={APP_CONFIG.APP_NAME || 'RideUp'} />
          <InfoRow label="Phiên bản" value={APP_CONFIG.VERSION || 'Không có'} />
          <InfoRow label="API" value={API_CONFIG.BASE_URL || 'Không có'} />
          <InfoRow label="Dữ liệu" value={USE_MOCK_DATA ? 'Mock' : 'Backend thật'} />
          <InfoRow label="Sức khỏe hệ thống" value={healthText} />

          <TouchableOpacity style={styles.primaryBtn} onPress={checkSystemHealth} disabled={checking}>
            {checking ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Kiểm tra kết nối server</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tiện ích</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation?.navigate('AdminDriverApproval')}>
            <Text style={styles.secondaryBtnText}>Đi đến duyệt hồ sơ tài xế</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation?.navigate('ManageUsers')}>
            <Text style={styles.secondaryBtnText}>Đi đến quản lý người dùng</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerBtn} onPress={clearLocalAdminCache}>
            <Text style={styles.dangerBtnText}>Xóa cache cài đặt cục bộ</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
};

const SettingRow = ({ label, desc, value, onValueChange }) => (
  <View style={styles.settingRow}>
    <View style={{ flex: 1, paddingRight: 10 }}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingDesc}>{desc}</Text>
    </View>
    <Switch value={value} onValueChange={onValueChange} thumbColor="#fff" trackColor={{ false: '#CBD5E1', true: '#A78BFA' }} />
  </View>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || 'Không có'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FA' },
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
  section: { paddingHorizontal: 12, marginTop: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  settingDesc: { marginTop: 2, fontSize: 12, color: '#64748B' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: { fontSize: 13, color: '#475569' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
  primaryBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: COLORS.adminColor,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: { color: '#111827', fontSize: 13, fontWeight: '700' },
  dangerBtn: {
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  dangerBtnText: { color: '#991B1B', fontSize: 13, fontWeight: '700' },
});

export default SettingsScreen;
