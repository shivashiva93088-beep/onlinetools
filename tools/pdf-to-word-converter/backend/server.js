// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();

// Middleware setup
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json()); // Parse JSON requests

// Configure multer for file uploads
// Stores files in memory (no disk writing needed for this simple app)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only accept PDF files
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// CloudConvert API configuration
const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;
const CLOUDCONVERT_API_URL = 'https://api.cloudconvert.com/v2';

// Serve static files from frontend (for local testing)
app.use(express.static(path.join(__dirname, '../frontend')));

// Root route - serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'PDF to Word Converter API is running' });
});

// PDF to Word conversion endpoint
app.post('/convert', upload.single('pdf'), async (req, res) => {
    try {
        console.log('Conversion request received');
        
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No PDF file uploaded'
            });
        }
        
        // Check API key
        if (!CLOUDCONVERT_API_KEY) {
            console.error('API key is missing');
            return res.status(500).json({
                success: false,
                error: 'Server configuration error'
            });
        }
        
        // Create a unique job ID
        const jobId = `pdf_to_word_${Date.now()}`;
        
        // Step 1: Create CloudConvert job
        console.log('Creating CloudConvert job...');
        const jobResponse = await axios.post(
            `${CLOUDCONVERT_API_URL}/jobs`,
            {
                tasks: {
                    'import-upload': {
                        operation: 'import/upload'
                    },
                    'convert-task': {
                        operation: 'convert',
                        input: ['import-upload'],
                        output_format: 'docx',
                        engine: 'libreoffice',
                        optimize_print: true,
                        pdf_a: false
                    },
                    'export-task': {
                        operation: 'export/url',
                        input: ['convert-task'],
                        inline: false,
                        archive_multiple_files: false
                    }
                },
                tag: jobId
            },
            {
                headers: {
                    'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const jobData = jobResponse.data;
        console.log('Job created:', jobData.id);
        
        // Step 2: Get upload URL
        const uploadTask = jobData.data.tasks.find(t => t.name === 'import-upload');
        if (!uploadTask || !uploadTask.result || !uploadTask.result.form) {
            throw new Error('Failed to get upload URL from CloudConvert');
        }
        
        const uploadUrl = uploadTask.result.form.url;
        const uploadFields = uploadTask.result.form.parameters || {};
        
        // Step 3: Upload PDF to CloudConvert
        console.log('Uploading PDF file...');
        const formData = new FormData();
        
        // Add all required fields
        Object.keys(uploadFields).forEach(key => {
            formData.append(key, uploadFields[key]);
        });
        
        // Add the PDF file
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        
        await axios.post(uploadUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'Content-Length': req.file.size
            }
        });
        
        // Step 4: Wait for conversion to complete
        console.log('Waiting for conversion...');
        let jobStatus;
        let downloadUrl = null;
        let attempts = 0;
        const maxAttempts = 30; // Wait up to 30 seconds
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const statusResponse = await axios.get(
                `${CLOUDCONVERT_API_URL}/jobs/${jobData.data.id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}`
                    }
                }
            );
            
            jobStatus = statusResponse.data.data;
            
            // Check if export task is complete
            const exportTask = jobStatus.tasks.find(t => t.name === 'export-task');
            if (exportTask && exportTask.status === 'finished') {
                if (exportTask.result && exportTask.result.files && exportTask.result.files.length > 0) {
                    downloadUrl = exportTask.result.files[0].url;
                    break;
                }
            }
            
            // Check for errors
            if (jobStatus.status === 'error') {
                throw new Error('CloudConvert job failed');
            }
            
            attempts++;
        }
        
        if (!downloadUrl) {
            throw new Error('Conversion timeout or failed');
        }
        
        console.log('Conversion successful, downloading result...');
        
        // Step 5: Download converted file from CloudConvert
        const convertedFileResponse = await axios.get(downloadUrl, {
            responseType: 'arraybuffer'
        });
        
        // Step 6: Save file temporarily and send to frontend
        const tempFileName = `converted_${Date.now()}.docx`;
        const tempFilePath = path.join(__dirname, 'temp', tempFileName);
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
            fs.mkdirSync(path.join(__dirname, 'temp'));
        }
        
        // Save file
        fs.writeFileSync(tempFilePath, convertedFileResponse.data);
        
        // Send success response with download URL
        res.json({
            success: true,
            message: 'PDF successfully converted to Word',
            downloadUrl: `/download/${tempFileName}`,
            filename: tempFileName
        });
        
        // Clean up temp file after 5 minutes
        setTimeout(() => {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`Cleaned up temp file: ${tempFileName}`);
            }
        }, 5 * 60 * 1000);
        
    } catch (error) {
        console.error('Conversion error:', error.message);
        
        // Handle specific CloudConvert API errors
        if (error.response) {
            const status = error.response.status;
            const errorData = error.response.data;
            
            if (status === 402) {
                // Payment required - usually means free tier limit reached
                return res.status(402).json({
                    success: false,
                    error: 'Daily conversion limit reached. Please try again tomorrow.'
                });
            } else if (status === 401) {
                // Invalid API key
                return res.status(500).json({
                    success: false,
                    error: 'Server configuration error. Please contact administrator.'
                });
            } else if (errorData && errorData.message) {
                // Other CloudConvert errors
                return res.status(400).json({
                    success: false,
                    error: errorData.message
                });
            }
        }
        
        // Generic error response
        res.status(500).json({
            success: false,
            error: error.message || 'An unexpected error occurred during conversion'
        });
    }
});

// File download endpoint
app.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'temp', filename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'File not found or expired'
            });
        }
        
        // Send the file
        res.download(filePath, 'converted-document.docx', (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // File will be deleted by the setTimeout cleanup
        });
        
    } catch (error) {
        console.error('Download endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download file'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    
    if (err instanceof multer.MulterError) {
        // Multer file upload errors
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size exceeds 25MB limit'
            });
        }
        return res.status(400).json({
            success: false,
            error: err.message
        });
    } else if (err.message.includes('Only PDF files')) {
        // File type error
        return res.status(400).json({
            success: false,
            error: 'Only PDF files are allowed'
        });
    }
    
    // Generic server error
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend accessible at http://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`  POST http://localhost:${PORT}/convert`);
    console.log(`  GET  http://localhost:${PORT}/download/:filename`);
});
