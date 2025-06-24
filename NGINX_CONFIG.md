# Nginx Configuration for Large File Uploads

To fix the "413 Request Entity Too Large" error for the compression endpoint, you need to increase the `client_max_body_size` in your nginx configuration.

## Configuration Steps

1. Edit your nginx configuration file (usually `/etc/nginx/nginx.conf` or site-specific config):

```nginx
http {
    # Allow uploads up to 100MB
    client_max_body_size 100M;
    
    # Optional: Increase timeout for large file processing
    client_body_timeout 300s;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
}
```

2. For site-specific configuration, add this to your virtual host:

```nginx
server {
    # Your existing configuration...
    
    # Allow large uploads for TTS compression
    client_max_body_size 100M;
    
    location /api/tts/compress {
        client_max_body_size 100M;
        proxy_pass http://localhost:3006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Restart nginx:
```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## Note

The Next.js application has already been configured with `bodySizeLimit: '100mb'` in `next.config.ts` to handle large requests on the application side.