/**
 * AI Video Generator Backend Server
 * Handles video generation, sound synthesis, and YouTube upload
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { google } = require('googleapis');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// File upload configuration
const upload = multer({ dest: 'uploads/' });

// Routes

// ============================================
// 1. VIDEO GENERATION ENDPOINT
// ============================================
app.post('/api/generate-video', async (req, res) => {
    try {
        const { title, prompt, duration, style, voice, music } = req.body;

        // Validate input
        if (!title || !prompt || !duration) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Call AI Video Generation API (Using Runway ML or similar)
        const videoResponse = await generateAIVideo({
            prompt,
            duration: parseInt(duration),
            style,
            model: 'runway-ml' // You can change this to your preferred API
        });

        if (!videoResponse.success) {
            return res.status(500).json({ error: 'Failed to generate video' });
        }

        // Generate narration/sound
        const audioResponse = await generateAudio({
            prompt,
            voice,
            music
        });

        if (!audioResponse.success) {
            return res.status(500).json({ error: 'Failed to generate audio' });
        }

        // Combine video and audio
        const finalVideo = await combineVideoAudio(
            videoResponse.videoPath,
            audioResponse.audioPath
        );

        res.json({
            success: true,
            data: {
                videoId: 'video_' + Date.now(),
                title: title,
                duration: duration,
                videoPath: finalVideo.path,
                videoUrl: `/videos/${finalVideo.filename}`
            }
        });
    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 2. AUDIO/SOUND GENERATION ENDPOINT
// ============================================
app.post('/api/generate-audio', async (req, res) => {
    try {
        const { prompt, voice, music } = req.body;

        // Generate text-to-speech narration
        const narration = await generateTextToSpeech(prompt, voice);

        // Generate background music
        const bgMusic = await generateBackgroundMusic(music);

        // Mix audio tracks
        const mixedAudio = await mixAudioTracks(narration.path, bgMusic.path);

        res.json({
            success: true,
            data: {
                audioPath: mixedAudio.path,
                audioUrl: `/audio/${mixedAudio.filename}`
            }
        });
    } catch (error) {
        console.error('Audio generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 3. YOUTUBE UPLOAD ENDPOINT
// ============================================
app.post('/api/youtube/upload', async (req, res) => {
    try {
        const { videoPath, title, description, privacy } = req.body;
        const accessToken = req.headers.authorization?.split(' ')[1];

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token provided' });
        }

        // Upload to YouTube
        const uploadResult = await uploadToYouTube({
            videoPath,
            title,
            description,
            privacyStatus: privacy || 'public',
            accessToken
        });

        res.json({
            success: true,
            data: {
                youtubeVideoId: uploadResult.id,
                youtubeUrl: `https://youtube.com/watch?v=${uploadResult.id}`
            }
        });
    } catch (error) {
        console.error('YouTube upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 4. YOUTUBE AUTHENTICATION ENDPOINT
// ============================================
app.post('/api/youtube/auth', async (req, res) => {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/youtube.upload'],
        });

        res.json({ authUrl });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 5. YOUTUBE CALLBACK ENDPOINT
// ============================================
app.get('/api/youtube/callback', async (req, res) => {
    try {
        const { code } = req.query;

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        res.json({
            success: true,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token
        });
    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 6. DOWNLOAD VIDEO ENDPOINT
// ============================================
app.get('/api/download/:videoId', (req, res) => {
    try {
        const { videoId } = req.params;
        const videoPath = path.join(__dirname, 'videos', `${videoId}.mp4`);

        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.download(videoPath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate AI Video using Runway ML API
 */
