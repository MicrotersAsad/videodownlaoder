// Global variables
let selectedQuality = '720p';
let currentVideoInfo = null;
let isProcessing = false;

// API base URL - update this to your backend URL
const API_BASE_URL = 'https://videodownlaoder.vercel.app/api';

// DOM elements
const videoUrlInput = document.getElementById('videoUrl');
const videoInfoDiv = document.getElementById('videoInfo');
const progressSection = document.querySelector('.progress-section');
const progressFill = document.getElementById('progressFill');
const statusMessage = document.getElementById('statusMessage');
const downloadSection = document.getElementById('downloadSection');
const qualitySelector = document.getElementById('qualitySelector');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Set up event listeners
    setupEventListeners();
    
    // Load supported sites
    loadSupportedSites();
    
    // Check for URL in clipboard on page load
    checkClipboardForUrl();
}

function setupEventListeners() {
    // URL input listeners
    videoUrlInput.addEventListener('input', validateUrl);
    videoUrlInput.addEventListener('paste', handlePaste);
    
    // Quality selector listeners
    qualitySelector.addEventListener('click', handleQualitySelection);
    
    // Enter key support
    videoUrlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (videoUrlInput.value.trim()) {
                getVideoInfo();
            }
        }
    });
    
    // Auto-resize textarea if needed
    videoUrlInput.addEventListener('input', autoResizeInput);
}

function autoResizeInput() {
    const input = videoUrlInput;
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
}

function validateUrl() {
    const url = videoUrlInput.value.trim();
    const isValid = isValidUrl(url);
    
    if (url && !isValid) {
        showError('Please enter a valid URL');
        return false;
    }
    
    hideError();
    return true;
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function handlePaste(e) {
    setTimeout(() => {
        validateUrl();
    }, 100);
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (text && isValidUrl(text)) {
            videoUrlInput.value = text;
            showSuccess('URL pasted successfully!');
            validateUrl();
        } else {
            showError('No valid URL found in clipboard');
        }
    } catch (err) {
        showError('Unable to access clipboard. Please paste manually.');
    }
}

function handleQualitySelection(e) {
    if (e.target.classList.contains('quality-btn')) {
        // Remove selected class from all buttons
        qualitySelector.querySelectorAll('.quality-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Add selected class to clicked button
        e.target.classList.add('selected');
        
        // Update selected quality
        selectedQuality = e.target.dataset.quality;
        
        // Add visual feedback
        e.target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            e.target.style.transform = '';
        }, 150);
    }
}

