import { NextResponse } from 'next/server';
import { getDocuments } from '@/lib/firestore';
import { ProjectModel, Project } from '@/models/Project';
import { getServerSession } from 'next-auth';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      // Try to fetch projects from Firestore with ordering
      const projects = await getDocuments<Project>('projects', {
        fieldPath: 'owner',
        operator: '==',
        value: session.user.email,
        orderByField: 'createdAt',
        orderDirection: 'desc'
      });
      
      // Filter for active projects only
      const activeProjects = projects.filter(project => project.status === 'active');
      
      return NextResponse.json(activeProjects);
    } catch (error) {
      // If we get an index error, fall back to a simpler query
      if (error instanceof Error && error.message.includes('index')) {
        console.log('Falling back to simpler query without ordering');
        // Simplified query without ordering
        const projects = await getDocuments<Project>('projects', {
          fieldPath: 'owner',
          operator: '==',
          value: session.user.email
        });
        
        // Filter for active projects only
        const activeProjects = projects.filter(project => project.status === 'active');
        
        return NextResponse.json(activeProjects);
      }
      
      // If it's some other error, rethrow it
      throw error;
    }
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, targetDomain, enumerationMethod } = await req.json();

    if (!name || !targetDomain) {
      return NextResponse.json(
        { error: "Name and target domain are required" },
        { status: 400 }
      );
    }
    
    // Create project in Firestore
    const projectData = {
      name,
      targetDomain,
      owner: session.user.email,
      team: [],
      status: "initializing" as const, // Type assertion to fix type error
    };
    
    const project = await ProjectModel.create(projectData);

    // If auto enumeration is selected, create a background task
    if (enumerationMethod === "auto") {
      try {
        const { createTask } = await import("@/lib/backgroundTasks");
        const task = await createTask("subdomain_enumeration", {
          projectId: project.id,
          targetDomain,
        });
        
        // Store task ID in project
        await ProjectModel.update(project.id, {
          enumerationTaskId: task.id
        });
        
        // Update local project object
        project.enumerationTaskId = task.id;
      } catch (error) {
        console.error("Failed to create background task:", error);
        // Continue without failing the entire request
      }
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        targetDomain: project.targetDomain,
        status: project.status,
        enumerationTaskId: project.enumerationTaskId || null,
      },
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
} 