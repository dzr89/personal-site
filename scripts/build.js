const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const matter = require('front-matter');
const { promisify } = require('util');
const glob = require('glob');
const globPromise = promisify(glob);
const Handlebars = require('handlebars');

// Paths
const CONTENT_DIR = path.join(__dirname, '../src/content');
const TEMPLATES_DIR = path.join(__dirname, '../src/templates');
const PUBLIC_DIR = path.join(__dirname, '../public');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');
const STYLES_DIR = path.join(__dirname, '../src/styles');

// Add base URL for GitHub Pages
const BASE_URL = process.env.NODE_ENV === 'production' ? '/dr-personal-site' : '';

// Register a Handlebars helper for URLs
Handlebars.registerHelper('url', function(path) {
    return `${BASE_URL}${path}`;
});

marked.setOptions({
    headerIds: true,
    gfm: true,
    breaks: true,
    sanitize: false,
    smartLists: true,
    smartypants: true,
    xhtml: true
});

async function build() {
    try {
        // Ensure all required directories exist
        await fs.ensureDir(PUBLIC_DIR);
        await fs.ensureDir(path.join(PUBLIC_DIR, 'blog'));
        await fs.ensureDir(path.join(PUBLIC_DIR, 'styles'));

        // Copy static assets
        await fs.copy(STYLES_DIR, path.join(PUBLIC_DIR, 'styles'), { overwrite: true });

        // Read and compile templates
        const mainTemplateSource = await fs.readFile(path.join(TEMPLATES_DIR, 'main.html'), 'utf-8');
        const postTemplateSource = await fs.readFile(path.join(TEMPLATES_DIR, 'post.html'), 'utf-8');
        const mainTemplate = Handlebars.compile(mainTemplateSource);
        const postTemplate = Handlebars.compile(postTemplateSource);

        // Store post metadata for the index page
        const postsList = [];

        // Process all markdown files - look in both root and posts directory
        const pageFiles = await globPromise('src/content/*.md');
        const postFiles = await globPromise('src/content/posts/*.md');
        const files = [...pageFiles, ...postFiles];
        
        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const { attributes, body } = matter(content);
            const html = marked(body);
            const filename = path.basename(file);
            
            // Check if this is a blog post or a page
            const isPage = !file.includes('posts/');
            
            if (isPage) {
                // Handle pages (about, faq)
                const pageName = filename.replace('.md', '');
                const outputPath = path.join(PUBLIC_DIR, `${pageName}.html`);
             
                // Wrap the content in the main template
                const pageHtml = mainTemplate({
                    content: html,
                    title: attributes.title || pageName,
                    isPost: false
                });
                
                await fs.writeFile(outputPath, pageHtml);
                console.log(`Created page: ${outputPath}`);
            } else {
                // Handle blog posts
                const formattedDate = new Date(attributes.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                // Add post info to the list
                postsList.push({
                    title: attributes.title,
                    date: attributes.date,
                    description: attributes.description,
                    url: `${BASE_URL}/blog/${filename.replace('.md', '.html')}`,
                    formattedDate,
                    tags: attributes.tags
                });

                // Create the blog post HTML
                const postHtml = postTemplate({
                    title: attributes.title,
                    date: attributes.date,
                    formattedDate,
                    content: html,
                    tags: attributes.tags,
                    description: attributes.description
                });

                // Write the blog post file
                const outputPath = path.join(PUBLIC_DIR, 'blog', filename.replace('.md', '.html'));
                await fs.writeFile(outputPath, postHtml);
                console.log(`Created blog post: ${outputPath}`);
            }
        }

        // Create blog index page
        const blogIndexContent = `
            <h1>Blog Posts</h1>
            <div class="posts-list">
                ${postsList
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(post => `
                        <article class="post-preview">
                            <h2><a href="${post.url}">${post.title}</a></h2>
                            <time datetime="${post.date}">${post.formattedDate}</time>
                            ${post.description ? `<p>${post.description}</p>` : ''}
                            ${post.tags ? `
                            <div class="tags">
                                ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                            </div>` : ''}
                        </article>
                    `).join('\n')}
            </div>
        `;

        // Write blog index page
        const blogIndexHtml = mainTemplate({
            content: blogIndexContent,
            title: 'Blog Posts',
            isPost: false
        });
        await fs.writeFile(path.join(PUBLIC_DIR, 'blog', 'index.html'), blogIndexHtml);

        // Skip generating index.html since we're managing it directly
        console.log('Skipping index.html generation - using direct file instead');

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build(); 