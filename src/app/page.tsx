// src/app/page.tsx
'use client';

import { useState } from 'react';

export default function Home() {
  // --- State Variables ---
  const [repoUrl, setRepoUrl] = useState('');
  const [generatedReadme, setGeneratedReadme] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  // --- Handle Form Submission ---
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setGeneratedReadme('');
    setStatusMessage('Validating URL...');
    setCopyStatus('idle'); // Reset copy status

    // Basic URL validation
    if (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://')) {
      setError('Please enter a valid repository URL (starting with http:// or https://).');
      setIsLoading(false);
      setStatusMessage('');
      return;
    }

    try {
      setStatusMessage('Sending request to generate README...');
      const response = await fetch('/api/generate-readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl }),
      });

      setStatusMessage('Waiting for AI generation...');

      // Check if response is ok (status in the range 200-299)
      if (!response.ok) {
        let errorData;
        try {
           errorData = await response.json(); // Try parsing JSON error
        } catch (parseError){
           // If response is not JSON, use status text
           throw new Error(response.statusText || `HTTP error! Status: ${response.status}`);
        }
        // Use error message from API if available, otherwise fallback
        throw new Error(errorData?.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      // Check if readme content exists in the response
      if (typeof data.readme !== 'string') {
         throw new Error('Received invalid response format from the server.');
       }

      setStatusMessage('README generated successfully!');
      setGeneratedReadme(data.readme);

    } catch (err: any) {
      console.error("Generation failed:", err);
      setError(err.message || 'Failed to generate README. Check console or server logs.');
      setStatusMessage(''); // Clear status on error
    } finally {
      setIsLoading(false);
      // Clear status message only if there was an error, otherwise keep success message
       if (error) {
          setStatusMessage('');
       }
    }
  };

  // --- Handle Safe Copy ---
  const handleCopyReadme = async () => {
    setCopyStatus('idle'); // Reset just in case

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(generatedReadme);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000); // Reset after 2s
      } catch (err) {
        console.error("Failed to copy README:", err);
        setCopyStatus('failed');
        setTimeout(() => setCopyStatus('idle'), 3000); // Reset after 3s
      }
    } else {
      console.warn("Clipboard API not available.");
      setCopyStatus('failed'); // Indicate failure if API not present
      setError('Clipboard copying not supported in this browser/context.'); // Also show in main error area
      setTimeout(() => setCopyStatus('idle'), 3000); // Reset after 3s
    }
  };


  // --- JSX for UI ---
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-gray-100 dark:bg-gray-900"> {/* Light gray background */}
      <div className="w-full max-w-3xl rounded-lg bg-white dark:bg-gray-800 shadow-xl p-6 sm:p-8">
        {/* Header */}
        <h1 className="mb-2 text-center text-3xl font-bold text-gray-900 dark:text-white">
          AI README Generator
        </h1>
        <p className="mb-6 text-center text-gray-500 dark:text-gray-300">
          Enter a public repository URL to generate a README.md file using Google AI.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="repoUrl" className="sr-only">
              Public Repository URL
            </label>
            <input
              type="url"
              id="repoUrl"
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:ring-offset-1 sm:text-sm"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repository-name"
              required
              aria-label="Public Repository URL"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed" // Adjusted colors
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : 'Generate README'}
          </button>
        </form>

        {/* Status Message */}
        {(isLoading || statusMessage) && !error && (
           <div className={`mt-4 text-center text-sm ${statusMessage.includes('success') ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'} ${isLoading ? 'animate-pulse' : ''}`}>
              {statusMessage}
           </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 rounded-md border border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/30 p-3">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Error: {error}</p>
          </div>
        )}

        {/* Output Area */}
        {generatedReadme && !isLoading && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Generated README.md:
              </h2>
              {/* Copy Button using safe handler */}
              <button
                onClick={handleCopyReadme}
                disabled={copyStatus !== 'idle'}
                className={`rounded border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-indigo-500 focus:ring-offset-1 transition-colors duration-150 ease-in-out
                  ${copyStatus === 'copied'
                    ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 border-green-300 dark:border-green-600'
                    : copyStatus === 'failed'
                      ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 border-red-300 dark:border-red-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }
                  ${copyStatus !== 'idle' ? 'cursor-not-allowed' : ''}
                `}
              >
                {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Failed' : 'Copy'}
              </button>
            </div>
            {/* Textarea */}
            <textarea
              readOnly
              value={generatedReadme}
              rows={25}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-800 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-mono"
              aria-label="Generated README content"
            />
          </div>
        )}
      </div>
    </div>
  );
}