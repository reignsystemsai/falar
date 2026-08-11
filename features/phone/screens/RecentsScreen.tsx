import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { RecentCall } from '../phoneTypes';

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
        title="No recent calls"
        message="Recent Speak calls will appear here after you place your first call."
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
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f7f7f8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  number: {
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '700',
  },
  meta: {
    color: '#555',
    marginTop: 3,
  },
  time: {
    color: '#666',
    fontSize: 12,
  },
});
