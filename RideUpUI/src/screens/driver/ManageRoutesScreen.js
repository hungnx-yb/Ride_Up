import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../../config/config';
import { getDriverRoutes, createRoute, deleteRoute } from '../../services/api';
import ProvincePicker from '../../components/ProvincePicker';
import WardPicker from '../../components/WardPicker';

const THEME = {
  gradientStart: '#E65100',
  accent:        '#FF6F00',
  cardBorder:    '#FFF3E0',
};

// ─── Route Card ─────────────────────────────────────────────
const RouteCard = ({ route, onDelete }) => {
  const isActive = route.status === 'active';
  return (
    <View style={styles.routeCard}>
      {/* Header */}
      <View style={styles.routeCardHeader}>
        <View style={styles.routeTitleRow}>
          <Text style={styles.routeFrom}>{route.pickupProvince}</Text>
          <Text style={styles.routeArrow}> → </Text>
          <Text style={styles.routeTo}>{route.dropoffProvince}</Text>
        </View>
        <View style={[styles.statusBadge, isActive ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.statusText, { color: isActive ? '#2E7D32' : '#757575' }]}>
            {isActive ? 'Hoạt động' : 'Tạm dừng'}
          </Text>
        </View>
      </View>

      {/* Fare */}
      <Text style={styles.routeFare}>
        {route.fixedFare.toLocaleString('vi-VN')} đ / người
      </Text>

      {/* Clusters */}
      <View style={styles.clusterSection}>
        <Text style={styles.clusterLabel}>Đón:</Text>
        <View style={styles.clusterRow}>
          {route.pickupClusters.map((c, i) => (
            <View key={i} style={[styles.chip, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.chipText, { color: THEME.gradientStart }]}>{c}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.clusterSection}>
        <Text style={styles.clusterLabel}>Trả:</Text>
        <View style={styles.clusterRow}>
          {route.dropoffClusters.map((c, i) => (
            <View key={i} style={[styles.chip, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.chipText, { color: '#2E7D32' }]}>{c}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(route.id)}
        >
          <Text style={styles.deleteBtnText}>🗑 Xóa tuyến</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Add Route Modal ─────────────────────────────────────────
const AddRouteModal = ({ visible, onClose, onSave }) => {
  const [pickupProvince, setPickupProvince]   = useState(null);  // {id, name, lat, lng}
  const [dropoffProvince, setDropoffProvince] = useState(null);  // {id, name, lat, lng}
  const [pickupClusters, setPickupClusters]   = useState([]);
  const [dropoffClusters, setDropoffClusters] = useState([]);
  const [fare, setFare]                       = useState('');
  const [saving, setSaving]                   = useState(false);

  // Tỉnh picker state (province là object {id, name, lat, lng})
  const [showPickup, setShowPickup]   = useState(false);
  const [showDropoff, setShowDropoff] = useState(false);
  const [showPickupWard, setShowPickupWard] = useState(false);
  const [showDropoffWard, setShowDropoffWard] = useState(false);

  const fareNum = parseInt((fare || '').replace(/\D/g, ''), 10);
  const hasValidFare = !isNaN(fareNum) && fareNum >= 1000;
  const canSubmit =
    !!pickupProvince &&
    !!dropoffProvince &&
    pickupClusters.length > 0 &&
    dropoffClusters.length > 0 &&
    hasValidFare;

  const missingFields = [
    !pickupProvince ? 'tỉnh đón' : null,
    pickupClusters.length === 0 ? 'xã/phường đón' : null,
    !dropoffProvince ? 'tỉnh trả' : null,
    dropoffClusters.length === 0 ? 'xã/phường trả' : null,
    !hasValidFare ? 'giá vé hợp lệ (>= 1000)' : null,
  ].filter(Boolean);

  const confirmPickupWards = (wardNames) => {
    setPickupClusters(Array.isArray(wardNames) ? wardNames : []);
  };

  const confirmDropoffWards = (wardNames) => {
    setDropoffClusters(Array.isArray(wardNames) ? wardNames : []);
  };

  const removeWard = (list, setList, name) => {
    setList(list.filter((w) => w !== name));
  };

  const reset = () => {
    setPickupProvince(null); setDropoffProvince(null);
    setPickupClusters([]); setDropoffClusters([]);
    setFare('');
  };

  const handleSave = async () => {
    console.log('[Route][UI] handleSave pressed');
    if (!pickupProvince || !dropoffProvince || !fare.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn tỉnh đón, tỉnh trả và nhập giá vé.');
      return;
    }
    if (pickupClusters.length === 0 || dropoffClusters.length === 0) {
      Alert.alert('Thiếu xã/phường', 'Vui lòng chọn ít nhất 1 xã/phường cho điểm đón và điểm trả.');
      return;
    }
    if (isNaN(fareNum) || fareNum < 1000) {
      Alert.alert('Giá không hợp lệ', 'Vui lòng nhập giá vé hợp lệ (ví dụ: 120000).');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        pickupProvinceId: pickupProvince.id,
        pickupProvince: pickupProvince.name,
        dropoffProvinceId: dropoffProvince.id,
        dropoffProvince: dropoffProvince.name,
        pickupClusters, dropoffClusters,
        fixedFare: fareNum,
        status: 'active',
      });
      reset();
      onClose();
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể tạo tuyến');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {/* Province pickers nested inside main modal so they stack correctly */}
      <ProvincePicker
        visible={showPickup}
        title="Chọn tỉnh / TP đón khách"
        requireDb
        onClose={() => setShowPickup(false)}
        onSelect={(p) => { setPickupProvince(p); setPickupClusters([]); }}
      />
      <ProvincePicker
        visible={showDropoff}
        title="Chọn tỉnh / TP trả khách"
        requireDb
        onClose={() => setShowDropoff(false)}
        onSelect={(p) => { setDropoffProvince(p); setDropoffClusters([]); }}
      />
      <WardPicker
        visible={showPickupWard}
        title="Chọn xã / phường đón khách"
        provinceId={pickupProvince?.id}
        selectedNames={pickupClusters}
        onClose={() => setShowPickupWard(false)}
        onConfirm={confirmPickupWards}
      />
      <WardPicker
        visible={showDropoffWard}
        title="Chọn xã / phường trả khách"
        provinceId={dropoffProvince?.id}
        selectedNames={dropoffClusters}
        onClose={() => setShowDropoffWard(false)}
        onConfirm={confirmDropoffWards}
      />

      <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>➕ Thêm tuyến mới</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ─ Pickup province ─ */}
              <Text style={styles.fieldLabel}>Tỉnh / TP đón khách *</Text>
              <TouchableOpacity
                style={[styles.provinceBtn, pickupProvince ? styles.provinceBtnSelected : null]}
                onPress={() => setShowPickup(true)}
              >
                <Text style={[styles.provinceBtnText, !pickupProvince && styles.provinceBtnPlaceholder]}>
                  {pickupProvince?.name || '📍 Chọn tỉnh / thành phố...'}
                </Text>
                <Text style={styles.provinceBtnChevron}>›</Text>
              </TouchableOpacity>

              {/* ─ Pickup clusters ─ */}
              <Text style={styles.fieldLabel}>Khu vực đón (xã / phường / thị trấn) *</Text>
              <TouchableOpacity
                style={[
                  styles.provinceBtn,
                  !pickupProvince && styles.selectDisabled,
                  pickupClusters.length > 0 ? styles.provinceBtnSelected : null,
                ]}
                disabled={!pickupProvince}
                onPress={() => setShowPickupWard(true)}
              >
                <Text style={[styles.provinceBtnText, (!pickupProvince || pickupClusters.length === 0) && styles.provinceBtnPlaceholder]}>
                  {!pickupProvince
                    ? 'Vui lòng chọn tỉnh đón trước'
                    : '🏘️ Chọn xã / phường đón...'}
                </Text>
                <Text style={styles.provinceBtnChevron}>›</Text>
              </TouchableOpacity>
              {pickupClusters.length > 0 && (
                <View style={styles.modalChipRow}>
                  {pickupClusters.map((name) => (
                    <View key={name} style={[styles.modalChip, { backgroundColor: '#FFF3E0' }]}>
                      <Text style={[styles.modalChipText, { color: '#E65100' }]}>{name}</Text>
                      <TouchableOpacity
                        onPress={() => removeWard(pickupClusters, setPickupClusters, name)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[styles.modalChipRemove, { color: '#E65100' }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* ─ Dropoff province ─ */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Tỉnh / TP trả khách *</Text>
              <TouchableOpacity
                style={[styles.provinceBtn, dropoffProvince ? styles.provinceBtnSelected : null]}
                onPress={() => setShowDropoff(true)}
              >
                <Text style={[styles.provinceBtnText, !dropoffProvince && styles.provinceBtnPlaceholder]}>
                  {dropoffProvince?.name || '📍 Chọn tỉnh / thành phố...'}
                </Text>
                <Text style={styles.provinceBtnChevron}>›</Text>
              </TouchableOpacity>

              {/* ─ Dropoff clusters ─ */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Khu vực trả (xã / phường / thị trấn) *</Text>
              <TouchableOpacity
                style={[
                  styles.provinceBtn,
                  !dropoffProvince && styles.selectDisabled,
                  dropoffClusters.length > 0 ? styles.provinceBtnSelected : null,
                ]}
                disabled={!dropoffProvince}
                onPress={() => setShowDropoffWard(true)}
              >
                <Text style={[styles.provinceBtnText, (!dropoffProvince || dropoffClusters.length === 0) && styles.provinceBtnPlaceholder]}>
                  {!dropoffProvince
                    ? 'Vui lòng chọn tỉnh trả trước'
                    : '🏘️ Chọn xã / phường trả...'}
                </Text>
                <Text style={styles.provinceBtnChevron}>›</Text>
              </TouchableOpacity>
              {dropoffClusters.length > 0 && (
                <View style={styles.modalChipRow}>
                  {dropoffClusters.map((name) => (
                    <View key={name} style={[styles.modalChip, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.modalChipText, { color: '#2E7D32' }]}>{name}</Text>
                      <TouchableOpacity
                        onPress={() => removeWard(dropoffClusters, setDropoffClusters, name)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[styles.modalChipRemove, { color: '#2E7D32' }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* ─ Fare ─ */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Giá vé cố định (đ) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ví dụ: 120000"
                keyboardType="numeric"
                value={fare}
                onChangeText={setFare}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving || !canSubmit}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Lưu tuyến đường</Text>
              }
            </TouchableOpacity>

            {!canSubmit && (
              <Text style={styles.formHint}>
                Cần bổ sung: {missingFields.join(', ')}
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
  );
};

// ─── Main Screen ─────────────────────────────────────────────
const ManageRoutesScreen = ({ navigation }) => {
  const [routes, setRoutes]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);

  const loadRoutes = useCallback(async () => {
    try {
      const data = await getDriverRoutes();
      setRoutes(data);
    } catch (e) {
      Alert.alert('Lỗi', 'Không tải được danh sách tuyến');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const handleDelete = (routeId) => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc muốn xóa tuyến này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoute(routeId);
              setRoutes(prev => prev.filter(r => r.id !== routeId));
            } catch (e) {
              Alert.alert('Lỗi', 'Không thể xóa tuyến');
            }
          },
        },
      ]
    );
  };

  const handleSaveRoute = async (routeData) => {
    console.log('[Route][UI] Submit route payload:', routeData);
    const saved = await createRoute(routeData);
    console.log('[Route][UI] Save success:', saved);
    setRoutes(prev => [saved, ...prev]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý tuyến đường</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ Thêm</Text>
        </TouchableOpacity>
      </View>

      {/* Count badge */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>{routes.length} tuyến đang quản lý</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRoutes(); }} tintColor={THEME.accent} />
        }
      >
        {routes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyText}>Bạn chưa có tuyến đường nào</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyAddBtnText}>➕ Thêm tuyến đầu tiên</Text>
            </TouchableOpacity>
          </View>
        ) : (
          routes.map(route => (
            <RouteCard key={route.id} route={route} onDelete={handleDelete} />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      {routes.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
          <Text style={styles.fabIcon}>＋</Text>
        </TouchableOpacity>
      )}

      <AddRouteModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveRoute}
      />
    </View>
  );
};

export default ManageRoutesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F5' },

  // Header
  header: {
    backgroundColor: THEME.gradientStart,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  backIcon:    { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '300' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  addBtn:      { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  addBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Count bar
  countBar: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 16 },
  countText: { color: THEME.gradientStart, fontSize: 13, fontWeight: '600' },

  // List
  list: { padding: 16 },

  // Route card
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  routeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  routeTitleRow:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  routeFrom:       { fontSize: 15, fontWeight: '800', color: THEME.gradientStart },
  routeArrow:      { fontSize: 14, color: '#999' },
  routeTo:         { fontSize: 15, fontWeight: '800', color: '#1565C0' },
  statusBadge:     { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  badgeActive:     { backgroundColor: '#E8F5E9' },
  badgeInactive:   { backgroundColor: '#F5F5F5' },
  statusText:      { fontSize: 11, fontWeight: '700' },

  routeFare: { fontSize: 16, fontWeight: '700', color: THEME.accent, marginBottom: 10 },

  clusterSection: { marginBottom: 6 },
  clusterLabel:   { fontSize: 11, color: '#999', fontWeight: '600', marginBottom: 4 },
  clusterRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:           { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipText:       { fontSize: 11, fontWeight: '600' },

  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FFF3E0' },
  deleteBtn:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  deleteBtnText: { color: '#C62828', fontSize: 13, fontWeight: '700' },

  // Empty
  emptyBox:       { alignItems: 'center', paddingTop: 60 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 15, color: '#999', marginBottom: 20 },
  emptyAddBtn:    { backgroundColor: THEME.gradientStart, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // FAB
  fab:     { position: 'absolute', bottom: 28, right: 22, backgroundColor: THEME.gradientStart, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: THEME.gradientStart, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 34 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle:   { fontSize: 17, fontWeight: '800', color: THEME.gradientStart },
  modalClose:   { fontSize: 18, color: '#999', padding: 4 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    backgroundColor: '#FAFAFA', color: '#333',
  },
  saveBtn:     { backgroundColor: THEME.gradientStart, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  formHint:    { marginTop: 8, color: '#D84315', fontSize: 12, fontWeight: '600' },

  // Province picker button
  provinceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FAFAFA',
  },
  provinceBtnSelected:     { borderColor: THEME.gradientStart, backgroundColor: '#FFF8F5' },
  selectDisabled:          { opacity: 0.6 },
  provinceBtnText:         { fontSize: 14, color: '#333', fontWeight: '600', flex: 1 },
  provinceBtnPlaceholder:  { color: '#aaa', fontWeight: '400' },
  provinceBtnChevron:      { fontSize: 20, color: '#999', marginLeft: 8 },

  modalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  modalChip: {
    borderRadius: 18,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalChipText: { fontSize: 12, fontWeight: '700' },
  modalChipRemove: { fontSize: 11, fontWeight: '800' },
});
