import React, { useState, useRef, useCallback } from 'react';
import { BusinessData, ProcessingStatus, RowStatus } from './types';
import { parseFile, downloadAsCSV } from './utils/fileUtils';
import { findOwnerInfo } from './services/osintService'; // UPDATED IMPORT
import { UploadIcon, PlayIcon, StopIcon, DownloadIcon, FileIcon } from './components/Icons';

// --- Helper Components defined outside the main component ---

const FileUpload: React.FC<{ onFileUpload: (file: File) => void; disabled: boolean; }> = ({ onFileUpload, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileUpload(files[0]);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg transition-colors duration-300 ${isDragging ? 'border-sky-400 bg-sky-900/50' : 'border-slate-600 hover:border-sky-500'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={disabled ? undefined : handleClick}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} disabled={disabled}/>
      <UploadIcon className="w-12 h-12 text-slate-400 mb-4" />
      <p className="text-slate-300">
        <span className="font-semibold text-sky-400">Click to upload</span> or drag and drop
      </p>
      <p className="text-xs text-slate-500">CSV or XLSX file</p>
    </div>
  );
};

const DataTable: React.FC<{ data: BusinessData[], headers: string[] }> = ({ data, headers }) => {
    const statusColorMap: Record<RowStatus, string> = {
        [RowStatus.PENDING]: 'bg-slate-700 text-slate-300',
        [RowStatus.PROCESSING]: 'bg-sky-700 text-sky-200 animate-pulse',
        [RowStatus.FOUND]: 'bg-green-700 text-green-200',
        [RowStatus.NOT_FOUND]: 'bg-yellow-700 text-yellow-200',
        [RowStatus.ERROR]: 'bg-red-700 text-red-200',
    };

    return (
        <div className="w-full overflow-x-auto max-h-[50vh] bg-slate-800 rounded-lg shadow-lg">
            <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-900 sticky top-0">
                    <tr>
                        {headers.map(header => <th key={header} className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">{header}</th>)}
                    </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                    {data.map((row) => (
                        <tr key={row.id}>
                            {headers.map(header => (
                                <td key={`${row.id}-${header}`} className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                   {header === 'status' && row.status ? (
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColorMap[row.status]}`}>
                                            {row.status}
                                        </span>
                                    ) : (
                                        row[header] || ''
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


// --- Main App Component ---

export default function App() {
  const [data, setData] = useState<BusinessData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [error, setError] = useState<string | null>(null);

  const isRunningRef = useRef(false);

  const isProcessing = status === ProcessingStatus.RUNNING;
  const hasData = data.length > 0;

  const handleFileUpload = async (file: File) => {
    setStatus(ProcessingStatus.IDLE);
    setError(null);
    setData([]);
    setFileName(null);
    try {
      const parsedData = await parseFile(file);
      if (parsedData.length === 0) {
          setError("File is empty or could not be parsed correctly.");
          return;
      }
      setData(parsedData);
      setFileName(file.name);

      const allHeaders = parsedData.reduce<string[]>((acc, row) => {
        Object.keys(row).forEach(key => {
          if (!acc.includes(key) && key !== 'id') acc.push(key);
        });
        return acc;
      }, []);
      
      const orderedHeaders = ['name', 'Name', 'business_name', 'Business Name', 'website', 'Website'].filter(h => allHeaders.includes(h));
      const aiGeneratedHeaders = ['ownerTitle', 'ownerFirstName', 'ownerLastName', 'ownerEmail', 'niche', 'uncertainty'];
      const otherHeaders = allHeaders.filter(h => !orderedHeaders.includes(h) && !aiGeneratedHeaders.includes(h) && h !== 'status');
      setHeaders(['status', ...orderedHeaders, ...otherHeaders, ...aiGeneratedHeaders]);

    } catch (err: any) {
      setError(err.message || 'Failed to parse file.');
    }
  };

  const handleStop = useCallback(() => {
    isRunningRef.current = false;
    setStatus(ProcessingStatus.STOPPED);
  }, []);

  const handleRun = useCallback(async () => {
    if (!hasData) return;
    setStatus(ProcessingStatus.RUNNING);
    isRunningRef.current = true;
    setError(null);

    setData(prevData =>
      prevData.map(row =>
        row.status === RowStatus.PENDING ? { ...row, status: RowStatus.PROCESSING } : row
      )
    );

    const processingPromises = data
      .filter(row => row.status === RowStatus.PENDING || row.status === RowStatus.PROCESSING)
      .map(async (businessToProcess) => {
        if (!isRunningRef.current) return;

        const result = await findOwnerInfo(businessToProcess);

        setData(prevData =>
          prevData.map(row => {
            if (row.id === businessToProcess.id) {
              if (result) {
                return {
                  ...row,
                  ...result,
                  status: (result.ownerFirstName || result.ownerLastName || result.ownerEmail) ? RowStatus.FOUND : RowStatus.NOT_FOUND,
                };
              }
              return { ...row, status: RowStatus.ERROR };
            }
            return row;
          })
        );
      });

    await Promise.all(processingPromises);

    if (isRunningRef.current) {
      setStatus(ProcessingStatus.COMPLETE);
    }
  }, [data, hasData]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">
        <header className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
                Business Lead Finder
            </h1>
            <p className="mt-4 text-lg text-slate-400 max-w-3xl mx-auto">
                Upload a spreadsheet of businesses, and the app will scrape their websites to find owner and contact info.
            </p>
        </header>

        <main className="flex flex-col gap-6">
            <div className="bg-slate-800/50 p-6 rounded-xl shadow-2xl border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">1. Upload Your File</h2>
                <FileUpload onFileUpload={handleFileUpload} disabled={isProcessing} />
                {fileName && !isProcessing && (
                    <div className="mt-4 p-3 bg-slate-700 rounded-lg flex items-center gap-3 text-sm">
                        <FileIcon className="w-5 h-5 text-sky-400 flex-shrink-0" />
                        <span className="font-mono text-slate-300 truncate">{fileName}</span>
                        <span className="ml-auto text-slate-400">{data.length} rows detected</span>
                    </div>
                )}
                 {error && <p className="mt-4 text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</p>}
            </div>

            {hasData && (
                 <div className="bg-slate-800/50 p-6 rounded-xl shadow-2xl border border-slate-700">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <h2 className="text-xl font-semibold">2. Run & Review Results</h2>
                        <div className="flex items-center gap-3">
                            {status !== ProcessingStatus.RUNNING ? (
                                <button onClick={handleRun} disabled={!hasData || isProcessing} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors">
                                    <PlayIcon className="w-5 h-5"/>
                                    <span>{status === ProcessingStatus.STOPPED || status === ProcessingStatus.COMPLETE ? 'Resume' : 'Run'}</span>
                                </button>
                            ) : (
                                <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-500 transition-colors">
                                    <StopIcon className="w-5 h-5"/>
                                    <span>Stop</span>
                                </button>
                            )}
                            <button onClick={() => downloadAsCSV(data)} disabled={!hasData || isProcessing} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors">
                                <DownloadIcon className="w-5 h-5"/>
                                <span>Download</span>
                            </button>
                        </div>
                    </div>
                    
                    <DataTable data={data} headers={headers} />
                </div>
            )}
        </main>
      </div>
    </div>
  );
}
