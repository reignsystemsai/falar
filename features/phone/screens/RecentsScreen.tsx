import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { RecentCall } from '../phoneTypes';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

interface RecentsScreenProps {
  recents: RecentCall[];
  onRedial: (number: string) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function RecentsScreen({ recents, onRedial }: RecentsScreenProps) {
  if (recents.length === 0) {
    return (
      <EmptyState
        title="No recents yet"
        message="No recents yet"
      />
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={recents}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => onRedial(item.number)}>
          <View>
            <Text style={styles.number}>{item.number}</Text>
            <Text style={styles.meta}>
              {item.result} • {formatDuration(item.durationSeconds)}
            </Text>
          </View>
          <Text style={styles.time}>{new Date(item.startedAt).toLocaleTimeString()}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  number: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  meta: {
    color: colors.secondary,
    marginTop: 3,
  },
  time: {
    color: colors.muted,
    fontSize: 12,
  },
});
