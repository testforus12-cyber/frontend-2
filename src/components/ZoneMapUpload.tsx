import React, { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, Loader2, FileText, Trash2 } from 'lucide-react';
// No external imports needed - using fetch API

/**
 * ZoneMapUpload Component
 * 
 * Allows users to upload vendor-specific pincode-to-zone mappings
 * Supports CSV file format with columns: pincode, zone, isOda, state, city
 * 
 * Usage:
 * <ZoneMapUpload vendorId="123abc" vendorName="ABC Transport" />
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://backend-2-4tjr.onrender.com';

interface ZoneMapUploadProps {
  vendorId: string;
  vendorName?: string;
  onUploadComplete?: (result: any) => void;
}

interface UploadResult {
  success: boolean;
  message: string;
  data?: {
    total: number;
    inserted: number;
    updated: number;
    errors: number;
    errorDetails?: any[];
  };
}

const ZoneMapUpload: React.FC<ZoneMapUploadProps> = ({ 
  vendorId, 
  vendorName = 'this vendor',
  onUploadComplete 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthToken = () => {
    // Try multiple common storage locations
    const fromCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('authToken='))
      ?.split('=')[1];
    
    return (
      fromCookie ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('token') ||
      ''
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      const formData = new FormData();
      formData.append('file', file);

      setProgress(30);

      const response = await fetch(
        `${API_BASE}/api/vendor/${vendorId}/zone-map`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      
      setProgress(100);
      setResult(responseData);
      
      if (onUploadComplete && responseData.success) {
        onUploadComplete(responseData);
      }

      // Clear file after successful upload
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload zone mappings');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csvContent = `pincode,zone,isOda,state,city
110001,METRO-DEL,false,Delhi,New Delhi
400001,METRO-MUM,false,Maharashtra,Mumbai
560001,METRO-BLR,false,Karnataka,Bangalore
700001,METRO-KOL,false,West Bengal,Kolkata
600001,METRO-CHE,false,Tamil Nadu,Chennai
500001,METRO-HYD,false,Telangana,Hyderabad
411001,METRO-PUN,false,Maharashtra,Pune
380001,METRO-AMD,false,Gujarat,Ahmedabad
302001,METRO-JAI,false,Rajasthan,Jaipur
201301,NCR-NOIDA,false,Uttar Pradesh,Noida`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'zone_mapping_template.csv';
    link.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Upload Zone Mapping
        </h3>
        <p className="text-sm text-slate-600">
          Upload a CSV file containing pincode-to-zone mappings for <strong>{vendorName}</strong>
        </p>
      </div>

      {/* Download Template Button */}
      <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Need a template?
            </p>
            <p className="text-xs text-blue-700 mb-3">
              Download our sample CSV with the correct format and example data.
            </p>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
              Download Template
            </button>
          </div>
        </div>
      </div>

      {/* File Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select CSV File
        </label>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100
              cursor-pointer"
          />
          {file && (
            <button
              onClick={handleClearFile}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear file"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
        {file && (
          <p className="mt-2 text-sm text-slate-600">
            Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
          </p>
        )}
      </div>

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl
          hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed
          transition-colors flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            Uploading... {progress}%
          </>
        ) : (
          <>
            <Upload size={20} />
            Upload Zone Mapping
          </>
        )}
      </button>

      {/* Progress Bar */}
      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 mb-1">Upload Failed</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && result.success && (
        <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900 mb-2">
                Upload Successful!
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-700">Total Rows:</span>
                  <span className="ml-2 font-semibold text-green-900">
                    {result.data?.total || 0}
                  </span>
                </div>
                <div>
                  <span className="text-green-700">Inserted:</span>
                  <span className="ml-2 font-semibold text-green-900">
                    {result.data?.inserted || 0}
                  </span>
                </div>
                <div>
                  <span className="text-green-700">Updated:</span>
                  <span className="ml-2 font-semibold text-green-900">
                    {result.data?.updated || 0}
                  </span>
                </div>
                <div>
                  <span className="text-green-700">Errors:</span>
                  <span className="ml-2 font-semibold text-green-900">
                    {result.data?.errors || 0}
                  </span>
                </div>
              </div>
              
              {result.data?.errorDetails && result.data.errorDetails.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs font-semibold text-yellow-900 mb-2">
                    Some rows had errors:
                  </p>
                  <div className="max-h-32 overflow-y-auto text-xs text-yellow-800 space-y-1">
                    {result.data.errorDetails.slice(0, 10).map((err: any, idx: number) => (
                      <div key={idx}>
                        • Pincode {err.pincode}: {err.error}
                      </div>
                    ))}
                    {result.data.errorDetails.length > 10 && (
                      <div className="text-yellow-700 italic">
                        ... and {result.data.errorDetails.length - 10} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-xs font-semibold text-slate-700 mb-2">
          CSV Format Requirements:
        </p>
        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
          <li>Required columns: <code className="bg-slate-200 px-1 rounded">pincode</code>, <code className="bg-slate-200 px-1 rounded">zone</code></li>
          <li>Optional columns: <code className="bg-slate-200 px-1 rounded">isOda</code>, <code className="bg-slate-200 px-1 rounded">state</code>, <code className="bg-slate-200 px-1 rounded">city</code></li>
          <li>Pincodes must be 6 digits and cannot start with 0</li>
          <li>Zone codes will be converted to uppercase</li>
          <li>Maximum file size: 5MB (~50,000 rows)</li>
          <li>Duplicate pincodes will be updated with new values</li>
        </ul>
      </div>
    </div>
  );
};

export default ZoneMapUpload;