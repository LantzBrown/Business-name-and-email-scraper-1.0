import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { BusinessData, RowStatus } from '../types';

export const parseFile = (file: File): Promise<BusinessData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result;
        if (!fileContent) {
            reject(new Error('Could not read file content.'));
            return;
        }
        let data: any[] = [];

        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(fileContent as string, { header: true, skipEmptyLines: true });
          if (result.errors.length > 0) {
            console.error('CSV Parsing Errors:', result.errors);
            reject(new Error(`Error in CSV file on row ${result.errors[0].row}: ${result.errors[0].message}.`));
            return;
          }
          data = result.data;
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(fileContent, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
              reject(new Error('No sheets found in the Excel file.'));
              return;
          }
          const worksheet = workbook.Sheets[sheetName];
          data = XLSX.utils.sheet_to_json(worksheet);
        } else {
          reject(new Error('Unsupported file type. Please upload a CSV or XLSX file.'));
          return;
        }
        
        const businessData = data
          .map((row, index) => (row ? { ...row, id: index, status: RowStatus.PENDING } : null))
          .filter((row): row is BusinessData => 
            row !== null && 
            typeof row === 'object' && 
            Object.values(row).some(val => val !== null && val !== '' && val !== undefined)
          );

        if (businessData.length === 0) {
            reject(new Error('No valid data found in the file. Please check the file content and format.'));
            return;
        }

        resolve(businessData);

      } catch (error: any) {
        console.error("Error during file parsing:", error);
        reject(new Error(`Failed to parse file. Please ensure it's a valid CSV or XLSX. Error: ${error.message}`));
      }
    };

    reader.onerror = (error) => {
        console.error("FileReader error:", error);
        reject(new Error('An error occurred while reading the file.'));
    };
    
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
  });
};

export const downloadAsCSV = (data: BusinessData[]) => {
  if (data.length === 0) return;
  
  const dataToExport = data.map(row => {
    const { id, status, ...rest } = row;
    return rest;
  });

  const csv = Papa.unparse(dataToExport);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'enriched_business_leads.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
