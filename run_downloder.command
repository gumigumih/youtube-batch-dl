#!/bin/bash

# Change to the directory where this script is located
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

# Check if downloader.js exists
if [ ! -f "downloader.js" ]; then
    echo "❌ downloader.js not found in the current directory."
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

# Execute the JavaScript file
echo "🚀 Starting downloader.js..."
node downloader.js

# Keep the terminal window open if there's an error
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ An error occurred while running downloader.js"
    echo "Press any key to exit..."
    read -n 1
fi