async function getVideoInfo() {
    const url = videoUrlInput.value.trim();
    
    if (!url) {
        showError('Please enter a video URL');
        return;
    }
    
    if (!isValidUrl(url)) {
        showError('Please enter a valid URL');
        return;
    }
    
    if (isProcessing) {
        return;
    }
    
    isProcessing = true;
    setButtonLoading('infoText', 'Getting info...');
    hideError();
    hideVideoInfo();
    hideDownloadSection();
    
    try {
        const response = await fetch(`${API_BASE_URL}/info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentVideoInfo = data;
            displayVideoInfo(data);
            updateQualityOptions(data.available_qualities);
            showSuccess('Video information loaded successfully!');
        } else {
            showError(data.error || 'Failed to get video information');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to connect to server. Please try again.');
    } finally {
        isProcessing = false;
        resetButtonLoading('infoText', 'ℹ️ Get Info');
    }
}

function displayVideoInfo(info) {
    // Update thumbnail
    const thumbnail = document.getElementById('videoThumbnail');
    thumbnail.src = info.thumbnail || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225"><rect width="400" height="225" fill="%23f0f0f0"/><text x="200" y="112" text-anchor="middle" font-family="Arial" font-size="16" fill="%23999">No thumbnail</text></svg>';
    thumbnail.onerror = () => {
        thumbnail.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225"><rect width="400" height="225" fill="%23f0f0f0"/><text x="200" y="112" text-anchor="middle" font-family="Arial" font-size="16" fill="%23999">No thumbnail</text></svg>';
    };
    
    // Update video details
    document.getElementById('videoTitle').textContent = info.title || 'Unknown Title';
    document.getElementById('videoPlatform').textContent = info.platform || 'Unknown Platform';
    document.getElementById('videoDuration').textContent = info.duration || 'Unknown';
    document.getElementById('videoUploader').textContent = info.uploader || 'Unknown';
    document.getElementById('videoViews').textContent = info.view_count || '0';
    document.getElementById('videoDate').textContent = info.upload_date || 'Unknown';
    document.getElementById('videoDescription').textContent = info.description || 'No description available';
    
    // Show video info section
    showVideoInfo();
}

function updateQualityOptions(availableQualities) {
    if (!availableQualities || availableQualities.length === 0) {
        return;
    }
    
    // Clear existing options
    qualitySelector.innerHTML = '';
    
    // Add available quality options
    availableQualities.forEach((quality, index) => {
        const btn = document.createElement('div');
        btn.className = 'quality-btn';
        btn.dataset.quality = quality;
        btn.textContent = getQualityLabel(quality);
        
        // Select default quality or first available
        if (quality === selectedQuality || (index === 0 && !availableQualities.includes(selectedQuality))) {
            btn.classList.add('selected');
            selectedQuality = quality;
        }
        
        qualitySelector.appendChild(btn);
    });
}

function getQualityLabel(quality) {
    const labels = {
        'best': 'Best',
        '1080p': '1080p HD',
        '720p': '720p HD',
        '480p': '480p',
        '360p': '360p',
        'audio': 'Audio Only'
    };
    return labels[quality] || quality;
}

async function downloadVideo() {
    const url = videoUrlInput.value.trim();
    
    if (!url) {
        showError('Please enter a video URL');
        return;
    }
    
    if (!isValidUrl(url)) {
        showError('Please enter a valid URL');
        return;
    }
    
    if (isProcessing) {
        return;
    }
    
    isProcessing = true;
    setButtonLoading('downloadText', 'Processing...');
    hideError();
    hideDownloadSection();
    showProgressSection();
    
    try {
        // Simulate progress updates
        updateProgress(10, 'Analyzing video...');
        
        const response = await fetch(`${API_BASE_URL}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                url: url, 
                quality: selectedQuality 
            })
        });
        
        updateProgress(50, 'Processing video...');
        
        const data = await response.json();
        
        if (data.success) {
            updateProgress(100, 'Download ready!');
            
            setTimeout(() => {
                hideProgressSection();
                displayDownloadSection(data);
                showSuccess('Video is ready for download!');
            }, 1000);
        } else {
            throw new Error(data.error || 'Failed to process video');
        }
    } catch (error) {
        console.error('Error:', error);
        hideProgressSection();
        showError(error.message || 'Failed to process video. Please try again.');
    } finally {
        isProcessing = false;
        resetButtonLoading('downloadText', '📥 Download');
    }
}

function displayDownloadSection(data) {
    // Update download information
    document.getElementById('dlTitle').textContent = data.title || 'Unknown Title';
    document.getElementById('dlFormat').textContent = data.format?.ext?.toUpperCase() || 'MP4';
    document.getElementById('dlQuality').textContent = data.format?.quality || selectedQuality;
    document.getElementById('dlSize').textContent = data.format?.filesize || 'Unknown';
    
    // Set download link
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = data.download_url;
    downloadLink.download = `${data.title || 'video'}.${data.format?.ext || 'mp4'}`;
    
    // Show download section
    showDownloadSection();
    
    // Auto-start download
    setTimeout(() => {
        downloadLink.click();
    }, 500);
}

function updateProgress(percentage, message) {
    progressFill.style.width = percentage + '%';
    statusMessage.textContent = message;
    
    // Add pulse effect at certain milestones
    if (percentage === 100) {
        progressFill.style.background = 'linear-gradient(90deg, #38a169, #48bb78)';
    }
}

function setButtonLoading(buttonId, text) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.innerHTML = `<span class="loading">⏳ ${text}</span>`;
        button.closest('.btn').disabled = true;
        button.closest('.btn').classList.add('loading');
    }
}

function resetButtonLoading(buttonId, originalText) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.innerHTML = originalText;
        button.closest('.btn').disabled = false;
        button.closest('.btn').classList.remove('loading');
    }
}

