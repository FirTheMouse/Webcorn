#!/bin/bash

set -e

echo "=== Golden Systems TLS Cert Renewal ==="
echo ""

sudo certbot certonly --manual --preferred-challenges dns -d goldensystems.ca

echo ""
echo "Copying certs..."
sudo cp /etc/letsencrypt/live/goldensystems.ca/fullchain.pem ./web/files/cert.pem
sudo cp /etc/letsencrypt/live/goldensystems.ca/privkey.pem ./web/files/key.pem

echo ""
echo "Done. Don't forget to rsync to your VPSes and restart Webcorn."