/**
 * Report Formatter Service
 * Formats query results into structured, professional reports
 */

export interface ReportSection {
  title: string;
  content: string | any[];
  type: 'text' | 'table' | 'chart_data' | 'list' | 'summary';
}

export interface FormattedReport {
  reportTitle: string;
  generatedAt: string;
  summary: string;
  sections: ReportSection[];
  insights: string[];
  metadata: {
    totalRecords: number;
    filters?: any;
  };
}

export class ReportFormatter {
  
  /**
   * Format raw data into a structured report
   */
  formatReport(params: {
    title: string;
    data: any[];
    query: string;
    insights?: string[];
  }): FormattedReport {
    const { title, data, query, insights = [] } = params;

    const sections: ReportSection[] = [];

    // Add data table section
    if (data && data.length > 0) {
      sections.push({
        title: 'Data',
        content: data,
        type: 'table'
      });
    }

    // Generate automatic insights if none provided
    const reportInsights = insights.length > 0 ? insights : this.generateInsights(data);

    return {
      reportTitle: title,
      generatedAt: new Date().toISOString(),
      summary: `Report generated based on: "${query}"`,
      sections,
      insights: reportInsights,
      metadata: {
        totalRecords: data?.length || 0,
        filters: { query }
      }
    };
  }

  /**
   * Generate automatic insights from data
   */
  private generateInsights(data: any[]): string[] {
    const insights: string[] = [];

    if (!data || data.length === 0) {
      insights.push('No data found for the specified criteria');
      return insights;
    }

    insights.push(`Total records: ${data.length}`);

    // Find numeric columns and calculate statistics
    if (data.length > 0) {
      const numericColumns = Object.keys(data[0]).filter(key => 
        typeof data[0][key] === 'number'
      );

      numericColumns.forEach(col => {
        const values = data.map(row => Number(row[col])).filter(v => !isNaN(v));
        if (values.length > 0) {
          const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
          const max = Math.max(...values);
          const min = Math.min(...values);
          
          insights.push(`${col}: Average = ${avg.toFixed(2)}, Max = ${max}, Min = ${min}`);
        }
      });
    }

    return insights;
  }

  /**
   * Export report to text format
   */
  exportToText(report: FormattedReport): string {
    let output = '';
    
    output += '='.repeat(60) + '\n';
    output += `${report.reportTitle}\n`;
    output += '='.repeat(60) + '\n';
    output += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n`;
    output += `\n${report.summary}\n\n`;

    // Add insights
    if (report.insights.length > 0) {
      output += 'KEY INSIGHTS:\n';
      output += '-'.repeat(60) + '\n';
      report.insights.forEach((insight, i) => {
        output += `${i + 1}. ${insight}\n`;
      });
      output += '\n';
    }

    // Add data sections
    report.sections.forEach(section => {
      output += `\n${section.title.toUpperCase()}:\n`;
      output += '-'.repeat(60) + '\n';
      
      if (section.type === 'table' && Array.isArray(section.content)) {
        output += this.formatTableAsText(section.content);
      } else if (typeof section.content === 'string') {
        output += section.content + '\n';
      } else if (Array.isArray(section.content)) {
        section.content.forEach((item, i) => {
          output += `${i + 1}. ${JSON.stringify(item)}\n`;
        });
      }
      output += '\n';
    });

    output += '='.repeat(60) + '\n';
    output += `Total Records: ${report.metadata.totalRecords}\n`;
    output += '='.repeat(60) + '\n';

    return output;
  }

  /**
   * Format array of objects as ASCII table
   */
  private formatTableAsText(data: any[]): string {
    if (!data || data.length === 0) return 'No data\n';

    const keys = Object.keys(data[0]);
    const colWidths = keys.map(key => {
      const maxDataWidth = Math.max(...data.map(row => String(row[key] || '').length));
      return Math.max(key.length, maxDataWidth, 10);
    });

    let table = '';

    // Header
    table += '| ';
    keys.forEach((key, i) => {
      table += key.padEnd(colWidths[i]) + ' | ';
    });
    table += '\n';

    // Separator
    table += '|' + keys.map((_, i) => '-'.repeat(colWidths[i] + 2)).join('|') + '|\n';

    // Data rows
    data.forEach(row => {
      table += '| ';
      keys.forEach((key, i) => {
        const value = String(row[key] || '');
        table += value.padEnd(colWidths[i]) + ' | ';
      });
      table += '\n';
    });

    return table;
  }

  /**
   * Export report to CSV format
   */
  exportToCSV(report: FormattedReport): string {
    let csv = '';

    report.sections.forEach(section => {
      if (section.type === 'table' && Array.isArray(section.content) && section.content.length > 0) {
        const keys = Object.keys(section.content[0]);
        
        // Header
        csv += keys.join(',') + '\n';
        
        // Data
        section.content.forEach(row => {
          csv += keys.map(key => {
            const value = String(row[key] || '');
            // Escape commas and quotes
            return value.includes(',') || value.includes('"') 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',') + '\n';
        });
      }
    });

    return csv;
  }

  /**
   * Export report to JSON format
   */
  exportToJSON(report: FormattedReport): string {
    return JSON.stringify(report, null, 2);
  }
}

export const reportFormatter = new ReportFormatter();
