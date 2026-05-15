import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useDeckStore } from '@/store/deckStore';
import { useSettingsStore } from '@/store/settingsStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { todoistToken, setTodoistToken } = useAuthStore();
  const { projects } = useDeckStore();
  const { excludedProjectIds, toggleProject } = useSettingsStore();
  const [draft, setDraft] = useState('');

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await setTodoistToken(trimmed);
    setDraft('');
  };

  const handleDisconnect = async () => {
    await setTodoistToken(null);
  };

  const maskedToken = todoistToken
    ? todoistToken.slice(0, 6) + '••••••••••••••••' + todoistToken.slice(-4)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#F0EFEB" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TODOIST</Text>

            {todoistToken ? (
              <View style={styles.box}>
                <View style={styles.connectedRow}>
                  <View style={styles.dot} />
                  <Text style={styles.connectedText}>Connected</Text>
                </View>
                <Text style={styles.maskedToken}>{maskedToken}</Text>
                <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.box}>
                <Text style={styles.inputLabel}>API Token</Text>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Paste your token here"
                  placeholderTextColor="#3A3A3A"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.hint}>
                  Todoist → Settings → Integrations → Developer → API token
                </Text>
                <TouchableOpacity
                  style={[styles.saveButton, !draft.trim() && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={!draft.trim()}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {todoistToken && projects.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PROJECTS</Text>
              <View style={styles.box}>
                {projects.map((project, index) => {
                  const included = !excludedProjectIds.includes(project.id);
                  return (
                    <View
                      key={project.id}
                      style={[
                        styles.projectRow,
                        index < projects.length - 1 && styles.projectRowBorder,
                      ]}
                    >
                      <Text style={styles.projectName}>{project.name}</Text>
                      <Switch
                        value={included}
                        onValueChange={() => toggleProject(project.id)}
                        trackColor={{ false: '#2A2A2A', true: '#4A9BAF' }}
                        thumbColor="#F0EFEB"
                      />
                    </View>
                  );
                })}
              </View>
              <Text style={styles.hint}>
                Only tasks from selected projects appear in your deck.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F0EFEB',
  },
  scrollContent: {
    paddingBottom: 40,
    gap: 32,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8A8A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  box: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 20,
    gap: 12,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A9BAF',
  },
  connectedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F0EFEB',
  },
  maskedToken: {
    fontSize: 13,
    color: '#8A8A8A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  disconnectButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  disconnectText: {
    fontSize: 14,
    color: '#8A8A8A',
  },
  inputLabel: {
    fontSize: 13,
    color: '#8A8A8A',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F0EFEB',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hint: {
    fontSize: 12,
    color: '#8A8A8A',
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: '#4A9BAF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F0F',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  projectRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  projectName: {
    fontSize: 15,
    color: '#F0EFEB',
    flex: 1,
  },
});