async function generateAIVideo(options) {
    try {
        // Using Runway ML API
        const response = await axios.post('https://api.runwayml.com/v1/video_generation', {
            prompt: options.prompt,
            duration: options.duration,
            style: options.style,
            model: 'Gen2'
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Poll for video completion
        const videoPath = await pollForCompletion(response.data.task_id);

        return {
            success: true,
            videoPath: videoPath
        };
    } catch (error) {
        console.error('AI video generation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate Text-to-Speech narration
 */
async function generateTextToSpeech(text, voiceType) {
    try {
        // Using Google Cloud Text-to-Speech or ElevenLabs
        const response = await axios.post('https://api.elevenlabs.io/v1/text-to-speech', {
            text: text,
            voice_id: getVoiceId(voiceType),
            model_id: 'eleven_monolingual_v1'
        }, {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            }
        });

        const audioPath = path.join(__dirname, 'temp', `narration_${Date.now()}.mp3`);
        await fs.promises.writeFile(audioPath, response.data);

        return {
            success: true,
            path: audioPath
        };
    } catch (error) {
        console.error('TTS error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate background music
 */
async function generateBackgroundMusic(musicType) {
    try {
        // Using Soundraw API or similar
        const response = await axios.post('https://api.soundraw.io/generate', {
            mood: musicType,
            duration: 30,
            genre: 'cinematic'
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.SOUNDRAW_API_KEY}`
            }
        });

        const musicPath = path.join(__dirname, 'temp', `music_${Date.now()}.mp3`);
        await fs.promises.writeFile(musicPath, response.data);

        return {
            success: true,
            path: musicPath
        };
    } catch (error) {
        console.error('Music generation error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mix audio tracks (narration + music)
 */
async function mixAudioTracks(narrationPath, musicPath) {
    try {
        const ffmpeg = require('fluent-ffmpeg');
        const outputPath = path.join(__dirname, 'temp', `mixed_${Date.now()}.mp3`);

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(narrationPath)
                .input(musicPath)
                .audioFilter('amix=inputs=2:duration=first')
                .save(outputPath)
                .on('end', () => {
                    resolve({ path: outputPath });
                })
                .on('error', reject);
        });
    } catch (error) {
        console.error('Audio mixing error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Combine video and audio
 */
async function combineVideoAudio(videoPath, audioPath) {
    try {
        const ffmpeg = require('fluent-ffmpeg');
        const outputPath = path.join(__dirname, 'public', 'videos', `final_${Date.now()}.mp4`);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(outputPath))) {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        }

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoPath)
                .input(audioPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .output(outputPath)
                .on('end', () => {
                    resolve({
                        path: outputPath,
                        filename: path.basename(outputPath)
                    });
                })
                .on('error', reject)
                .run();
        });
    } catch (error) {
        console.error('Video combining error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Upload video to YouTube
 */
async function uploadToYouTube(options) {
    try {
        const youtube = google.youtube({
            version: 'v3',
            auth: options.accessToken
        });

        const fileSize = fs.statSync(options.videoPath).size;
        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: options.title,
                    description: options.description,
                    tags: ['AI', 'Video', 'Generated']
                },
                status: {
                    privacyStatus: options.privacyStatus
                }
            },
            media: {
                body: fs.createReadStream(options.videoPath),
                mimeType: 'video/mp4'
            }
        });

        return {
            id: response.data.id,
            url: `https://youtube.com/watch?v=${response.data.id}`
        };
    } catch (error) {
        console.error('YouTube upload error:', error);
        throw error;
    }
}

/**
 * Get voice ID based on voice type
 */
function getVoiceId(voiceType) {
    const voiceMap = {
        'male-professional': '21m00Tcm4TlvDq8ikWAM',
        'female-professional': 'EXAVITQu4vr4xnSDxMaL',
        'male-casual': 'XrExE9yKIg1WjnnlVkGX',
        'female-casual': 'TxGEqnHWrfWFTfLEVXVw',
        'narrator': 'cgSgspJ2msLfdFcVK3QZ'
    };
    return voiceMap[voiceType] || voiceMap['male-professional'];
}

/**
 * Poll for video generation completion
 */
async function pollForCompletion(taskId) {
    return new Promise((resolve, reject) => {
        const maxAttempts = 60;
        let attempts = 0;

        const poll = async () => {
            try {
                const response = await axios.get(
                    `https://api.runwayml.com/v1/tasks/${taskId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`
                        }
                    }
                );

                if (response.data.status === 'completed') {
                    resolve(response.data.output[0].url);
                } else if (response.data.status === 'failed') {
                    reject(new Error('Video generation failed'));
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(poll, 5000);
                } else {
                    reject(new Error('Video generation timeout'));
                }
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
}

// ============================================
// ERROR HANDLING & SERVER START
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Create necessary directories
const dirs = ['temp', 'public/videos', 'uploads'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎬 AI Video Generator Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
