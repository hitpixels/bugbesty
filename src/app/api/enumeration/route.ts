import { NextResponse } from 'next/server';
import { enumerationConfig } from '@/config/enumeration-config';
import { ProjectModel } from '@/models/Project';
import { SubdomainModel } from '@/models/Subdomain';
import { VulnerabilityModel } from '@/models/Vulnerability';
import { vulnerabilityTypes } from '@/constants/vulnerabilityTypes';
import { getServerSession } from 'next-auth';

async function fetchSubdomainsFromCertspotter(domain: string) {
  try {
    const response = await fetch(
      `https://api.certspotter.com/v1/issuances?domain=${domain}&include_subdomains=true&expand=dns_names`,
      {
        headers: {
          Authorization: `Bearer ${enumerationConfig.certspotter}`
        }
      }
    );
    const data = await response.json();
    const subdomains = new Set<string>();
    
    data.forEach((cert: any) => {
      cert.dns_names.forEach((name: string) => {
        if (name.endsWith(domain)) {
          subdomains.add(name);
        }
      });
    });
    
    return Array.from(subdomains);
  } catch (error) {
    console.error('Error fetching from Certspotter:', error);
    return [];
  }
}

async function fetchSubdomainsFromCensys(domain: string) {
  try {
    const response = await fetch(
      'https://search.censys.io/api/v2/hosts/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          query: `parsed.names: ${domain}`,
          per_page: 100
        })
      }
    );
    
    if (!response.ok) {
      console.warn(`Censys API returned non-OK status: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const subdomains = new Set<string>();
    
    if (data?.result?.hits && Array.isArray(data.result.hits)) {
      data.result.hits.forEach((hit: any) => {
        if (hit?.parsed?.names && Array.isArray(hit.parsed.names)) {
          hit.parsed.names.forEach((name: string) => {
            if (name && typeof name === 'string' && name.endsWith(domain)) {
              subdomains.add(name);
            }
          });
        }
      });
    } else {
      console.warn('Censys API returned unexpected data structure:', 
        data?.result ? 'Missing or invalid hits array' : 'Missing result object');
    }
    
    return Array.from(subdomains);
  } catch (error) {
    console.error('Error fetching from Censys:', error);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { domain } = await request.json();
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }

    // Create new project using Firestore
    const project = await ProjectModel.create({
      name: domain,
      targetDomain: domain,
      owner: session.user.email,
      team: [],
      status: 'active',
    });

    // Fetch subdomains from different sources
    const [certspotterSubdomains, censysSubdomains] = await Promise.all([
      fetchSubdomainsFromCertspotter(domain),
      fetchSubdomainsFromCensys(domain)
    ]);

    // Combine and deduplicate subdomains
    const allSubdomains = new Set([
      domain,
      ...certspotterSubdomains,
      ...censysSubdomains
    ]);

    // Create subdomains and vulnerabilities
    const createdSubdomains = [];
    for (const subdomain of allSubdomains) {
      const newSubdomain = await SubdomainModel.create({
        projectId: project.id,
        name: subdomain.trim(),
      });

      // Create vulnerabilities for each subdomain
      await Promise.all(vulnerabilityTypes.map(vulnType =>
        VulnerabilityModel.create({
          subdomainId: newSubdomain.id,
          type: vulnType.type,
          severity: vulnType.severity as 'High' | 'Medium' | 'Low' | 'Critical',
        })
      ));

      createdSubdomains.push(newSubdomain);
    }

    // Update project with subdomain count
    await ProjectModel.update(project.id, {
      subdomainsCount: createdSubdomains.length,
    });

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        targetDomain: project.targetDomain,
        status: project.status,
        subdomainsCount: createdSubdomains.length,
      },
      subdomainsCount: createdSubdomains.length,
      message: 'Enumeration completed successfully'
    });

  } catch (error: any) {
    console.error('Error during enumeration:', error);
    return NextResponse.json({
      error: 'Failed to complete enumeration',
      details: error.message
    }, { status: 500 });
  }
} 