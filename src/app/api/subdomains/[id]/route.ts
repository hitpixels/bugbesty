import { NextResponse } from 'next/server';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getDocument, getDocuments, deleteDocument } from '@/lib/firestore';
import { Subdomain } from '@/models/Subdomain';
import { Vulnerability } from '@/models/Vulnerability';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: subdomainId } = params;
    
    if (!subdomainId) {
      return NextResponse.json(
        { error: 'Subdomain ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Fetching subdomain with ID: ${subdomainId}`);
    
    // Try to get by id field
    const subdomainQuery = query(
      collection(db, "subdomains"),
      where("id", "==", subdomainId)
    );
    const subdomainSnapshot = await getDocs(subdomainQuery);
    
    if (!subdomainSnapshot.empty) {
      const subdomain = subdomainSnapshot.docs[0].data();
      console.log(`Found subdomain by id field: ${subdomainId}`);
      return NextResponse.json(subdomain);
    }
    
    // Try getting by document ID
    try {
      const directDocRef = doc(db, "subdomains", subdomainId);
      const directDocSnap = await getDoc(directDocRef);
      
      if (directDocSnap.exists()) {
        const subdomain = directDocSnap.data();
        console.log(`Found subdomain by direct document ID: ${subdomainId}`);
        return NextResponse.json(subdomain);
      }
    } catch (directError) {
      console.error(`Error checking direct document: ${directError}`);
    }
    
    console.error(`Subdomain with ID ${subdomainId} not found`);
    return NextResponse.json(
      { error: 'Subdomain not found' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error fetching subdomain:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subdomain', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: subdomainId } = params;
    
    if (!subdomainId) {
      return NextResponse.json(
        { error: 'Subdomain ID is required' },
        { status: 400 }
      );
    }
    
    // Delete all vulnerabilities associated with this subdomain
    const vulnerabilities = await getDocuments<Vulnerability>('vulnerabilities', {
      fieldPath: 'subdomainId',
      operator: '==',
      value: subdomainId
    });
    
    // Delete each vulnerability
    for (const vulnerability of vulnerabilities) {
      await deleteDocument('vulnerabilities', vulnerability.id);
    }
    
    // Delete the subdomain
    const subdomain = await getDocument<Subdomain>('subdomains', subdomainId);
    
    if (!subdomain) {
      return NextResponse.json(
        { error: 'Subdomain not found' },
        { status: 404 }
      );
    }
    
    await deleteDocument('subdomains', subdomainId);
    
    return NextResponse.json({ message: 'Subdomain deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting subdomain:', error);
    return NextResponse.json(
      { error: 'Failed to delete subdomain', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 