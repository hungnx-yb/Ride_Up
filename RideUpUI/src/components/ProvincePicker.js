import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { fetchProvinces, fetchProvincesFromDb, filterProvinces } from '../services/locationService';

const THEME_COLOR = '#00B14F';

/**
 * Modal chọn tỉnh / thành phố — data từ Overpass API (có tọa độ).
 *
 * Props:
 *   visible   {boolean}
 *   onClose   {() => void}
 *   onSelect  {(province: {name, lat, lng}) => void}
 *   title     {string}
 */
const ProvincePicker = ({
  visible,
  onClose,
  onSelect,
  title = 'Chọn tỉnh / thành phố',
  requireDb = false,
}) => {
  const [query, setQuery]         = useState('');
  const [allProvinces, setAll]    = useState([]);
  const [loading, setLoading]     = useState(false);

  // Fetch từ API khi modal mở lần đầu (hoặc khi danh sách trống)
  useEffect(() => {
    if (!visible) return;
    if (allProvinces.length > 0) return; // đã có data, dùng lại
    setLoading(true);
    const load = requireDb ? fetchProvincesFromDb : fetchProvinces;
    load()
      .then(setAll)
      .finally(() => setLoading(false));
  }, [visible, requireDb]);

  const results = useMemo(
    () => filterProvinces(allProvinces, query),
    [allProvinces, query],
  );

  const handleSelect = (province) => {
    setQuery('');
    onSelect(province);
    onClose();
  };

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tỉnh / thành phố..."
              value={query}
              onChangeText={setQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={THEME_COLOR} size="large" />
              <Text style={styles.loadingText}>Đang tải danh sách tỉnh thành...</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.name}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                  <Text style={styles.itemIcon}>📍</Text>
                  <Text style={styles.itemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {requireDb
                    ? 'Không có dữ liệu tỉnh/thành trong DB. Vui lòng đồng bộ dữ liệu địa lý.'
                    : 'Không tìm thấy kết quả'}
                </Text>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ProvincePicker;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    height: '72%',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title:    { fontSize: 16, fontWeight: '800', color: THEME_COLOR },
  closeBtn: { fontSize: 18, color: '#999', padding: 4 },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#333' },

  // List
  list: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  itemIcon: { fontSize: 16, marginRight: 10 },
  itemText: { fontSize: 15, color: '#222' },
  sep:      { height: 1, backgroundColor: '#F5F5F5', marginLeft: 46 },
  empty:    { textAlign: 'center', color: '#aaa', padding: 30 },

  // Loading
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#aaa', marginTop: 8 },
});
