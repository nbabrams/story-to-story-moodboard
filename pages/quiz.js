import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

/*
===========================================
AIRTABLE-POWERED BRAND STYLE QUIZ
Story to Story - Moodboard Questionnaire
===========================================

This version uses a secure API route to keep your 
Airtable API key private.

Set these environment variables in Vercel:
- AIRTABLE_API_KEY: Your Airtable Personal Access Token
- AIRTABLE_BASE_ID: appP5rNEZQhzo8HDl (optional, has default)

===========================================
*/

// Field name mappings (matching YOUR Airtable field names)
const FIELD_NAMES = {
  clients: {
    name: 'Name',
    slug: 'Slug',
    logo: 'Logo URL',
    active: 'Active',
    introTitle: 'Intro Title',
    introSubtitle: 'Intro Subtitle'
  },
  questions: {
    client: 'Client',
    order: 'Order',
    category: 'Question Text',
    optionAImage: 'Option A Image',
    optionALabel: 'Option A Description',
    optionATraits: 'Option A Traits',
    optionBImage: 'Option B Image',
    optionBLabel: 'Option B Description',
    optionBTraits: 'Option B Traits',
    active: 'Active'
  },
  templates: {
    client: 'Client',
    name: 'Name',
    description: 'Description',
    previewImage: 'Preview Image',
    framerUrl: 'Framer URL',
    matchProfile: 'Match Profile',
    order: 'Order'
  },
  results: {
    client: 'Client',
    sessionId: 'Session ID',
    submittedAt: 'Submitted At',
    scores: 'Scores',
    answers: 'Answers',
    topTraits: 'Top Traits',
    recommendedTemplate: 'Recommended Template',
    respondentName: 'Respondent Name',
    respondentEmail: 'Respondent Email'
  }
};

const DIMENSIONS = {
  minimal: { opposite: 'rich', label: 'Minimal ↔ Rich' },
  geometric: { opposite: 'organic', label: 'Geometric ↔ Organic' },
  bold: { opposite: 'refined', label: 'Bold ↔ Refined' },
  warm: { opposite: 'cool', label: 'Warm ↔ Cool' },
  playful: { opposite: 'serious', label: 'Playful ↔ Serious' },
};

