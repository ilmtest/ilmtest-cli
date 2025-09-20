# ilmtest-cli

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/3ab8ca50-a24a-46b4-af93-e8a6a55f670a.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/3ab8ca50-a24a-46b4-af93-e8a6a55f670a)
[![Node.js CI](https://github.com/ilmtest/ilmtest-cli/actions/workflows/build.yml/badge.svg)](https://github.com/ilmtest/ilmtest-cli/actions/workflows/build.yml)
![GitHub License](https://img.shields.io/github/license/ilmtest/ilmtest-cli)
![GitHub Release](https://img.shields.io/github/v/release/ilmtest/ilmtest-cli)
![typescript](https://badgen.net/badge/icon/typescript?icon=typescript&label&color=blue)
[![codecov](https://codecov.io/github/ilmtest/ilmtest-cli/graph/badge.svg?token=K7YCHN75U9)](https://codecov.io/github/ilmtest/ilmtest-cli)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)

`ilmtest-cli` is a powerful command-line interface for interacting with the IlmTest APIs, providing tools for transcription, translation, content management, and data processing workflows.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Commands](#commands)
- [Configuration](#configuration)
- [Requirements](#requirements)
- [Development](#development)
- [License](#license)

## Features

- **AI Transcription**: Automatically transcribe audio/video content using AI
- **Translation Management**: Process and manage translations for content
- **Content Migration**: Migrate entries between different formats and sources
- **Shamela Integration**: Process content from Shamela digital library
- **AWS S3 Integration**: Upload and manage files in AWS S3
- **OCR Processing**: Extract and process OCR data
- **Interactive CLI**: User-friendly interactive prompts for all operations

## Installation

To install the `IlmTest CLI`, ensure you have Node.js version 23.0.0 or later.

### Global Installation

```bash
npm install -g ilmtest-cli
```

### Using npx (Recommended)

```bash
npx ilmtest-cli
```

### Using Bun

```bash
bunx ilmtest-cli
```

## Usage

### Interactive Mode

Run the CLI without any arguments to enter interactive mode:

```bash
ilmtest-cli
```

This will present you with a menu of available actions:
- AI Transcribe
- AI Translate
- Check ASL
- Delete ASL
- Download ASL
- Extract
- Upload ASL

### Command Line Mode

You can also run specific commands directly:

```bash
# Transcribe content for a specific collection
ilmtest-cli --transcribe [collection-id] [volume]

# Download ASL file
ilmtest-cli --downloadAsl [collection-id]

# Process Shamela content
ilmtest-cli --shamela --collection [id] --pages [from-to]

# Extract OCR data
ilmtest-cli --extract

# Migrate entries
ilmtest-cli --migrate

# Compile translations
ilmtest-cli --compile [collection-id]

# Adjust indices with diff
ilmtest-cli --diff [number]
```

## Commands

### Transcription Commands

#### `--transcribe`
Transcribe audio/video content using AI. Supports YouTube videos and local files.

```bash
ilmtest-cli --transcribe [collection-id] [volume]
```

### Content Management

#### `--shamela`
Process content from Shamela digital library with various options:

```bash
ilmtest-cli --shamela --collection [id] --pages [from-to] --multi --unused [pages|index]
```

Options:
- `--collection`: Shamela collection ID
- `--pages`: Page range (e.g., "1-100")
- `--multi`: Enable multi-segment processing
- `--unused`: Filter unused content by pages or index

#### `--migrate`
Migrate entries between different formats and link them with source content:

```bash
ilmtest-cli --migrate
```

#### `--compile`
Compile translations for a specific collection:

```bash
ilmtest-cli --compile [collection-id]
```

### File Operations

#### `--downloadAsl`
Download ASL files from S3 storage:

```bash
ilmtest-cli --downloadAsl [collection-id]
```

#### Upload ASL
Upload ASL files to S3 storage (interactive mode only).

#### Check/Delete ASL
Check existence or delete ASL files from S3 (interactive mode only).

### Data Processing

#### `--extract`
Extract and process OCR data from JSON files:

```bash
ilmtest-cli --extract
```

#### `--diff`
Adjust indices in translation files:

```bash
ilmtest-cli --diff [number]
```

Add `--preview` flag to preview changes without applying them.

## Configuration

The CLI requires configuration for various services. On first run, you'll be prompted to configure:

- `collectionsEndpoint`: API endpoint for collections
- `tafrighApiKeys`: API keys for transcription service
- `awsRegion`: AWS region for S3 operations
- `awsAccessKey`: AWS access key
- `awsSecretKey`: AWS secret key
- `awsBucket`: AWS S3 bucket name

Configuration is stored securely using the `conf` package.

## Requirements

- **Node.js v23.0.0+** or **Bun v1.2.22+**
- AWS credentials (for S3 operations)
- API keys for transcription services

## Development

### Scripts

```bash
# Start development server
bun run start

# Build for production
bun run build

# Compile to standalone binary
bun run compile

# Format code
bun run format

# Lint code
bun run lint

# Run CI linting
bun run lint:ci
```

### Dependencies

The CLI leverages several powerful libraries:
- **Transcription**: `tafrigh` for AI transcription
- **Content Processing**: `shamela`, `baburchi`, `bitaboom`
- **OCR**: `kokokor` for OCR data processing
- **AWS**: Native Bun S3 client
- **CLI**: `@inquirer/prompts` for interactive prompts
- **Logging**: `pino` for structured logging

## License

Licensed under the MIT License. See the LICENSE file for details.