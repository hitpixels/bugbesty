import { NextResponse } from 'next/server';
import { getDocuments } from '@/lib/firestore';
import { Subdomain } from '@/models/Subdomain';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id: projectId } = params;
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    const subdomains = await getDocuments<Subdomain>('subdomains', {
      fieldPath: 'projectId',
      operator: '==',
      value: projectId
    });
    
    return NextResponse.json(subdomains);
  } catch (error: any) {
    console.error('Error fetching subdomains:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subdomains', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 