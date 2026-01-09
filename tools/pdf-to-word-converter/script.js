// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const pdfInput = document.getElementById('pdfInput');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFile = document.getElementById('removeFile');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const message = document.getElementById('message');
const backendPdfInput = document.getElementById('backendPdfInput');
const backendConvertBtn = document.getElementById('backendConvertBtn');

// Variables to store file and converted document
let currentPDFFile = null;
let convertedDoc = null;
let extractedText = '';

// Set pdfjs worker path (important for pdf.js to work)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Event Listeners

// Click upload area to trigger file input
uploadArea.addEventListener('click', () => {
    pdfInput.click();
});

// Handle file selection
pdfInput.addEventListener('change', handleFileSelect);
backendPdfInput.addEventListener('change', handleBackendFileSelect);

// Handle file drop on upload area
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#2980b9';
    uploadArea.style.background = '#f0f8ff';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#3498db';
    uploadArea.style.background = 'white';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#3498db';
    uploadArea.style.background = 'white';
    
    if (e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/pdf') {
            handleFile(file);
        } else {
            showMessage('Please select a PDF file', 'error');
        }
    }
});

// Convert button click
convertBtn.addEventListener('click', convertPDFtoWord);

// Download button click
downloadBtn.addEventListener('click', downloadWordFile);

// Remove file button
removeFile.addEventListener('click', clearFile);

// Backend convert button
backendConvertBtn.addEventListener('click', convertWithBackend);

// Functions

/**
 * Handle file selection from input
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleBackendFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        backendConvertBtn.disabled = false;
    }
}

/**
 * Process selected file
 */
function handleFile(file) {
    // Check if file is PDF
    if (file.type !== 'application/pdf') {
        showMessage('Please select a PDF file', 'error');
        return;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showMessage('File size must be less than 10MB', 'error');
        return;
    }
    
    currentPDFFile = file;
    
    // Update UI
    fileName.textContent = `Name: ${file.name}`;
    fileSize.textContent = `Size: ${formatFileSize(file.size)}`;
    fileInfo.style.display = 'block';
    convertBtn.disabled = false;
    downloadBtn.disabled = true;
    
    showMessage('File selected. Click "Convert to Word" to proceed.', 'success');
}

/**
 * Convert PDF to Word using browser-only approach
 */
async function convertPDFtoWord() {
    if (!currentPDFFile) {
        showMessage('Please select a PDF file first', 'error');
        return;
    }
    
    try {
        // Reset UI
        convertBtn.disabled = true;
        downloadBtn.disabled = true;
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
        
        // Show loading state
        convertBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Converting...';
        
        // Extract text from PDF
        showProgress(10, 'Reading PDF file...');
        extractedText = await extractTextFromPDF(currentPDFFile);
        
        showProgress(50, 'Creating Word document...');
        
        // Create Word document
        convertedDoc = await createWordDocument(extractedText);
        
        showProgress(100, 'Conversion complete!');
        
        // Update UI
        convertBtn.disabled = true;
        downloadBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-check"></i> Conversion Complete';
        
        showMessage('PDF successfully converted to Word! Click "Download Word File" to save.', 'success');
        
    } catch (error) {
        console.error('Conversion error:', error);
        showMessage(`Conversion failed: ${error.message}`, 'error');
        convertBtn.disabled = false;
        convertBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Convert to Word';
    } finally {
        // Hide progress bar after 2 seconds
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);
    }
}

/**
 * Extract text from PDF using pdf.js
 */
async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function(event) {
            try {
                const typedArray = new Uint8Array(event.target.result);
                
                // Load PDF document
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                let fullText = '';
                
                // Extract text from each page
                for (let i = 1; i <= pdf.numPages; i++) {
                    showProgress(10 + (i / pdf.numPages * 40), `Processing page ${i} of ${pdf.numPages}...`);
                    
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    
                    fullText += pageText + '\n\n';
                }
                
                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

/**
 * Create Word document using docx library
 */
async function createWordDocument(text) {
    // Create a new document
    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: [
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: "Converted from PDF",
                            bold: true,
                            size: 28,
                        }),
                    ],
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: `Original PDF: ${currentPDFFile.name}`,
                            italics: true,
                            size: 20,
                        }),
                    ],
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: `Converted on: ${new Date().toLocaleDateString()}`,
                            size: 20,
                        }),
                    ],
                    alignment: docx.AlignmentType.CENTER,
                }),
                new docx.Paragraph({
                    children: [new docx.TextRun("")],
                }),
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: "--- Start of Content ---",
                            bold: true,
                        }),
                    ],
                }),
                new docx.Paragraph({
                    children: [new docx.TextRun("")],
                }),
            ],
        }],
    });
    
    // Split text into paragraphs and add to document
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    
    paragraphs.forEach(paragraph => {
        doc.addSection({
            children: [
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: paragraph,
                            size: 24,
                        }),
                    ],
                }),
            ],
        });
    });
    
    return doc;
}

/**
 * Download the converted Word document
 */
async function downloadWordFile() {
    if (!convertedDoc) {
        showMessage('No document to download', 'error');
        return;
    }
    
    try {
        // Generate the Word file
        const buffer = await docx.Packer.toBlob(convertedDoc);
        
        // Create filename
        const originalName = currentPDFFile.name;
        const wordName = originalName.replace(/\.pdf$/i, '.docx');
        
        // Save file using FileSaver.js
        saveAs(buffer, wordName);
        
        showMessage('Download started!', 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        showMessage(`Download failed: ${error.message}`, 'error');
    }
}

/**
 * Convert using backend (example - requires server to be running)
 */
async function convertWithBackend() {
    const file = backendPdfInput.files[0];
    if (!file) {
        showMessage('Please select a PDF file for backend conversion', 'error');
        return;
    }
    
    showMessage('Backend conversion requires Node.js server to be running. Check server.js file.', 'error');
    
    // This is where you would send the file to your backend
    // Example using fetch:
    /*
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
        const response = await fetch('http://localhost:3000/convert', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const blob = await response.blob();
            saveAs(blob, file.name.replace('.pdf', '.docx'));
            showMessage('Conversion successful!', 'success');
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        showMessage(`Backend error: ${error.message}`, 'error');
    }
    */
}

/**
 * Show progress updates
 */
function showProgress(percent, text) {
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}% - ${text}`;
}

/**
 * Show message to user
 */
function showMessage(msg, type) {
    message.textContent = msg;
    message.className = `message ${type}`;
    message.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            message.style.display = 'none';
        }, 5000);
    }
}

/**
 * Format file size to readable string
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Clear selected file
 */
function clearFile() {
    currentPDFFile = null;
    convertedDoc = null;
    pdfInput.value = '';
    fileInfo.style.display = 'none';
    convertBtn.disabled = true;
    downloadBtn.disabled = true;
    convertBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Convert to Word';
    message.style.display = 'none';
}

// Initialize
clearFile();
