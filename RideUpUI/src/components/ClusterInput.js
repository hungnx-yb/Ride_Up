import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { searchCommunes } from '../services/locationService';

const THEME_COLOR = '#E65100';

/**
 * Input thêm khu vực (cluster) với autocomplete từ backend DB.
 *
 * Props:
 *   provinceId  {string}   - id tỉnh/TP (từ DB) để thu hẹp tìm kiếm
 *   clusters    {string[]} - mảng các khu vực đã chọn
 *   onChange    {(clusters: string[]) => void}
 *   placeholder {string}
 */
const ClusterInput = ({
  provinceId = '',
  clusters = [],
  onChange,
  placeholder = 'Tìm xã, phường, thị trấn...',
  requireDbSelection = true,
  chipBg   = '#FFF3E0',
  chipText = '#E65100',
}) => {
  const [query, setQuery]         = useState('');
  const [suggestions, setSugg]    = useState([]);
  const [loading, setLoading]     = useState(false);
  const debounceTimer             = useRef(null);

  useEffect(() => {
    if (!provinceId) {
      setQuery('');
      setSugg([]);
      return;
    }

    let active = true;
    const loadInitial = async () => {
      setLoading(true);
      try {
        const results = await searchCommunes('', provinceId);
        if (!active) return;
        const names = results.map((r) => r.name);
        setSugg(names.filter((n) => !clusters.includes(n)).slice(0, 20));
      } catch {
        if (active) setSugg([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInitial();
    return () => { active = false; };
  }, [provinceId, clusters]);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    if (!provinceId) { setSugg([]); return; }
    if (!query || query.trim().length < 2) return;

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchCommunes(query.trim(), provinceId);
        const names = results.map((r) => r.name);
        setSugg(names.filter((n) => !clusters.includes(n)));
      } catch {
        setSugg([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceTimer.current);
  }, [query, provinceId]);

  const addCluster = (name) => {
    const trimmed = name.trim();
    if (trimmed && !clusters.includes(trimmed)) {
      onChange([...clusters, trimmed]);
    }
    setQuery('');
    setSugg([]);
  };

  const removeCluster = (name) => {
    onChange(clusters.filter((c) => c !== name));
  };

  const handleSubmit = () => {
    if (query.trim()) addCluster(query);
  };

  return (
    <View>
      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={provinceId ? placeholder : 'Vui lòng chọn tỉnh/thành trước'}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          editable={Boolean(provinceId)}
          placeholderTextColor="#aaa"
        />
        {loading
          ? <ActivityIndicator size="small" color={THEME_COLOR} style={styles.inputAddon} />
          : !requireDbSelection && query.trim().length > 0
            ? (
              <TouchableOpacity style={styles.addManualBtn} onPress={handleSubmit}>
                <Text style={styles.addManualText}>+ Thêm</Text>
              </TouchableOpacity>
            )
            : null
        }
      </View>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, i) => `${item}-${i}`}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggItem} onPress={() => addCluster(item)}>
                <Text style={styles.suggIcon}>📌</Text>
                <Text style={styles.suggText}>{item}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.suggSep} />}
          />
        </View>
      )}

      {/* Chips */}
      {clusters.length > 0 && (
        <View style={styles.chipsRow}>
          {clusters.map((c) => (
            <View key={c} style={[styles.chip, { backgroundColor: chipBg }]}>
              <Text style={[styles.chipText, { color: chipText }]}>{c}</Text>
              <TouchableOpacity onPress={() => removeCluster(c)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[styles.chipRemove, { color: chipText }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {clusters.length === 0 && (
        <Text style={styles.hint}>
          {requireDbSelection
            ? 'Chọn xã/phường/thị trấn từ danh sách gợi ý theo tỉnh đã chọn'
            : 'Nhập tên xã/phường/thị trấn rồi nhấn kết quả hoặc "Thêm"'}
        </Text>
      )}
    </View>
  );
};

export default ClusterInput;

const styles = StyleSheet.create({
  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  inputAddon: { marginRight: 12 },
  addManualBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME_COLOR,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
  },
  addManualText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Dropdown
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    zIndex: 99,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  suggItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggIcon: { fontSize: 14, marginRight: 8 },
  suggText: { fontSize: 14, color: '#333' },
  suggSep:  { height: 1, backgroundColor: '#F5F5F5' },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  chipText:   { fontSize: 13, fontWeight: '600' },
  chipRemove: { fontSize: 11, fontWeight: '800' },

  // Hint
  hint: { fontSize: 11, color: '#bbb', marginTop: 6 },
});
