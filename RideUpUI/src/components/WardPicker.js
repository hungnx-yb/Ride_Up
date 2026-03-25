import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { fetchWards } from '../services/locationService';

const THEME_COLOR = '#E65100';

/**
 * Modal chọn xã / phường theo tỉnh đã chọn.
 *
 * Props:
 *   visible      {boolean}
 *   onClose      {() => void}
 *   onConfirm    {(wardNames: string[]) => void}
 *   title        {string}
 *   provinceId   {string | number}
 *   selectedNames {string[]}
 */
const WardPicker = ({
  visible,
  onClose,
  onConfirm,
  onConfirmRaw,
  title = 'Chọn xã / phường',
  provinceId,
  selectedNames = [],
  singleSelect = false,
}) => {
  const [query, setQuery] = useState('');
  const [allWards, setAllWards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [localSelected, setLocalSelected] = useState([]);

  useEffect(() => {
    if (!visible) return;
    setLocalSelected(Array.isArray(selectedNames) ? selectedNames : []);
  }, [visible, selectedNames]);

  useEffect(() => {
    if (!visible || !provinceId) return;
    setLoading(true);
    fetchWards(provinceId)
      .then((data) => setAllWards(Array.isArray(data) ? data : []))
      .catch(() => setAllWards([]))
      .finally(() => setLoading(false));
  }, [visible, provinceId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allWards.filter((w) => {
      if (!q) return true;
      return (w.name || '').toLowerCase().includes(q);
    });
  }, [allWards, query]);

  const toggleSelect = (wardName) => {
    setLocalSelected((prev) => {
      if (singleSelect) {
        return prev.includes(wardName) ? [] : [wardName];
      }
      return prev.includes(wardName)
        ? prev.filter((n) => n !== wardName)
        : [...prev, wardName];
    });
  };

  const handleConfirm = () => {
    if (onConfirmRaw) {
      const selected = allWards.filter((w) => localSelected.includes(w.name));
      onConfirmRaw(selected);
    }
    onConfirm(localSelected);
    setQuery('');
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
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.doneBtn} onPress={handleConfirm} disabled={!provinceId}>
                <Text style={styles.doneText}>Xong ({localSelected.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!provinceId ? (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>Vui lòng chọn tỉnh / thành trước</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm xã / phường..."
                  value={query}
                  onChangeText={setQuery}
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                />
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={THEME_COLOR} size="large" />
                  <Text style={styles.loadingText}>Đang tải danh sách xã/phường...</Text>
                </View>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item) => `${item.id ?? item.code ?? item.name}`}
                  keyboardShouldPersistTaps="handled"
                  style={styles.list}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.item} onPress={() => toggleSelect(item.name)}>
                      <Text style={styles.itemIcon}>🏘️</Text>
                      <Text style={styles.itemText}>{item.name}</Text>
                      <Text style={[styles.checkIcon, localSelected.includes(item.name) ? styles.checkOn : styles.checkOff]}>
                        {localSelected.includes(item.name) ? '✓' : '○'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.sep} />}
                  ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy xã/phường phù hợp</Text>}
                />
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default WardPicker;

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
  title: { fontSize: 16, fontWeight: '800', color: THEME_COLOR },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneBtn: { backgroundColor: '#FFF3E0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  doneText: { color: THEME_COLOR, fontSize: 12, fontWeight: '800' },
  closeBtn: { fontSize: 18, color: '#999', padding: 4 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#333' },

  list: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  itemIcon: { fontSize: 16, marginRight: 10 },
  itemText: { fontSize: 15, color: '#222', flex: 1 },
  checkIcon: { fontSize: 16, fontWeight: '900' },
  checkOn: { color: '#2E7D32' },
  checkOff: { color: '#BDBDBD' },
  sep: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 46 },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  empty: { textAlign: 'center', color: '#888', padding: 30 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#aaa', marginTop: 8 },
});
