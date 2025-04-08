import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { updateDocument, getDocuments } from '@/lib/firestore';
import type { User } from '@/models/User';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    // Find the user by email using Firestore
    const users = await getDocuments<User>('users', {
      fieldPath: 'email',
      operator: '==',
      value: session.user.email
    });
    
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = users[0].id;
    
    // Update user with onboarding answers using Firestore
    await updateDocument<User>('users', userId, { 
      onboarding: {
        completed: true,
        answers: data
      },
      updatedAt: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding answers' },
      { status: 500 }
    );
  }
} 