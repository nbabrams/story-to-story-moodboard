/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com', 'dl.airtable.com', 'v5.airtableusercontent.com'],
  },
}

module.exports = nextConfig
