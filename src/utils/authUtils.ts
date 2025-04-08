import { User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getDocument, createDocumentWithId } from '@/lib/firestore';
import type { User } from '@/models/User';

// Collection name
const USERS_COLLECTION = 'users';

/**
 * Create a Firestore user profile from Firebase Auth user
 */
export async function createUserProfile(firebaseUser: FirebaseUser): Promise<void> {
  try {
    // Check if a profile already exists
    const existingUser = await getDocument<User>(USERS_COLLECTION, firebaseUser.uid);
    
    if (existingUser) {
      console.log('User profile already exists in Firestore');
      return;
    }
    
    // Create a new user profile in Firestore
    const now = new Date();
    const userData: User = {
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      email: firebaseUser.email || '',
      role: 'user',
      createdAt: now,
      updatedAt: now
    };
    
    // Use the Firebase Auth UID as the document ID
    await createDocumentWithId<User>(USERS_COLLECTION, firebaseUser.uid, userData);
    console.log('User profile created in Firestore');
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

/**
 * Get current Firebase Auth user
 */
export async function getCurrentFirebaseUser(): Promise<FirebaseUser | null> {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Convert Firebase user to NextAuth user format
 */
export function convertFirebaseUserToNextAuth(firebaseUser: FirebaseUser) {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    email: firebaseUser.email || '',
    image: firebaseUser.photoURL || null,
  };
} 