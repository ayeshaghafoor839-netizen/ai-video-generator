// Smooth scroll to generator
function scrollToGenerator() {
    document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
}

// YouTube checkbox toggle
document.getElementById('uploadToYoutube').addEventListener('change', function() {
    const credentials = document.getElementById('youtubeCredentials');
    credentials.style.display = this.checked ? 'block' : 'none';
});

// FAQ Accordion
document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('click', function() {
        this.classList.toggle('active');
    });
});

// Mobile Menu
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
});

// Form Submission
document.getElementById('videoForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Get form data
    const formData = {
        title: document.getElementById('videoTitle').value,
        prompt: document.getElementById('videoPrompt').value,
        duration: document.getElementById('videoDuration').value,
        style: document.getElementById('videoStyle').value,
        voice: document.getElementById('voiceType').value,
        music: document.getElementById('musicType').value,
        uploadToYoutube: document.getElementById('uploadToYoutube').checked,
        youtubeData: {
            title: document.getElementById('youtubeTitle').value,
            description: document.getElementById('youtubeDescription').value,
            privacy: document.getElementById('youtubePrivacy').value
        }
    };

    // Show processing UI
    showProcessing();

    try {
        // Call backend API to generate video
        const response = await generateVideo(formData);
        
        if (response.success) {
            showDownloadSection(response.data);
            
            // If YouTube upload selected, upload the video
            if (formData.uploadToYoutube) {
                await uploadToYoutubeBackend(response.data.videoId, formData.youtubeData);
            }
        } else {
            showError(response.error);
        }
    } catch (error) {
        showError('An error occurred: ' + error.message);
    }
});

// Show processing status
function showProcessing() {
    document.getElementById('previewContent').style.display = 'none';
    document.getElementById('statusBox').style.display = 'block';
    document.getElementById('downloadSection').style.display = 'none';
    
    // Simulate progress
    animateProgress();
}

// Animate progress bar
function animateProgress() {
    let progress = 0;
    const progressFill = document.getElementById('progressFill');
    const statusMessage = document.getElementById('statusMessage');
    
    const messages = [
        'Analyzing your prompt...',
        'Generating video scenes...',
        'Creating visual effects...',
        'Generating voice narration...',
        'Adding background music...',
        'Rendering final video...',
        'Almost done...'
    ];
    
    const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 100) progress = 100;
        
        progressFill.style.width = progress + '%';
        
        const messageIndex = Math.floor((progress / 100) * (messages.length - 1));
        statusMessage.textContent = messages[messageIndex];
        
        if (progress >= 100) {
            clearInterval(interval);
        }
    }, 800);
}

// Generate Video (Mock API call)
async function generateVideo(formData) {
    // This would connect to your backend API
    // For now, we'll simulate the response
    
    return new Promise((resolve) => {
        setTimeout(() => {
            const videoData = {
                success: true,
                data: {
                    videoId: 'video_' + Date.now(),
                    title: formData.title,
                    duration: formData.duration,
                    url: 'https://example.com/videos/sample.mp4',
                    thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="225"%3E%3Crect fill="%236366f1" width="400" height="225"/%3E%3Ctext x="50%" y="50%" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle"%3EYour AI Video%3C/text%3E%3C/svg%3E'
                }
            };
            resolve(videoData);
        }, 3000);
    });
}

// Show download section
function showDownloadSection(videoData) {
    document.getElementById('statusBox').style.display = 'none';
    document.getElementById('downloadSection').style.display = 'block';
    
    // Show thumbnail in preview
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = `<img src="${videoData.thumbnail}" style="width: 100%; border-radius: 0.5rem;" alt="Video Thumbnail">`;
    previewContent.style.display = 'block';
    
    // Fill in result info
    document.getElementById('resultTitle').textContent = videoData.title;
    document.getElementById('resultDuration').textContent = videoData.duration + ' seconds';
    
    // Store video data for download/upload
    window.currentVideo = videoData;
}

// Download Video
function downloadVideo() {
    if (!window.currentVideo) return;
    
    // Create a temporary link and trigger download
    const a = document.createElement('a');
    a.href = window.currentVideo.url;
    a.download = window.currentVideo.title.replace(/\s+/g, '_') + '.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showSuccess('Video downloaded successfully!');
}

// Upload to YouTube
async function uploadToYoutubeBackend(videoId, youtubeData) {
    try {
        // First, authenticate with YouTube
        const authResponse = await authenticateYoutube();
        
        if (!authResponse.success) {
            showError('YouTube authentication failed');
            return;
        }
        
        // Then upload the video
        const uploadResponse = await fetch('/api/youtube/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authResponse.token
            },
            body: JSON.stringify({
                videoId: videoId,
                title: youtubeData.title,
                description: youtubeData.description,
                privacy: youtubeData.privacy
            })
        });
        
        if (uploadResponse.ok) {
            const result = await uploadResponse.json();
            showSuccess('Video uploaded to YouTube successfully! Video ID: ' + result.youtubeVideoId);
        } else {
            showError('Failed to upload to YouTube');
        }
    } catch (error) {
        showError('YouTube upload error: ' + error.message);
    }
}

// YouTube Authentication
async function authenticateYoutube() {
    // This would open OAuth flow
    return new Promise((resolve) => {
        // Mock authentication
        setTimeout(() => {
            resolve({
                success: true,
                token: 'mock_token_' + Date.now()
            });
        }, 1000);
    });
}

// Upload function wrapper
async function uploadToYouTube() {
    if (!window.currentVideo) return;
    
    const youtubeData = {
        title: document.getElementById('youtubeTitle').value || window.currentVideo.title,
        description: document.getElementById('youtubeDescription').value || 'Created with AI Video Generator',
        privacy: document.getElementById('youtubePrivacy').value || 'public'
    };
    
    await uploadToYoutubeBackend(window.currentVideo.videoId, youtubeData);
}

// Show success message
function showSuccess(message) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) existingAlert.remove();
    
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.innerHTML = `
        <i class="fas fa-check-circle"></i> ${message}
    `;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 3000);
}

// Show error message
function showError(message) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) existingAlert.remove();
    
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
    alert.innerHTML = `
        <i class="fas fa-exclamation-circle"></i> ${message}
    `;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(alert);
    
    // Reset UI
    document.getElementById('statusBox').style.display = 'none';
    document.getElementById('previewContent').style.display = 'block';
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .alert {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
    }
`;
document.head.appendChild(style);

// Initialize
console.log('AI Video Generator initialized successfully!');
