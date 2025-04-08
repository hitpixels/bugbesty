import { NextResponse } from 'next/server';
import { getDocument, getDocuments, deleteDocument } from '@/lib/firestore';
import { Project, ProjectModel } from '@/models/Project';
import { Subdomain, SubdomainModel } from '@/models/Subdomain';
import { Vulnerability, VulnerabilityModel } from '@/models/Vulnerability';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Fix: Properly retrieve params
    const { id } = params;
    
    // Verify project exists
    const project = await getDocument<Project>('projects', id);
    if (!project) {
      return NextResponse.json({ 
        error: 'Project not found' 
      }, { status: 404 });
    }

    // Mark the project as "deleting" to indicate its status while background deletion continues
    await ProjectModel.update(id, { 
      status: 'deleting',
      updatedAt: new Date()
    });

    // Start background deletion process in a non-blocking way
    // This ensures the UI response is immediate while deletion happens asynchronously
    Promise.resolve().then(async () => {
      try {
        // Get all subdomains for this project
        const subdomains = await getDocuments<Subdomain>('subdomains', {
          fieldPath: 'projectId',
          operator: '==',
          value: id
        });
        
        console.log(`Starting deletion of ${subdomains.length} subdomains for project ${id}`);
        
        // Delete each subdomain and its vulnerabilities
        // Using a for loop instead of Promise.all to avoid overwhelming Firestore
        for (const subdomain of subdomains) {
          try {
            // Get and delete vulnerabilities for this subdomain
            const vulnerabilities = await getDocuments<Vulnerability>('vulnerabilities', {
              fieldPath: 'subdomainId',
              operator: '==',
              value: subdomain.id
            });
            
            // Delete each vulnerability
            for (const vulnerability of vulnerabilities) {
              try {
                await deleteDocument('vulnerabilities', vulnerability.id);
              } catch (vulnerabilityError) {
                console.error(`Error deleting vulnerability ${vulnerability.id}:`, vulnerabilityError);
                // Continue with next vulnerability even if one fails
              }
            }
            
            // Then delete the subdomain
            await deleteDocument('subdomains', subdomain.id);
          } catch (subdomainError) {
            console.error(`Error processing subdomain ${subdomain.id}:`, subdomainError);
            // Continue with next subdomain even if one fails
          }
        }
        
        // Finally delete the project itself
        await deleteDocument('projects', id);
        
        console.log(`Successfully deleted project ${id} and all associated data`);
      } catch (error) {
        // Log error but don't affect user experience - deletion happens in background
        console.error(`Background deletion error for project ${id}:`, error);
        
        // Even if there's an error, try to finalize by deleting the project itself
        try {
          await deleteDocument('projects', id);
          console.log(`Deleted project ${id} after error in background process`);
        } catch (finalDeleteError) {
          console.error(`Failed to delete project ${id} after error:`, finalDeleteError);
        }
      }
    });

    // Immediately return success to the user
    return NextResponse.json({ 
      message: 'Project deletion started successfully' 
    });
  } catch (error: any) {
    console.error('Error initiating project deletion:', error);
    return NextResponse.json({ 
      error: 'Failed to delete project',
      details: error.message 
    }, { status: 500 });
  }
} 