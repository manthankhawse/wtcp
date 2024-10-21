import express from 'express';
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import crypto from 'crypto';
import path from 'path';
import fileUpload from 'express-fileupload';
import session from 'express-session'; // Import express-session
import { fileURLToPath } from 'url';

// Manually define __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware to handle file uploads
app.use(fileUpload());

// Middleware for sessions
app.use(session({
    secret: 'your_secret_key', // Change this to a secure random string
    resave: false,
    saveUninitialized: true,
}));

// Hardcoded Pinata API keys
const pinataApiKey = '6bb619055106b80c2cb7'; // Your Pinata API key
const pinataSecretApiKey = 'f9338c3bb42f9325d428182baebd62c61a8562b48b0589adf12453c111c57d8f'; // Your Pinata secret key

// Middleware to serve static files
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Parse incoming form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Home Route
app.get('/', (req, res) => {
    res.render('index', { ipfsHash: null, verificationMessage: null });
});

// About Route
app.get('/about', (req, res) => {
    res.render('about'); // Ensure you have an 'about.ejs' file in the views directory
});

// Admin Login Route
app.get('/admin-login', (req, res) => {
    res.render('admin-login');
});

// Verifier Login Route
app.get('/verifier-login', (req, res) => {
    res.render('verifier-login');
});

// Handling Admin Login
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;

    // Replace with your actual admin validation logic
    if (username === 'admin' && password === 'adminpassword') {
        req.session.user = { role: 'admin' }; // Set session user role
        res.redirect('/'); // Redirect or render the admin dashboard here
    } else {
        res.status(401).send('Invalid Admin credentials');
    }
});

// Handling Verifier Login
app.post('/verifier-login', (req, res) => {
    const { username, password } = req.body;

    // Replace with your actual verifier validation logic
    if (username === 'verifier' && password === 'verifierpassword') {
        req.session.user = { role: 'verifier' }; // Set session user role
        res.redirect('/'); // Redirect or render the verifier dashboard here
    } else {
        res.status(401).send('Invalid Verifier credentials');
    }
});

// Upload Route (handling file upload)
app.post('/upload', (req, res) => {
    const file = req.files?.file;

    if (!file) {
        return res.status(400).send('No file uploaded.');
    }

    const uploadPath = path.join(__dirname, 'uploads', file.name);

    // Save file to local directory
    file.mv(uploadPath, async (err) => {
        if (err) {
            return res.status(500).send('Error saving file.');
        }

        // Upload the file to Pinata
        const formData = new FormData();
        formData.append('file', fs.createReadStream(uploadPath));

        try {
            const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
                    pinata_api_key: pinataApiKey,
                    pinata_secret_api_key: pinataSecretApiKey,
                },
            });

            const ipfsHash = response.data.IpfsHash;

            // Calculate the hash of the original file
            const originalFileHash = calculateFileHash(uploadPath);

            // Retrieve the uploaded file and calculate its hash
            const pinataFile = await axios.get(`https://ipfs.io/ipfs/${ipfsHash}`, { responseType: 'arraybuffer' });
            const retrievedFileHash = crypto.createHash('sha256').update(pinataFile.data).digest('hex');

            // Compare the original file hash with the retrieved file hash
            const verificationMessage = originalFileHash === retrievedFileHash
                ? 'File verified and authentic.'
                : 'File has been altered or is not authentic.';

            // Clean up uploaded file after processing
            fs.unlinkSync(uploadPath);

            // Render the index page with the results
            res.render('index', { ipfsHash, verificationMessage });
        } catch (error) {
            console.error('Error uploading or verifying the file:', error);
            res.status(500).send('Error uploading or verifying the file.');
        }
    });
});

// Function to calculate file hash
function calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
