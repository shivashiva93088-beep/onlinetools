// Get all HTML elements we need to work with
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const uploadArea = document.getElementById('uploadArea');
const fileInfo = document.getElementById('fileInfo');
const loading = document.getElementById('loading');
const resultArea = document.getElementById('resultArea');
const errorBox = document.getElementById('errorBox');
const errorText = document.getElementById('errorText');

// Store the uploaded file
let uploadedFile = null;
let downloadUrl = null;

// IMPORTANT: Change this to your backend URL
// When running locally: http://localhost:3000
// When deployed: your-backend-url.com
const BACKEND_URL = 'http://localhost:3000';

// When "Select PDF File" button is clicked, trigger the file input
selectFileBtn.addEventListener('click', () => {
    fileInput.click();
});

// When user selects a file
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    
    if (file) {
        handleFileSelection(file);
    }
});

// Allow drag and drop file upload
uploadArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadArea.style.borderColor = '#2b579a';
    uploadArea.style.background = '#f0f7ff';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#adb5bd';
    uploadArea.style.background = 'white';
});

uploadArea.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadArea.style.borderColor = '#adb5bd';
    uploadArea.style.background = 'white';
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        handleFileSelection(file);
    } else {
        showError('Please drop a PDF file only.');
    }
});

// Handle the selected file
function handleFileSelection(file) {
    // Check file type
    if (file.type !== 'application/pdf') {
        showError('Please select a PDF file only.');
        fileInput.value = '';
        return;
    }
    
    // Check file size (25MB max)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (file.size > maxSize) {
        showError('File size exceeds 25MB limit. Please select a smaller file.');
        fileInput.value = '';
        return;
    }
    
    // Store the file and update UI
    uploadedFile = file;
    fileInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
    fileInfo.style.color = '#28a745';
    convertBtn.disabled = false;
    convertBtn.style.background = '#2b579a';
    
    // Hide any previous errors
    hideError();
}

// When "Convert to Word" button is clicked
convertBtn.addEventListener('click', async () => {
    if (!uploadedFile) {
        showError('Please select a PDF file first.');
        return;
    }
    
    // Show loading, hide other sections
    loading.style.display = 'block';
    resultArea.style.display = 'none';
    hideError();
    convertBtn.disabled = true;
    
    try {
        // Create form data to send to backend
        const formData = new FormData();
        formData.append('pdf', uploadedFile);
        
        // Send to our backend
        const response = await fetch(`${BACKEND_URL}/convert`, {
            method: 'POST',
            body: formData
        });
        
        // Get the response
        const result = await response.json();
        
        // Check if conversion was successful
        if (response.ok && result.success) {
            // Store download URL and show success
            downloadUrl = `${BACKEND_URL}${result.downloadUrl}`;
            loading.style.display = 'none';
            resultArea.style.display = 'block';
            
            // Reset for next conversion
            convertBtn.disabled = false;
        } else {
            // Handle API errors
            throw new Error(result.error || 'Conversion failed');
        }
    } catch (error) {
        loading.style.display = 'none';
        
        // Check for specific error types
        if (error.message.includes('limit') || error.message.includes('quota')) {
            showError('Daily conversion limit reached. Please try again tomorrow.');
        } else if (error.message.includes('network') || !navigator.onLine) {
            showError('Network error. Please check your connection.');
        } else {
            showError(`Conversion failed: ${error.message}`);
        }
        
        convertBtn.disabled = false;
    }
});

// When download button is clicked
downloadBtn.addEventListener('click', () => {
    if (downloadUrl) {
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'converted-document.docx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Reset the form for next conversion
        resetConverter();
    }
});

// Helper function to show error messages
function showError(message) {
    errorText.textContent = message;
    errorBox.style.display = 'flex';
    
    // Auto-hide error after 5 seconds
    setTimeout(hideError, 5000);
}

// Helper function to hide error messages
function hideError() {
    errorBox.style.display = 'none';
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Reset the converter for next use
function resetConverter() {
    uploadedFile = null;
    downloadUrl = null;
    fileInput.value = '';
    fileInfo.textContent = 'No file selected';
    fileInfo.style.color = '#495057';
    resultArea.style.display = 'none';
    convertBtn.disabled = true;
    convertBtn.style.background = '#adb5bd';
    hideError();
}

// Initial setup
hideError();
resultArea.style.display = 'none';
loading.style.display = 'none';
