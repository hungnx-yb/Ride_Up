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
import { COLORS } from '../../config/config';
import { getAllUsers } from '../../services/api';

const ROLE_TEXT = {
  ADMIN: 'Quản trị viên',
  DRIVER: 'Tài xế',
  CUSTOMER: 'Khách hàng',
};

const ManageUsersScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const summary = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter((u) => Array.isArray(u?.roles) && u.roles.includes('ADMIN')).length;
    const driverCount = users.filter((u) => Array.isArray(u?.roles) && u.roles.includes('DRIVER')).length;
    const customerCount = users.filter((u) => Array.isArray(u?.roles) && u.roles.includes('CUSTOMER')).length;
    return { total, adminCount, driverCount, customerCount };
  }, [users]);

  const roleLabel = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) return 'Không có';
    return roles.map((role) => ROLE_TEXT[role] || role).join(', ');
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
        <Text style={styles.title}>Quản lý người dùng</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.summaryCard}>
        <SummaryItem label="Tổng" value={summary.total} />
        <SummaryItem label="Admin" value={summary.adminCount} />
        <SummaryItem label="Tài xế" value={summary.driverCount} />
        <SummaryItem label="Khách" value={summary.customerCount} />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item, index) => item?.id || String(index)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>Không có người dùng</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item?.fullName || 'Không có'}</Text>
            <Text style={styles.meta}>📧 {item?.email || 'Không có'}</Text>
            <Text style={styles.meta}>📱 {item?.phoneNumber || 'Không có'}</Text>
            <Text style={styles.meta}>🛡️ Vai trò: {roleLabel(item?.roles)}</Text>
            <Text style={styles.meta}>✅ Xác minh: {item?.verified === true ? 'Đã xác minh' : 'Chưa xác minh'}</Text>
          </View>
        )}
      />
    </View>
  );
};

const SummaryItem = ({ label, value }) => (
  <View style={styles.summaryItem}>
    <Text style={styles.summaryValue}>{typeof value === 'number' ? value : 0}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
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
  summaryCard: {
    margin: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryLabel: { fontSize: 12, color: '#6B7280' },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 6 },
  meta: { fontSize: 13, color: '#4B5563', marginBottom: 3 },
  empty: { textAlign: 'center', color: '#6B7280', paddingTop: 40 },
});

export default ManageUsersScreen;
