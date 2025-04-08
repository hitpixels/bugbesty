import { NextResponse } from 'next/server';
import { getDocuments } from '@/lib/firestore';
import { Subdomain } from '@/models/Subdomain';
import { Vulnerability } from '@/models/Vulnerability';
import { IVulnerability } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Fix: Properly retrieve and await params
    const { id: projectId } = params;
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    // Get all subdomains for the project
    const subdomains = await getDocuments<Subdomain>('subdomains', {
      fieldPath: 'projectId',
      operator: '==',
      value: projectId
    });
    
    const subdomainIds = subdomains.map(s => s.id);
    
    // Get all vulnerabilities for each subdomain
    let allVulnerabilities: (Vulnerability & { id: string })[] = [];
    
    // Since Firestore doesn't support $in queries directly,
    // we need to fetch vulnerabilities for each subdomain separately
    for (const subdomainId of subdomainIds) {
      const subdomainVulnerabilities = await getDocuments<Vulnerability>('vulnerabilities', {
        fieldPath: 'subdomainId',
        operator: '==',
        value: subdomainId
      });
      
      allVulnerabilities = [...allVulnerabilities, ...subdomainVulnerabilities];
    }

    // Group vulnerabilities by subdomain
    const vulnerabilitiesBySubdomain = allVulnerabilities.reduce<Record<string, (Vulnerability & { id: string })[]>>((acc, vuln) => {
      const subdomainId = vuln.subdomainId;
      if (!acc[subdomainId]) {
        acc[subdomainId] = [];
      }
      acc[subdomainId].push(vuln);
      return acc;
    }, {});

    // Count pending subdomains (where all vulnerabilities are "Not Yet Done")
    let pendingCount = 0;
    let foundCount = 0;
    let notFoundCount = 0;

    Object.values(vulnerabilitiesBySubdomain).forEach((subdomainVulns) => {
      const allNotYetDone = subdomainVulns.every(v => v.status === 'Not Yet Done');
      if (allNotYetDone) {
        pendingCount++;
      }
      
      // Count vulnerabilities
      const foundVulns = subdomainVulns.filter(v => v.status === 'Found').length;
      const notFoundVulns = subdomainVulns.filter(v => v.status === 'Not Found').length;
      foundCount += foundVulns;
      notFoundCount += notFoundVulns;
    });

    const stats = {
      subdomainCount: subdomains.length,
      completedCount: subdomains.filter(s => s.status === 'completed').length,
      vulnerabilityStats: {
        found: foundCount,
        notFound: notFoundCount,
        notDone: pendingCount
      }
    };
    
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project stats', details: error.message || 'Unknown error' }, 
      { status: 500 }
    );
  }
} 