function showVideoInfo() {
    videoInfoDiv.style.display = 'block';
    videoInfoDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideVideoInfo() {
    videoInfoDiv.style.display = 'none';
}

function showProgressSection() {
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    statusMessage.textContent = 'Preparing...';
    progressSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideProgressSection() {
    progressSection.style.display = 'none';
}

function showDownloadSection() {
    downloadSection.style.display = 'block';
    downloadSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideDownloadSection() {
    downloadSection.style.display = 'none';
}

function showError(message) {
    hideError();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `❌ ${message}`;
    
    const inputSection = document.querySelector('.input-section');
    inputSection.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

function showSuccess(message) {
    hideError();
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = `✅ ${message}`;
    
    const inputSection = document.querySelector('.input-section');
    inputSection.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        hideError();
    }, 3000);
}

function hideError() {
    const errorMessage = document.querySelector('.error-message');
    const successMessage = document.querySelector('.success-message');
    
    if (errorMessage) {
        errorMessage.remove();
    }
    
    if (successMessage) {
        successMessage.remove();
    }
}

// async function loadSupportedSites() {
//     try {
//         const response = await fetch(`${API_BASE_URL}/supported-sites`);
//         const data = await response.json();
        
//         if (data.success) {
//             updateSupportedSites(data.sites);
//         }
//     } catch (error) {
//         console.error('Error loading supported sites:', error);
//     }
// }

// function updateSupportedSites(sites) {
//     const sitesContainer = document.getElementById('supportedSites');
//     if (!sitesContainer) return;
    
//     sitesContainer.innerHTML = '';
    
//     sites.forEach(site => {
//         const siteTag = document.createElement('span');
//         siteTag.className = 'site-tag';
//         siteTag.textContent = site;
//         sitesContainer.appendChild(siteTag);
//     });
    
//     // Add "And more..." tag
//     const moreTag = document.createElement('span');
//     moreTag.className = 'site-tag';
//     moreTag.textContent = 'And 1000+ more!';
//     moreTag.style.background = 'rgba(255, 255, 255, 0.3)';
//     moreTag.style.fontWeight = 'bold';
//     sitesContainer.appendChild(moreTag);
// }

async function checkClipboardForUrl() {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text && isValidUrl(text) && isSupportedPlatform(text)) {
                showClipboardSuggestion(text);
            }
        }
    } catch (error) {
        // Clipboard access denied or not supported
        console.log('Clipboard access not available');
    }
}

function isSupportedPlatform(url) {
    const supportedDomains = [
        'youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com',
        'twitter.com', 'x.com', 'facebook.com', 'fb.watch',
        'vimeo.com', 'dailymotion.com', 'twitch.tv', 'reddit.com',
        'linkedin.com', 'pinterest.com', 'snapchat.com', 'vk.com',
        'ok.ru', 'bilibili.com'
    ];
    
    try {
        const domain = new URL(url).hostname.toLowerCase();
        return supportedDomains.some(supported => domain.includes(supported));
    } catch {
        return false;
    }
}

function showClipboardSuggestion(url) {
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'clipboard-suggestion';
    suggestionDiv.innerHTML = `
        <div style="background: rgba(102, 126, 234, 0.1); padding: 15px; border-radius: 10px; margin: 10px 0; border-left: 4px solid #667eea;">
            <p style="margin: 0 0 10px 0; color: #667eea; font-weight: 500;">
                📋 Found video URL in clipboard!
            </p>
            <p style="margin: 0 0 15px 0; color: #666; font-size: 0.9em; word-break: break-all;">
                ${url}
            </p>
            <div style="display: flex; gap: 10px;">
                <button onclick="useClipboardUrl('${url}')" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                    Use This URL
                </button>
                <button onclick="dismissClipboardSuggestion()" style="padding: 8px 16px; background: #f5f5f5; color: #666; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                    Dismiss
                </button>
            </div>
        </div>
    `;
    
    const inputSection = document.querySelector('.input-section');
    inputSection.insertBefore(suggestionDiv, inputSection.firstChild);
}

function useClipboardUrl(url) {
    videoUrlInput.value = url;
    dismissClipboardSuggestion();
    validateUrl();
    showSuccess('URL loaded from clipboard!');
}

