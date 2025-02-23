const express = require('express');
const path = require('path');
const fs = require('fs');
const marked = require('marked');
const frontMatter = require('front-matter');
const Handlebars = require('handlebars');

const app = express();
const PORT = 3001;

// Add base URL for GitHub Pages
const BASE_URL = process.env.NODE_ENV === 'production' ? '/personal-site' : '';

// Register a Handlebars helper for URLs
Handlebars.registerHelper('url', function(path) {
    return `${BASE_URL}${path}`;
});

// Serve static files from public directory
app.use(express.static('public'));
// Add cache control headers
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.css') || path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));
// Serve main.css as styles.css
app.use('/styles.css', express.static(path.join(__dirname, '../src/styles/main.css')));

// Read and compile main template
const mainTemplateSource = fs.readFileSync(path.join(__dirname, '../src/templates/main.html'), 'utf-8');
const mainTemplate = Handlebars.compile(mainTemplateSource);

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Handle content routes (about, faq)
app.get('/:page', (req, res, next) => {
  const page = req.params.page;
  
  // Skip markdown processing for non-content requests
  if (page.includes('.')) {
    return next();
  }

  const contentPath = path.join(__dirname, '..', 'src', 'content', `${page}.md`);
  
  console.log('Requested page:', page);
  console.log('Current directory:', __dirname);
  console.log('Looking for file at:', contentPath);
  console.log('File exists?:', fs.existsSync(contentPath));

  try {
    if (!fs.existsSync(contentPath)) {
      return next();
    }
    
    const content = fs.readFileSync(contentPath, 'utf-8');
    console.log('File found and read');
    const { attributes, body } = frontMatter(content);
    console.log('Front matter processed');
    const htmlContent = marked.parse(body);
    console.log('Markdown parsed');
    
    // Wrap the content in our main template
    const pageHtml = mainTemplate({
      content: htmlContent,
      title: attributes.title || page,
      isPost: false,
      isHome: false
    });
    
    res.send(pageHtml);
  } catch (error) {
    console.error('Error processing page:', error);
    next(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try these steps:`);
    console.error('1. Kill the existing process:');
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error('2. Then run:');
    console.error('   taskkill /PID <PID> /F');
    console.error('3. Finally, restart this server');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
}); 