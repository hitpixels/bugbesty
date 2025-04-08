const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

interface ReportData {
  projectName: string;
  vulnerabilities: {
    subdomain: string;
    vulns: Array<{
      type: string;
      severity: string;
      timestamp: string;
    }>;
  }[];
  reproductionSteps: string;
  additionalNotes: string;
}

export async function generateReport(data: ReportData): Promise<string> {
  const prompt = `
    Generate a detailed bug bounty report with the following information:

    Project: ${data.projectName}

    Vulnerabilities Found:
    ${data.vulnerabilities.map(v => `
    Subdomain: ${v.subdomain}
    ${v.vulns.map(vuln => `
    - Type: ${vuln.type}
      Severity: ${vuln.severity}
      Found: ${vuln.timestamp}
    `).join('\n')}
    `).join('\n')}

    Steps to Reproduce:
    ${data.reproductionSteps}

    Additional Notes:
    ${data.additionalNotes}

    Please format this as plain text with clear sections and spacing, and do not use any special formatting like "---" or "**".
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Failed to generate report:', error);
    throw new Error('Failed to generate report');
  }
} 