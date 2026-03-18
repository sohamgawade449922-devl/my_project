/**
 * DashboardScreen – main home screen showing tasks, focus status,
 * and recent notifications.
 */
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import {tasksAPI, focusAPI, classroomAPI} from '../services/api';
import {SystemBridge} from '../services/NativeSystemBridge';

const LOCKED_APPS = ['com.instagram.android', 'com.tiktok.android', 'com.snapchat.android'];

interface Task {
  id: number;
  title: string;
  course_name?: string;
  deadline?: string;
  priority: string;
  priority_score: number;
  is_completed: boolean;
}

interface FocusSession {
  id: number;
  start_time: string;
  bypass_count: number;
  lock_difficulty: number;
  completed: boolean;
}

export default function DashboardScreen() {
  const USER_ID = 1; // TODO: pull from auth store

  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTasks();
    SystemBridge.setCurrentUser(USER_ID).catch(() => {});
  }, []);

  const loadTasks = async () => {
    try {
      const res = await tasksAPI.list(USER_ID);
      setTasks(res.data);
    } catch (e) {
      console.error('Failed to load tasks', e);
    }
  };

  const syncClassroom = async () => {
    setLoading(true);
    try {
      await classroomAPI.sync(USER_ID);
      await loadTasks();
      Alert.alert('Synced!', 'Classroom assignments imported.');
    } catch (e) {
      Alert.alert('Sync Failed', 'Could not reach Google Classroom.');
    } finally {
      setLoading(false);
    }
  };

  const startFocus = async () => {
    try {
      const res = await focusAPI.start(USER_ID, new Date().toISOString());
      setFocusSession(res.data);
      const difficulty = res.data.lock_difficulty;
      await SystemBridge.enableFocusMode(difficulty);
      // Lock distracting apps
      for (const pkg of LOCKED_APPS) {
        await SystemBridge.lockApp(pkg, difficulty);
      }
      Alert.alert('Focus Mode ON 🔒', `Lock difficulty: ${difficulty}`);
    } catch (e) {
      Alert.alert('Error', 'Could not start focus session.');
    }
  };

  const stopFocus = async () => {
    if (!focusSession) return;
    try {
      await focusAPI.stop(focusSession.id);
      await SystemBridge.disableFocusMode();
      setFocusSession(null);
      Alert.alert('Session Complete ✅', 'Great work!');
    } catch (e) {
      Alert.alert('Error', 'Could not stop session.');
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'critical': return '#E53935';
      case 'high': return '#FB8C00';
      case 'medium': return '#FDD835';
      default: return '#43A047';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>🧠 NeuralCommander</Text>

      {/* Focus Toggle */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Focus Mode</Text>
        {focusSession ? (
          <>
            <Text style={styles.stat}>Bypasses: {focusSession.bypass_count}</Text>
            <Text style={styles.stat}>Lock Level: {focusSession.lock_difficulty} / 5</Text>
            <TouchableOpacity style={[styles.btn, styles.btnRed]} onPress={stopFocus}>
              <Text style={styles.btnText}>End Session</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={startFocus}>
            <Text style={styles.btnText}>Start Focus 🎯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tasks */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Upcoming Tasks</Text>
          <TouchableOpacity onPress={syncClassroom}>
            <Text style={styles.syncBtn}>{loading ? 'Syncing…' : '↻ Sync'}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={tasks.slice(0, 5)}
          keyExtractor={item => String(item.id)}
          scrollEnabled={false}
          renderItem={({item}) => (
            <View style={styles.taskItem}>
              <View
                style={[styles.priorityDot, {backgroundColor: priorityColor(item.priority)}]}
              />
              <View style={{flex: 1}}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskSub}>
                  {item.course_name} · Score: {item.priority_score.toFixed(1)}
                </Text>
              </View>
            </View>
          )}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0D0D0D', padding: 16},
  header: {color: '#00E5FF', fontSize: 28, fontWeight: 'bold', marginBottom: 20},
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 12},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  btn: {borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8},
  btnGreen: {backgroundColor: '#00C853'},
  btnRed: {backgroundColor: '#E53935'},
  btnText: {color: '#FFF', fontWeight: 'bold', fontSize: 16},
  syncBtn: {color: '#00E5FF', fontSize: 14},
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4A',
  },
  priorityDot: {width: 10, height: 10, borderRadius: 5, marginRight: 10},
  taskTitle: {color: '#FFFFFF', fontSize: 15},
  taskSub: {color: '#AAAAAA', fontSize: 12, marginTop: 2},
  stat: {color: '#CCCCCC', marginBottom: 4},
});
