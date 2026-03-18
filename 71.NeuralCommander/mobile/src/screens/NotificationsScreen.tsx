/**
 * NotificationsScreen – shows AI-classified intercepted notifications.
 */
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {notificationsAPI} from '../services/api';

interface Notification {
  id: number;
  package_name: string;
  title?: string;
  body?: string;
  category: 'Urgent' | 'Academic' | 'Ignore';
  ai_reply?: string;
  was_suppressed: boolean;
  received_at: string;
}

const categoryColor = (cat: string) => {
  switch (cat) {
    case 'Urgent': return '#E53935';
    case 'Academic': return '#1E88E5';
    default: return '#757575';
  }
};

export default function NotificationsScreen() {
  const USER_ID = 1;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await notificationsAPI.list(USER_ID);
      setNotifications(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📬 Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <View
                style={[
                  styles.categoryBadge,
                  {backgroundColor: categoryColor(item.category)},
                ]}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
              {item.was_suppressed && (
                <Text style={styles.suppressed}>🔕 Suppressed</Text>
              )}
            </View>
            <Text style={styles.pkg}>{item.package_name}</Text>
            {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
            {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
            {item.ai_reply ? (
              <View style={styles.replyBox}>
                <Text style={styles.replyLabel}>🤖 AI Auto-Reply:</Text>
                <Text style={styles.replyText}>{item.ai_reply}</Text>
              </View>
            ) : null}
            <Text style={styles.time}>
              {new Date(item.received_at).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0D0D0D', padding: 16},
  header: {color: '#00E5FF', fontSize: 24, fontWeight: 'bold', marginBottom: 16},
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  row: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6},
  categoryBadge: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  categoryText: {color: '#FFF', fontSize: 12, fontWeight: 'bold'},
  suppressed: {color: '#FF8A65', fontSize: 12},
  pkg: {color: '#888', fontSize: 11, marginBottom: 4},
  title: {color: '#FFF', fontWeight: '600', fontSize: 15, marginBottom: 2},
  body: {color: '#BBB', fontSize: 13},
  replyBox: {
    backgroundColor: '#0A2540',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  replyLabel: {color: '#00E5FF', fontSize: 12, marginBottom: 4},
  replyText: {color: '#E0E0E0', fontSize: 13},
  time: {color: '#555', fontSize: 11, marginTop: 6, textAlign: 'right'},
});