// API helpers using our secure route
const airtable = {
  async fetch(table, options = {}) {
    const response = await fetch('/api/airtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch', table, options })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }
    return response.json();
  },
  
  async create(table, fields) {
    const response = await fetch('/api/airtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', table, options: { fields } })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API error: ${response.status}`);
    }
    return response.json();
  }
};

// Helper to extract URL from Airtable attachment field
const getAttachmentUrl = (attachmentField) => {
  if (!attachmentField || !attachmentField.length) return null;
  return attachmentField[0]?.url || attachmentField[0]?.thumbnails?.large?.url || null;
};

// Generate unique session ID
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Main Quiz Component
export default function BrandStyleQuiz() {
  const router = useRouter();
  const { client: clientSlug } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [client, setClient] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [screen, setScreen] = useState('intro');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [scores, setScores] = useState({});
  const [answers, setAnswers] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sessionId] = useState(generateSessionId());
  const [contactInfo, setContactInfo] = useState({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);

  // Load data when clientSlug is available
  useEffect(() => {
    if (clientSlug) {
      loadQuizData();
    }
  }, [clientSlug]);

  const loadQuizData = async () => {
    const f = FIELD_NAMES;

    try {
      // Fetch client
      const clientRes = await airtable.fetch('Clients', {
        filterByFormula: `AND({${f.clients.slug}} = '${clientSlug}', {${f.clients.active}} = TRUE())`
      });
      
      if (!clientRes.records || !clientRes.records.length) {
        throw new Error(`Quiz not found for "${clientSlug}". Make sure the client exists and is marked as Active in Airtable.`);
      }
      
      const clientRecord = clientRes.records[0];
      const loadedClient = {
        id: clientRecord.id,
        name: clientRecord.fields[f.clients.name],
        slug: clientRecord.fields[f.clients.slug],
        logo: clientRecord.fields[f.clients.logo],
        introTitle: clientRecord.fields[f.clients.introTitle] || 'Find Your Brand Style',
        introSubtitle: clientRecord.fields[f.clients.introSubtitle] || 'Answer a few questions to discover your visual direction'
      };
      setClient(loadedClient);

      // Fetch questions
      const questionsRes = await airtable.fetch('Questions', {
        filterByFormula: `AND(FIND('${clientRecord.id}', ARRAYJOIN({${f.questions.client}})), {${f.questions.active}} = TRUE())`,
        sort: [{ field: f.questions.order, direction: 'asc' }]
      });
      
      if (!questionsRes.records || !questionsRes.records.length) {
        throw new Error('No questions found for this client. Add questions in Airtable and mark them as Active.');
      }
      
      const loadedQuestions = questionsRes.records.map(r => ({
        id: r.id,
        order: r.fields[f.questions.order],
        category: r.fields[f.questions.category],
        optionA: {
          image: getAttachmentUrl(r.fields[f.questions.optionAImage]),
          label: r.fields[f.questions.optionALabel],
          traits: JSON.parse(r.fields[f.questions.optionATraits] || '{}')
        },
        optionB: {
          image: getAttachmentUrl(r.fields[f.questions.optionBImage]),
          label: r.fields[f.questions.optionBLabel],
          traits: JSON.parse(r.fields[f.questions.optionBTraits] || '{}')
        }
      }));
      
      setQuestions(loadedQuestions);

      // Fetch templates
      const templatesRes = await airtable.fetch('Templates', {
        filterByFormula: `FIND('${clientRecord.id}', ARRAYJOIN({${f.templates.client}}))`,
        sort: [{ field: f.templates.order, direction: 'asc' }]
      });
      
      const loadedTemplates = (templatesRes.records || []).map(r => ({
        id: r.id,
        name: r.fields[f.templates.name],
        description: r.fields[f.templates.description],
        previewImage: r.fields[f.templates.previewImage],
        framerUrl: r.fields[f.templates.framerUrl],
        matchProfile: JSON.parse(r.fields[f.templates.matchProfile] || '{}')
      }));
      
      setTemplates(loadedTemplates);
      setLoading(false);
      
    } catch (err) {
      console.error('Error loading quiz:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChoice = (option) => {
    if (isAnimating) return;
    
    const question = questions[currentQuestion];
    setSelectedOption(option);
    setIsAnimating(true);

    const traits = option === 'A' ? question.optionA.traits : question.optionB.traits;
    const newScores = { ...scores };
    Object.entries(traits).forEach(([trait, value]) => {
      newScores[trait] = (newScores[trait] || 0) + value;
    });
    setScores(newScores);

    setAnswers([...answers, {
      questionId: question.id,
      category: question.category,
      choice: option,
      choiceLabel: option === 'A' ? question.optionA.label : question.optionB.label
    }]);

    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
        setIsAnimating(false);
      } else {
        setScreen('contact');
      }
    }, 400);
  };

  const calculateResults = () => {
    const maxScore = Math.max(...Object.values(scores), 1);
    const normalized = {};
    Object.entries(scores).forEach(([trait, score]) => {
      const ratio = score / maxScore;
      normalized[trait] = ratio > 0.66 ? 'high' : ratio > 0.33 ? 'medium' : 'low';
    });
    return normalized;
  };

  const getTopTraits = () => {
    return Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([trait]) => trait);
  };

  const matchTemplates = () => {
    const profile = calculateResults();
    
    return templates.map(template => {
      let matchScore = 0;
      let totalChecks = 0;
      
      Object.entries(template.matchProfile).forEach(([trait, expectedLevel]) => {
        totalChecks++;
        const actualLevel = profile[trait] || 'low';
        if (actualLevel === expectedLevel) matchScore += 2;
        else if (
          (actualLevel === 'high' && expectedLevel === 'medium') ||
          (actualLevel === 'medium' && expectedLevel === 'high') ||
          (actualLevel === 'medium' && expectedLevel === 'low') ||
          (actualLevel === 'low' && expectedLevel === 'medium')
        ) matchScore += 1;
      });
      
      return {
        ...template,
        matchPercent: totalChecks > 0 ? Math.round((matchScore / (totalChecks * 2)) * 100) : 50
      };
    }).sort((a, b) => b.matchPercent - a.matchPercent);
  };

  const submitResults = async () => {
    setSubmitting(true);
    
    const topTraits = getTopTraits();
    const rankedTemplates = matchTemplates();
    const f = FIELD_NAMES.results;
    
    const resultData = {
      [f.sessionId]: sessionId,
      [f.submittedAt]: new Date().toISOString(),
      [f.scores]: JSON.stringify(scores),
      [f.answers]: JSON.stringify(answers),
      [f.topTraits]: topTraits.join(', '),
      [f.recommendedTemplate]: rankedTemplates[0]?.name || '',
      [f.respondentName]: contactInfo.name,
      [f.respondentEmail]: contactInfo.email
    };
    
    if (client?.id) {
      try {
        resultData[f.client] = [client.id];
        await airtable.create('Results', resultData);
      } catch (err) {
        console.error('Error saving results:', err);
      }
    }
    
    setSubmitting(false);
    setScreen('results');
  };

  const restart = () => {
    setScreen('intro');
    setCurrentQuestion(0);
    setScores({});
    setAnswers([]);
    setSelectedOption(null);
    setIsAnimating(false);
    setContactInfo({ name: '', email: '' });
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Head>
          <title>Loading Quiz...</title>
        </Head>
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neutral-400">Loading quiz...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Head>
          <title>Quiz Error</title>
        </Head>
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-xl font-medium mb-2">Something went wrong</h1>
            <p className="text-neutral-400 mb-6">{error}</p>
            <a 
              href="/"
              className="inline-block px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
            >
              Go Home
            </a>
          </div>
        </div>
      </>
    );
  }

  // Intro screen
  if (screen === 'intro') {
    return (
      <>
        <Head>
          <title>{client?.introTitle || 'Brand Style Quiz'}</title>
        </Head>
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
          <div className="text-center max-w-lg">
            {client?.logo && (
              <img src={client.logo} alt={client.name} className="h-12 mx-auto mb-8 opacity-80" />
            )}
            <h1 className="text-3xl md:text-4xl font-light mb-4">
              {client?.introTitle || 'Find Your Brand Style'}
            </h1>
            <p className="text-neutral-400 mb-8 text-lg">
              {client?.introSubtitle || 'Answer a few questions to discover your visual direction'}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-500 mb-8">
              <span>{questions.length} questions</span>
              <span>•</span>
              <span>~2 minutes</span>
            </div>
            <button
              onClick={() => setScreen('quiz')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Start Quiz
            </button>
          </div>
        </div>
      </>
    );
  }

  // Quiz screen
  if (screen === 'quiz') {
    const question = questions[currentQuestion];
    const progress = ((currentQuestion) / questions.length) * 100;

    return (
      <>
        <Head>
          <title>{question.category} - Brand Style Quiz</title>
        </Head>
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
          <div className="h-1 bg-neutral-800">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-center pt-8 pb-4 px-6">
            <p className="text-neutral-500 text-sm mb-1">
              {currentQuestion + 1} of {questions.length}
            </p>
            <h2 className="text-xl font-light">{question.category}</h2>
          </div>

          <div className="flex-1 flex items-center justify-center p-6 gap-4 md:gap-8">
            <button
              onClick={() => handleChoice('A')}
              disabled={isAnimating}
              className={`group relative flex-1 max-w-md aspect-[4/3] rounded-2xl overflow-hidden transition-all duration-300 bg-neutral-800 ${
                selectedOption === 'A' ? 'scale-105 ring-4 ring-purple-500' : 
                selectedOption === 'B' ? 'scale-95 opacity-40' : 
                'hover:scale-102 hover:ring-2 hover:ring-white/20'
              }`}
            >
              {question.optionA.image ? (
                <img 
                  src={question.optionA.image} 
                  alt={question.optionA.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                  No image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                <span className="text-lg md:text-xl font-medium">{question.optionA.label}</span>
              </div>
            </button>

            <div className="hidden md:flex items-center justify-center">
              <span className="text-neutral-600 text-sm">or</span>
            </div>

            <button
              onClick={() => handleChoice('B')}
              disabled={isAnimating}
              className={`group relative flex-1 max-w-md aspect-[4/3] rounded-2xl overflow-hidden transition-all duration-300 bg-neutral-800 ${
                selectedOption === 'B' ? 'scale-105 ring-4 ring-purple-500' : 
                selectedOption === 'A' ? 'scale-95 opacity-40' : 
                'hover:scale-102 hover:ring-2 hover:ring-white/20'
              }`}
            >
              {question.optionB.image ? (
                <img 
                  src={question.optionB.image} 
                  alt={question.optionB.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                  No image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                <span className="text-lg md:text-xl font-medium">{question.optionB.label}</span>
              </div>
            </button>
          </div>

          <div className="text-center pb-8 text-neutral-600 text-sm">
            Click to choose
          </div>
        </div>
      </>
    );
  }

  // Contact screen
  if (screen === 'contact') {
    return (
      <>
        <Head>
          <title>Almost Done - Brand Style Quiz</title>
        </Head>
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <h1 className="text-2xl font-light mb-2">Almost done!</h1>
              <p className="text-neutral-400">Add your info to see your results</p>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Name (optional)</label>
                <input
                  type="text"
                  value={contactInfo.name}
                  onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Email (optional)</label>
                <input
                  type="email"
                  value={contactInfo.email}
                  onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button
              onClick={submitResults}
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'See My Results'}
            </button>

            <button
              onClick={submitResults}
              className="w-full py-4 text-neutral-500 hover:text-white transition-colors mt-2 text-sm"
            >
              Skip and see results
            </button>
          </div>
        </div>
      </>
    );
  }

  // Results screen
  if (screen === 'results') {
    const topTraits = getTopTraits();
    const rankedTemplates = matchTemplates();

    return (
      <>
        <Head>
          <title>Your Results - Brand Style Quiz</title>
        </Head>
        <div className="min-h-screen bg-neutral-950 text-white p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-3xl font-light mb-2">Your Brand Style Profile</h1>
              <p className="text-neutral-400">Based on your visual preferences</p>
            </div>

            <div className="bg-neutral-900 rounded-2xl p-8 mb-8">
              <h2 className="text-lg font-medium mb-6 text-neutral-300">Your Style DNA</h2>
              <div className="flex flex-wrap gap-3 mb-8">
                {topTraits.map((trait, i) => (
                  <span 
                    key={trait}
                    className="px-4 py-2 rounded-full text-sm font-medium"
                    style={{
                      background: i === 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                                 i === 1 ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.1)',
                      color: i < 2 ? 'white' : '#999'
                    }}
                  >
                    {trait.charAt(0).toUpperCase() + trait.slice(1)}
                  </span>
                ))}
              </div>

              <div className="space-y-4">
                {Object.entries(DIMENSIONS).map(([key, dim]) => {
                  const leftScore = scores[key] || 0;
                  const rightScore = scores[dim.opposite] || 0;
                  const total = leftScore + rightScore || 1;
                  const leftPercent = (leftScore / total) * 100;
                  
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs text-neutral-500">
                        <span className={leftPercent > 50 ? 'text-white' : ''}>{key}</span>
                        <span className={leftPercent < 50 ? 'text-white' : ''}>{dim.opposite}</span>
                      </div>
                      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${leftPercent}%`,
                            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {rankedTemplates.length > 0 && (
              <>
                <h2 className="text-lg font-medium mb-4 text-neutral-300">Recommended Templates</h2>
                <div className="space-y-4 mb-8">
                  {rankedTemplates.map((template, i) => (
                    <div 
                      key={template.name}
                      className={`bg-neutral-900 rounded-2xl overflow-hidden flex flex-col sm:flex-row ${i === 0 ? 'ring-2 ring-purple-500' : ''}`}
                    >
                      <div className="w-full sm:w-48 h-40 sm:h-32 flex-shrink-0 bg-neutral-800">
                        {template.previewImage ? (
                          <img 
                            src={template.previewImage} 
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            No preview
                          </div>
                        )}
                      </div>
                      <div className="p-5 flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium">{template.name}</h3>
                          <span className={`text-sm px-2 py-1 rounded ${i === 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-neutral-800 text-neutral-400'}`}>
                            {template.matchPercent}% match
                          </span>
                        </div>
                        <p className="text-sm text-neutral-400 mb-3">{template.description}</p>
                        {i === 0 && (
                          <span className="text-xs text-purple-400">★ Best Match</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <details className="bg-neutral-900 rounded-2xl p-6 mb-8">
              <summary className="cursor-pointer text-neutral-400 hover:text-white transition-colors">
                View your choices ({answers.length} selections)
              </summary>
              <div className="mt-4 space-y-2">
                {answers.map((answer, i) => (
                  <div key={i} className="flex justify-between text-sm py-2 border-b border-neutral-800">
                    <span className="text-neutral-500">{answer.category}</span>
                    <span>{answer.choiceLabel}</span>
                  </div>
                ))}
              </div>
            </details>

            <button
              onClick={restart}
              className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}
