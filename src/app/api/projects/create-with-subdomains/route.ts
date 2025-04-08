import { NextResponse } from 'next/server';
import { getDocuments, getDocument } from '@/lib/firestore';
import { Project, ProjectModel } from '@/models/Project';
import { Subdomain, SubdomainModel } from '@/models/Subdomain';
import { Vulnerability, VulnerabilityModel } from '@/models/Vulnerability';
import { vulnerabilityTypes } from '@/constants/vulnerabilityTypes';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function POST(request: Request) {
  let project = null;
  let createdSubdomains: any[] = [];

  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { name, subdomains } = body;

    if (!name || !subdomains || !Array.isArray(subdomains)) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: 'Name and subdomains array are required' 
      }, { status: 400 });
    }

    // Check if active project exists with same name
    const existingProjects = await getDocuments<Project>('projects', [
      {
        fieldPath: 'name',
        operator: '==',
        value: name
      },
      {
        fieldPath: 'status',
        operator: '==',
        value: 'active'
      }
    ]);
    
    if (existingProjects.length > 0) {
      const existingProject = existingProjects[0];
      
      const existingSubdomains = await getDocuments<Subdomain>('subdomains', {
        fieldPath: 'projectId',
        operator: '==',
        value: existingProject.id
      });
      
      if (existingSubdomains.length > 0) {
        return NextResponse.json({ 
          error: 'Project exists', 
          details: 'An active project with this name already exists' 
        }, { status: 409 });
      }

      // Archive the existing project
      await ProjectModel.update(existingProject.id, { status: 'archived' });
    }

    // Create new project with owner
    project = await ProjectModel.create({
      name,
      targetDomain: name,
      status: 'active',
      owner: session.user.email,
      team: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Process subdomains
    const validSubdomains = subdomains.filter((subdomain: string) => 
      subdomain && subdomain.trim().length > 0
    );

    // Create subdomains and vulnerabilities
    for (const subdomain of validSubdomains) {
      const newSubdomain = await SubdomainModel.create({
        projectId: project.id,
        name: subdomain.trim(),
        status: 'scanning',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Create vulnerabilities
      for (const vulnType of vulnerabilityTypes) {
        await VulnerabilityModel.create({
          subdomainId: newSubdomain.id,
          type: vulnType.type,
          severity: vulnType.severity,
          status: 'Not Yet Done',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      createdSubdomains.push(newSubdomain);
    }

    // Update project with subdomain count
    await ProjectModel.update(project.id, {
      subdomainsCount: validSubdomains.length
    });

    return NextResponse.json({
      project,
      subdomains: createdSubdomains,
      message: 'Project and subdomains created successfully'
    });

  } catch (error: any) {
    console.error('Error creating project with subdomains:', error);
    
    return NextResponse.json({ 
      error: 'Failed to create project with subdomains',
      details: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
} 