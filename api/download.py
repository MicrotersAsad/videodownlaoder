from flask import Flask, request, jsonify
import yt_dlp
import requests
import json
import re
import os
from urllib.parse import urlparse, parse_qs
import time
import random
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Bot detection bypass headers
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
]

def get_random_headers():
    """Generate random headers for bot detection bypass"""
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Sec-GPC': '1'
    }

def get_ydl_options(quality='720p'):
    """Get yt-dlp options with advanced bot detection bypass"""
    
    # Quality format selection
    format_selector = {
        'best': 'best[ext=mp4]/best',
        '1080p': 'best[height<=1080][ext=mp4]/best[height<=1080]',
        '720p': 'best[height<=720][ext=mp4]/best[height<=720]',
        '480p': 'best[height<=480][ext=mp4]/best[height<=480]',
        '360p': 'best[height<=360][ext=mp4]/best[height<=360]',
        'audio': 'bestaudio[ext=m4a]/bestaudio/best[ext=mp3]'
    }
    
    return {
        'format': format_selector.get(quality, format_selector['720p']),
        'http_headers': get_random_headers(),
        'sleep_interval': random.uniform(1, 4),
        'max_sleep_interval': 8,
        'sleep_interval_requests': random.uniform(0.5, 2),
        'ignoreerrors': True,
        'no_warnings': True,
        'extractaudio': quality == 'audio',
        'audioformat': 'mp3' if quality == 'audio' else None,
        'extract_flat': False,
        'writesubtitles': False,
        'writeautomaticsub': False,
        'socket_timeout': 30,
        'retries': 5,
        'fragment_retries': 5,
        'skip_unavailable_fragments': True,
        'keepvideo': False,
        'noplaylist': True,
        'cookiefile': None,
        'geo_bypass': True,
        'geo_bypass_country': 'US',
        'prefer_free_formats': True,
        'youtube_include_dash_manifest': False,
    }

@app.route('/api/download', methods=['POST'])
def download_video():
    """Main download endpoint"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        quality = data.get('quality', '720p')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Validate URL
        if not is_valid_url(url):
            return jsonify({'error': 'Invalid URL provided'}), 400
        
        # Anti-bot detection delay
        time.sleep(random.uniform(1, 3))
        
        # Get video info and download URL
        ydl_opts = get_ydl_options(quality)
        ydl_opts['quiet'] = True
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                # Extract video info
                info = ydl.extract_info(url, download=False)
                
                if not info:
                    return jsonify({'error': 'Could not extract video information'}), 400
                
                # Get the best format
                formats = info.get('formats', [])
                if not formats:
                    return jsonify({'error': 'No video formats found'}), 400
                
                # Find the best format based on quality
                selected_format = get_best_format(formats, quality)
                
                if not selected_format:
                    return jsonify({'error': 'No suitable format found'}), 400
                
                # Format file size
                filesize = selected_format.get('filesize') or selected_format.get('filesize_approx', 0)
                filesize_mb = round(filesize / (1024 * 1024), 2) if filesize else 0
                
                # Prepare response
                response_data = {
                    'success': True,
                    'title': clean_title(info.get('title', 'Unknown Title')),
                    'duration': format_duration(info.get('duration', 0)),
                    'uploader': info.get('uploader', 'Unknown'),
                    'view_count': format_number(info.get('view_count', 0)),
                    'thumbnail': info.get('thumbnail', ''),
                    'download_url': selected_format.get('url', ''),
                    'format': {
                        'ext': selected_format.get('ext', 'mp4'),
                        'quality': get_quality_label(selected_format, quality),
                        'filesize': f"{filesize_mb} MB" if filesize_mb > 0 else "Unknown",
                        'fps': selected_format.get('fps', 0),
                        'vcodec': selected_format.get('vcodec', 'unknown'),
                        'acodec': selected_format.get('acodec', 'unknown'),
                        'resolution': f"{selected_format.get('width', 0)}x{selected_format.get('height', 0)}"
                    },
                    'platform': get_platform_name(url)
                }
                
                return jsonify(response_data)
                
            except Exception as e:
                error_msg = str(e)
                if 'Sign in to confirm' in error_msg:
                    return jsonify({'error': 'Video requires sign-in or is age-restricted'}), 400
                elif 'Private video' in error_msg:
                    return jsonify({'error': 'This video is private'}), 400
                elif 'Video unavailable' in error_msg:
                    return jsonify({'error': 'Video is unavailable'}), 400
                else:
                    return jsonify({'error': f'Failed to process video: {error_msg}'}), 500
                
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/info', methods=['POST'])
def get_video_info():
    """Get video information without downloading"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        if not is_valid_url(url):
            return jsonify({'error': 'Invalid URL provided'}), 400
        
        # Anti-bot detection
        time.sleep(random.uniform(0.5, 1.5))
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'http_headers': get_random_headers(),
            'socket_timeout': 30,
            'extract_flat': False,
            'geo_bypass': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if not info:
                return jsonify({'error': 'Could not extract video information'}), 400
            
            # Get available formats
            formats = info.get('formats', [])
            available_qualities = get_available_qualities(formats)
            
            description = info.get('description', '')
            description_preview = description[:200] + '...' if len(description) > 200 else description
            
            response_data = {
                'success': True,
                'title': clean_title(info.get('title', 'Unknown Title')),
                'duration': format_duration(info.get('duration', 0)),
                'uploader': info.get('uploader', 'Unknown'),
                'view_count': format_number(info.get('view_count', 0)),
                'thumbnail': info.get('thumbnail', ''),
                'description': description_preview,
                'upload_date': format_date(info.get('upload_date', '')),
                'available_qualities': available_qualities,
                'platform': get_platform_name(url),
                'webpage_url': info.get('webpage_url', url)
            }
            
            return jsonify(response_data)
            
    except Exception as e:
        return jsonify({'error': f'Failed to get video info: {str(e)}'}), 500

