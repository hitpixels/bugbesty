import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { createUserProfile } from '@/utils/authUtils';

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { name, email, password } = body;

    console.log('Processing signup request for:', email);

    // Validate input
    if (!name || !email || !password) {
      console.log('Missing required fields');
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update the user profile with the name
      await updateProfile(user, {
        displayName: name.trim()
      });
      
      // Create a user profile in Firestore
      await createUserProfile(user);

      console.log('User created successfully with ID:', user.uid);

      return NextResponse.json({
        success: true,
        user: {
          id: user.uid,
          name: user.displayName || name.trim(),
          email: user.email,
        }
      });

    } catch (firebaseError: any) {
      console.error('Firebase operation failed:', firebaseError);
      
      // Handle Firebase auth errors
      if (firebaseError.code === 'auth/email-already-in-use') {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        );
      }

      throw firebaseError;
    }

  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Get error message
    const errorMessage = error?.message || 'Unknown error';

    return NextResponse.json(
      { 
        error: 'Failed to create account',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
