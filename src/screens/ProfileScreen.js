import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Profil Pengguna</Text>
      <Text>{auth.currentUser?.email}</Text>
      <TouchableOpacity 
        onPress={() => signOut(auth)}
        style={{ marginTop: 20, padding: 10, backgroundColor: 'red', borderRadius: 5 }}
      >
        <Text style={{ color: 'white' }}>Log Keluar</Text>
      </TouchableOpacity>
    </View>
  );
}