@app.route('/api/supported-sites', methods=['GET'])
def get_supported_sites():
    """Get list of supported sites"""
    supported_sites = [
        'YouTube', 'TikTok', 'Instagram', 'Twitter/X', 'Facebook', 
        'Vimeo', 'Dailymotion', 'Twitch', 'Reddit', 'LinkedIn',
        'Pinterest', 'Snapchat', 'WhatsApp Status', 'Telegram',
        'VK', 'OK.ru', 'Bilibili', 'Douyin', 'Kuaishou'
    ]
    
    return jsonify({
        'success': True,
        'sites': supported_sites,
        'total': len(supported_sites)
    })

def is_valid_url(url):
    """Validate URL format"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

def get_platform_name(url):
    """Get platform name from URL"""
    domain = urlparse(url).netloc.lower()
    if 'youtube.com' in domain or 'youtu.be' in domain:
        return 'YouTube'
    elif 'tiktok.com' in domain:
        return 'TikTok'
    elif 'instagram.com' in domain:
        return 'Instagram'
    elif 'twitter.com' in domain or 'x.com' in domain:
        return 'Twitter/X'
    elif 'facebook.com' in domain or 'fb.watch' in domain:
        return 'Facebook'
    elif 'vimeo.com' in domain:
        return 'Vimeo'
    elif 'dailymotion.com' in domain:
        return 'Dailymotion'
    elif 'twitch.tv' in domain:
        return 'Twitch'
    elif 'reddit.com' in domain:
        return 'Reddit'
    elif 'linkedin.com' in domain:
        return 'LinkedIn'
    elif 'pinterest.com' in domain:
        return 'Pinterest'
    elif 'snapchat.com' in domain:
        return 'Snapchat'
    elif 'vk.com' in domain:
        return 'VK'
    elif 'ok.ru' in domain:
        return 'OK.ru'
    elif 'bilibili.com' in domain:
        return 'Bilibili'
    else:
        return 'Unknown Platform'

def get_best_format(formats, quality):
    """Get the best format based on quality preference"""
    if quality == 'audio':
        # Get best audio format
        audio_formats = [f for f in formats if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
        if audio_formats:
            return max(audio_formats, key=lambda x: x.get('abr', 0))
        # If no audio-only format, get best overall format
        return max(formats, key=lambda x: x.get('abr', 0))
    
    # Filter video formats
    video_formats = [f for f in formats if f.get('vcodec') != 'none']
    if not video_formats:
        return formats[0] if formats else None
    
    # Quality mapping
    quality_map = {
        'best': 9999,
        '1080p': 1080,
        '720p': 720,
        '480p': 480,
        '360p': 360
    }
    
    target_height = quality_map.get(quality, 720)
    
    # Find best format within quality range
    suitable_formats = []
    for fmt in video_formats:
        height = fmt.get('height', 0)
        if height and height <= target_height:
            suitable_formats.append(fmt)
    
    if not suitable_formats:
        # If no suitable format found, return the lowest quality available
        return min(video_formats, key=lambda x: x.get('height', 0))
    
    # Return the highest quality within the range
    return max(suitable_formats, key=lambda x: (x.get('height', 0), x.get('fps', 0)))

def get_quality_label(format_info, requested_quality):
    """Get quality label for format"""
    if requested_quality == 'audio':
        return 'Audio Only'
    
    height = format_info.get('height', 0)
    if height >= 1080:
        return '1080p'
    elif height >= 720:
        return '720p'
    elif height >= 480:
        return '480p'
    elif height >= 360:
        return '360p'
    else:
        return 'Low Quality'

def get_available_qualities(formats):
    """Get list of available qualities"""
    qualities = set()
    
    # Check for audio formats
    audio_formats = [f for f in formats if f.get('acodec') != 'none']
    if audio_formats:
        qualities.add('audio')
    
    # Check for video formats
    for fmt in formats:
        if fmt.get('vcodec') == 'none':
            continue
            
        height = fmt.get('height', 0)
        if height >= 1080:
            qualities.add('1080p')
        elif height >= 720:
            qualities.add('720p')
        elif height >= 480:
            qualities.add('480p')
        elif height >= 360:
            qualities.add('360p')
    
    # Sort qualities
    quality_order = ['best', '1080p', '720p', '480p', '360p', 'audio']
    return [q for q in quality_order if q in qualities]

def clean_title(title):
    """Clean video title"""
    # Remove invalid characters for filename
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        title = title.replace(char, '')
    return title.strip()

def format_duration(seconds):
    """Format duration in human readable format"""
    if not seconds:
        return "Unknown"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    seconds = seconds % 60
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes}:{seconds:02d}"

def format_number(num):
    """Format large numbers"""
    if not num:
        return "0"
    
    if num >= 1000000:
        return f"{num/1000000:.1f}M"
    elif num >= 1000:
        return f"{num/1000:.1f}K"
    else:
        return str(num)

def format_date(date_str):
    """Format upload date"""
    if not date_str:
        return "Unknown"
    
    try:
        # Convert YYYYMMDD to readable format
        year = date_str[:4]
        month = date_str[4:6]
        day = date_str[6:8]
        return f"{day}/{month}/{year}"
    except:
        return date_str

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'Video Downloader API',
        'version': '1.0.0'
    })

# For Vercel deployment
def handler(request):
    return app(request)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)