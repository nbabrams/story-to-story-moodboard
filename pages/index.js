import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();

  // If there's a client parameter, redirect to quiz
  useEffect(() => {
    if (router.query.client) {
      router.push(`/quiz?client=${router.query.client}`);
    }
  }, [router.query.client]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <Head>
        <title>Brand Style Quiz</title>
        <meta name="description" content="Discover your brand's visual direction" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-light mb-4">Brand Style Quiz</h1>
        <p className="text-neutral-400 mb-8">
          This quiz helps clients discover their brand's visual direction.
        </p>
        <div className="bg-neutral-900 rounded-xl p-6 text-left">
          <h2 className="text-lg font-medium mb-4">How to use:</h2>
          <p className="text-neutral-400 text-sm mb-4">
            Share a link with your client using their unique slug:
          </p>
          <code className="block bg-neutral-800 p-3 rounded text-sm text-purple-400 mb-4">
            {typeof window !== 'undefined' ? window.location.origin : 'https://your-site.com'}/quiz?client=<span className="text-pink-400">client-slug</span>
          </code>
          <p className="text-neutral-500 text-xs">
            Configure clients, questions, and templates in your Airtable base.
          </p>
        </div>
        
        <div className="mt-8">
          <a 
            href="/quiz?client=sample" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Try Sample Quiz →
          </a>
        </div>
      </div>
    </div>
  );
}