function dismissClipboardSuggestion() {
    const suggestion = document.querySelector('.clipboard-suggestion');
    if (suggestion) {
        suggestion.remove();
    }
}

// Platform-specific URL helpers
function getPlatformInfo(url) {
    const platforms = {
        'youtube.com': { name: 'YouTube', icon: '🎬', color: '#FF0000' },
        'youtu.be': { name: 'YouTube', icon: '🎬', color: '#FF0000' },
        'tiktok.com': { name: 'TikTok', icon: '🎵', color: '#000000' },
        'instagram.com': { name: 'Instagram', icon: '📸', color: '#E4405F' },
        'twitter.com': { name: 'Twitter', icon: '🐦', color: '#1DA1F2' },
        'x.com': { name: 'X', icon: '❌', color: '#000000' },
        'facebook.com': { name: 'Facebook', icon: '👥', color: '#1877F2' },
        'vimeo.com': { name: 'Vimeo', icon: '🎭', color: '#1AB7EA' },
        'twitch.tv': { name: 'Twitch', icon: '🎮', color: '#9146FF' },
        'reddit.com': { name: 'Reddit', icon: '🔴', color: '#FF4500' }
    };
    
    try {
        const domain = new URL(url).hostname.toLowerCase();
        for (const [key, value] of Object.entries(platforms)) {
            if (domain.includes(key)) {
                return value;
            }
        }
    } catch {
        // Invalid URL
    }
    
    return { name: 'Unknown', icon: '🌐', color: '#666666' };
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + V to focus input and paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && document.activeElement !== videoUrlInput) {
        e.preventDefault();
        videoUrlInput.focus();
        setTimeout(() => {
            pasteFromClipboard();
        }, 100);
    }
    
    // Ctrl/Cmd + Enter to download
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (videoUrlInput.value.trim()) {
            downloadVideo();
        }
    }
    
    // Escape to clear input
    if (e.key === 'Escape') {
        clearAll();
    }
});

function clearAll() {
    videoUrlInput.value = '';
    hideVideoInfo();
    hideProgressSection();
    hideDownloadSection();
    hideError();
    currentVideoInfo = null;
    
    // Reset quality selector
    qualitySelector.querySelectorAll('.quality-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    const defaultQuality = qualitySelector.querySelector('[data-quality="720p"]');
    if (defaultQuality) {
        defaultQuality.classList.add('selected');
        selectedQuality = '720p';
    }
}

// URL validation and formatting
function formatUrl(url) {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // Handle youtu.be URLs
    if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1].split('?')[0];
        url = `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    // Handle mobile URLs
    url = url.replace('m.youtube.com', 'www.youtube.com');
    url = url.replace('m.tiktok.com', 'www.tiktok.com');
    
    return url;
}

// Download progress tracking
function trackDownload(downloadUrl, filename) {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Track download analytics (if needed)
    console.log('Download started:', filename);
}

// Error handling and recovery
function handleApiError(error, context) {
    console.error(`API Error in ${context}:`, error);
    
    let userMessage = 'An error occurred. Please try again.';
    
    if (error.message.includes('Network Error')) {
        userMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message.includes('timeout')) {
        userMessage = 'Request timed out. Please try again.';
    } else if (error.message.includes('Rate limit')) {
        userMessage = 'Too many requests. Please wait a moment and try again.';
    }
    
    showError(userMessage);
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Performance optimization
const debouncedValidateUrl = debounce(validateUrl, 300);
videoUrlInput.addEventListener('input', debouncedValidateUrl);

// // Service worker registration (for offline support)
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', function() {
//         navigator.serviceWorker.register('/sw.js')
//             .then(function(registration) {
//                 console.log('SW registered: ', registration);
//             })
//             .catch(function(registrationError) {
//                 console.log('SW registration failed: ', registrationError);
//             });
//     });
// }

// Analytics and tracking (optional)
function trackEvent(eventName, data = {}) {
    console.log('Event tracked:', eventName, data);
    // Add your analytics tracking code here
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateUrl,
        isValidUrl,
        formatUrl,
        getPlatformInfo,
        isSupportedPlatform
    };
}