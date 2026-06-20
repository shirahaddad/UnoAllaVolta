import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createTask } from '@/services/todoist';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  todoistToken: string | null;
}

export function AddTaskModal({ visible, onClose, onCreated, todoistToken }: Props) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAdd() {
    if (!text.trim() || !todoistToken || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createTask(text.trim(), todoistToken);
      setText('');
      onCreated();
    } catch (e) {
      console.error('[AddTaskModal] createTask failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setText('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <TextInput
            style={styles.input}
            placeholder="Task title..."
            placeholderTextColor="#4A4A4A"
            value={text}
            onChangeText={setText}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, (!text.trim() || isSubmitting) && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={!text.trim() || isSubmitting}
            >
              <Text style={styles.addText}>{isSubmitting ? 'Adding…' : 'Add Task'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 382,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 24,
    gap: 16,
  },
  input: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#F0EFEB',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8A8A8A',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  addBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4A9BAF',
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F0F',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
});
